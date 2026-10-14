import "server-only";

import { prisma } from "../db";
import { evaluatePolicy, PolicyContext } from "../policy/engine";
import { getPaymentProvider } from "./index";
import { executeAnchorProof } from "../audit/anchorService";
import { recordAuditEvent } from "../audit/ledger";
import { getActiveNetwork } from "../networks";
import { usdcAtomic, parseUsdc } from "../money";

export interface ExecutePaymentParams {
  invoiceId: string;
  actor: "agent" | "human";
  hasOwnerConfirmation?: boolean;
  isAutonomous?: boolean;
  dryRun?: boolean;
}

export interface ExecutePaymentResult {
  success: boolean;
  isIdempotent?: boolean;
  payment?: any;
  error?: string;
  details?: any;
  policyDecision?: "approve" | "review" | "block";
  policyResults?: any[];
  txHash?: string;
  anchorTxHash?: string;
}

/**
 * Server-side idempotent payment execution engine.
 * Re-evaluates 10-point deterministic policy at execution time,
 * records actor ('agent' | 'human') in the audit ledger,
 * executes on-chain transfer, and anchors cryptographic proof.
 */
export async function executePaymentTransaction(
  params: ExecutePaymentParams
): Promise<ExecutePaymentResult> {
  const { invoiceId, actor, isAutonomous, dryRun } = params;

  // 1. Fetch Invoice with relations
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      vendor: true,
      organization: { include: { settings: true } },
      payments: true,
    },
  });

  if (!invoice) {
    return { success: false, error: "Invoice not found" };
  }

  const networkConfig = getActiveNetwork();
  const networkMode = networkConfig.mode;
  const org = invoice.organization;
  const settings = org.settings[0] || {
    killSwitchActive: false,
    priceToleranceBps: 100,
    requireApprovalAbove: 5000000000n,
    minReserveUsdc: 2000000000n,
    dailyLimitUsdc: 20000000000n,
    agentMode: "assisted",
    autoApproveLimitUsdc: 500000n,
    maxDailyAutonomousUsdc: 1000000n,
  };

  // 2. Strict Idempotency Check per (invoiceId, networkMode)
  const idempotencyKey = `PAY-${invoice.id}-${networkMode}`;
  const existingPayment = await prisma.payment.findUnique({
    where: { idempotencyKey },
  });

  if (existingPayment && (existingPayment.status === "confirmed" || existingPayment.status === "anchored")) {
    return {
      success: true,
      isIdempotent: true,
      payment: existingPayment,
    };
  }

  // 3. Compute Today's Settled Volume for Daily Cap
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const todayPayments = await prisma.payment.findMany({
    where: {
      orgId: org.id,
      network: networkMode,
      status: { in: ["confirmed", "anchored"] },
      confirmedAt: { gte: startOfDay },
    },
    select: { amountAtomic: true },
  });

  const dailySpentAtomic = todayPayments.reduce(
    (sum, p) => sum + BigInt(p.amountAtomic),
    0n
  );

  // 4. Determine Owner Confirmation
  let hasOwnerConfirmation = !!params.hasOwnerConfirmation;
  if (actor === "agent" && isAutonomous) {
    const isWithinAutoLimit = invoice.totalUsdc <= BigInt(settings.autoApproveLimitUsdc ?? 500000n);
    const isWithinDailyAutonomousCap =
      dailySpentAtomic + invoice.totalUsdc <= BigInt(settings.maxDailyAutonomousUsdc ?? 1000000n);

    // If within autonomous spend caps and not emergency halted, owner approval is pre-authorized
    hasOwnerConfirmation = isWithinAutoLimit && isWithinDailyAutonomousCap;
  }

  // 5. Strict Server-Side Policy Re-Evaluation at Execution Time
  const policyContext: PolicyContext = {
    network: networkMode,
    killSwitchActive: settings.killSwitchActive,
    availableTreasuryUsdc: usdcAtomic(100000000000n), // 100,000 USDC default treasury capacity
    minReserveUsdc: usdcAtomic(settings.minReserveUsdc),
    dailySpentUsdc: usdcAtomic(dailySpentAtomic),
    dailyLimitUsdc: usdcAtomic(settings.dailyLimitUsdc),
    approvalThresholdUsdc: usdcAtomic(settings.requireApprovalAbove),
    maxMainnetPaymentUsdc: parseUsdc(networkConfig.maxPaymentUsdc),
    hasOwnerConfirmation,

    vendor: {
      id: invoice.vendor.id,
      name: invoice.vendor.name,
      status: invoice.vendor.status,
      recordedWallet: invoice.vendor.walletAddress,
      perVendorLimitUsdc: usdcAtomic(invoice.vendor.perVendorLimitUsdc),
      walletCooldownUntil: invoice.vendor.walletCooldownUntil,
    },

    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalUsdc: usdcAtomic(invoice.totalUsdc),
      remittanceWallet: invoice.vendor.walletAddress,
      matchStatus: invoice.matchStatus,
      duplicateScore: invoice.duplicateScore,
      isInjectionSuspect: invoice.isInjectionSuspect,
      hasExistingPaymentForNetwork: false,
      isHumanApproved: hasOwnerConfirmation,
    },
  };

  const policyEval = evaluatePolicy(policyContext);

  // Persist evaluation
  await prisma.policyEvaluation.create({
    data: {
      invoiceId: invoice.id,
      decision: policyEval.decision,
      decisionHash: policyEval.decisionHash,
      resultsJson: JSON.stringify(policyEval.results),
    },
  });

  // Policy Gating
  if (policyEval.decision === "block") {
    return {
      success: false,
      error: `Payment blocked by policy engine: ${policyEval.summary}`,
      policyDecision: "block",
      policyResults: policyEval.results,
    };
  }

  if (policyEval.decision === "review" && (actor === "agent" || !hasOwnerConfirmation)) {
    return {
      success: false,
      error: `Payment requires explicit human escalation: ${policyEval.summary}`,
      policyDecision: "review",
      policyResults: policyEval.results,
    };
  }

  // 6. Create Initial Payment Record
  const provider = getPaymentProvider();
  const payment = existingPayment || await prisma.payment.create({
    data: {
      orgId: org.id,
      invoiceId: invoice.id,
      vendorId: invoice.vendor.id,
      network: networkMode,
      provider: provider.name,
      idempotencyKey,
      amountAtomic: invoice.totalUsdc,
      destination: invoice.vendor.walletAddress,
      status: "initiated",
    },
  });

  // Record Audit Event: payment_submitted with explicit actor
  await recordAuditEvent({
    orgId: org.id,
    eventType: "payment_submitted",
    referenceId: payment.id,
    eventData: {
      actor,
      paymentId: payment.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      vendorName: invoice.vendor.name,
      destination: invoice.vendor.walletAddress,
      amountAtomic: invoice.totalUsdc.toString(),
      network: networkMode,
      provider: provider.name,
      decisionHash: policyEval.decisionHash,
    },
  });

  // 7. On-Chain Settlement via Payment Provider
  const transferResult = await provider.transferUsdc({
    to: invoice.vendor.walletAddress as `0x${string}`,
    amountAtomic: usdcAtomic(invoice.totalUsdc),
    idempotencyKey,
    refId: invoice.id,
    dryRun: dryRun || process.env.DRY_RUN === "true",
  });

  if (transferResult.status === "failed") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "failed" },
    });
    return {
      success: false,
      error: "Blockchain settlement failed",
      details: transferResult.error,
    };
  }

  // 8. Update Payment to Confirmed & Invoice to Paid
  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "confirmed",
      txHash: transferResult.txHash,
      receiptJson: JSON.stringify(transferResult.receipt),
      confirmedAt: new Date(),
    },
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "paid" },
  });

  // Record Audit Event: payment_confirmed with actor
  await recordAuditEvent({
    orgId: org.id,
    eventType: "payment_confirmed",
    referenceId: payment.id,
    eventData: {
      actor,
      paymentId: payment.id,
      txHash: transferResult.txHash,
      network: networkMode,
      receipt: transferResult.receipt,
    },
  });

  // 9. Anchor Cryptographic Proof to AuditAnchor.sol
  const anchorResult = await executeAnchorProof({
    paymentId: payment.id,
    invoiceId: invoice.id,
    orgId: org.id,
    invoiceHashHex: invoice.fileHash,
    decisionHashHex: policyEval.decisionHash,
    paymentTxHash: transferResult.txHash,
  });

  return {
    success: true,
    payment: updatedPayment,
    txHash: transferResult.txHash,
    anchorTxHash: anchorResult.anchorTxHash,
  };
}
