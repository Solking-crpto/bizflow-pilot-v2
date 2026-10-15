import { prisma } from "../db";
import { sha256, canonicalJson } from "../crypto";
import { formatUsdc, usdcAtomic, parseUsdc } from "../money";
import { evaluatePolicy, PolicyContext } from "../policy/engine";
import { evaluatePaymentTiming } from "./timing";
import { getCashPositionTool, listObligationsTool, getInvoiceVerificationTool } from "./tools";
import { executePaymentTransaction } from "../payments/executor";
import { getActiveNetwork } from "../networks";
import { isBlocklistedWallet } from "../security/walletBlocklist";

export interface AgentRunResult {
  success: boolean;
  runId: string;
  timestamp: string;
  mode: "assisted" | "autonomous";
  invoicesEvaluated: number;
  processedCount: number;
  autoExecutedCount: number;
  scheduledCount: number;
  heldCount: number;
  escalatedCount: number;
  totalVolumeExecutedUsdc: string;
  decisions: any[];
}

export async function runAutonomousAgentLoop(params?: {
  orgId?: string;
  dryRun?: boolean;
}): Promise<AgentRunResult> {
  // 1. Get organization and settings
  const org = params?.orgId
    ? await prisma.organization.findUnique({
        where: { id: params.orgId },
        include: { settings: true },
      })
    : await prisma.organization.findFirst({
        include: { settings: true },
      });

  if (!org) {
    throw new Error("No organization found to run autonomous agent loop");
  }

  const networkConfig = getActiveNetwork();
  const settings = org.settings[0] || {
    id: "default-settings",
    orgId: org.id,
    killSwitchActive: false,
    priceToleranceBps: 100,
    requireApprovalAbove: 5000000000n,
    minReserveUsdc: 2000000000n,
    dailyLimitUsdc: 20000000000n,
    agentMode: "assisted",
    autoApproveLimitUsdc: 500000n, // 0.50 USDC
    maxDailyAutonomousUsdc: 1000000n, // 1.00 USDC
  };

  const agentMode = (settings.agentMode || "assisted") as "assisted" | "autonomous";
  const autoLimit = BigInt(settings.autoApproveLimitUsdc ?? 500000n);
  const dailyCap = BigInt(settings.maxDailyAutonomousUsdc ?? 1000000n);

  // 2. Compute today's autonomous volume spent
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const todayPayments = await prisma.payment.findMany({
    where: {
      orgId: org.id,
      network: networkConfig.mode,
      status: { in: ["confirmed", "anchored"] },
      confirmedAt: { gte: startOfDay },
    },
    select: { amountAtomic: true },
  });

  let dailyAutonomousSpentAtomic = todayPayments.reduce(
    (sum, p) => sum + BigInt(p.amountAtomic),
    0n
  );

  // 3. Fetch open invoices
  const openInvoices = await prisma.invoice.findMany({
    where: {
      orgId: org.id,
      status: { in: ["pending_verification", "verified", "review_required", "approved"] },
    },
    include: {
      vendor: true,
      payments: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Tools data
  const cashPos = await getCashPositionTool(org.id);
  const obligations = await listObligationsTool(org.id);

  let autoExecutedCount = 0;
  let scheduledCount = 0;
  let heldCount = 0;
  let escalatedCount = 0;
  let totalVolumeExecutedAtomic = 0n;
  const decisionRecords: any[] = [];

  const providerName = process.env.LLM_PROVIDER || "deterministic";

  for (const inv of openInvoices) {
    const totalAtomic = BigInt(inv.totalUsdc);

    // Context snapshot
    const contextSnapshot = {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      vendorName: inv.vendor.name,
      amountAtomic: totalAtomic.toString(),
      dueDate: inv.dueDate?.toISOString() || null,
      earlyPayDiscountPct: inv.earlyPayDiscountPct,
      earlyPayDays: inv.earlyPayDays,
      matchStatus: inv.matchStatus,
      duplicateScore: inv.duplicateScore,
      isInjectionSuspect: inv.isInjectionSuspect,
      cashPosition: cashPos,
      agentMode,
      autoLimitAtomic: autoLimit.toString(),
      dailyCapAtomic: dailyCap.toString(),
    };
    const observationHash = sha256(canonicalJson(contextSnapshot));

    // 1. Verification checks
    const isBlocklisted = isBlocklistedWallet(inv.vendor.walletAddress);
    const hasMatch = inv.matchStatus === "exact_match";
    const isSafe = !inv.isInjectionSuspect && inv.duplicateScore < 90 && !isBlocklisted;

    // 2. Timing intelligence
    const timing = evaluatePaymentTiming({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      totalUsdc: totalAtomic,
      dueDate: inv.dueDate,
      earlyPayDiscountPct: inv.earlyPayDiscountPct,
      earlyPayDays: inv.earlyPayDays,
      createdAt: inv.createdAt,
      availableTreasuryUsdc: BigInt(cashPos.availableTreasuryAtomic),
      minReserveUsdc: BigInt(cashPos.minReserveAtomic),
      upcomingObligationsUsdc: BigInt(obligations.openInvoicesCount) * 1000000n,
    });

    let choice = timing.choice;
    let reasoning = timing.reasoning;
    let source = "fallback";
    let model = "deterministic-financial-engine-v2";

    // Hostile or duplicate flags override timing
    if (inv.isInjectionSuspect) {
      choice = "hold";
      reasoning = "SECURITY ALERT: Adversarial prompt injection detected in invoice payload. Payment quarantined and blocked.";
    } else if (inv.duplicateScore >= 90) {
      choice = "hold";
      reasoning = `Duplicate invoice risk score is ${inv.duplicateScore}%. Payment held to prevent double-spending.`;
    } else if (!hasMatch) {
      choice = "escalate";
      reasoning = `Reconciliation mismatch: status is '${inv.matchStatus}'. Line discrepancies require finance review.`;
    }

    // 3. Policy Pre-Evaluation
    const policyContext: PolicyContext = {
      network: networkConfig.mode,
      killSwitchActive: settings.killSwitchActive,
      availableTreasuryUsdc: usdcAtomic(BigInt(cashPos.availableTreasuryAtomic)),
      minReserveUsdc: usdcAtomic(settings.minReserveUsdc),
      dailySpentUsdc: usdcAtomic(dailyAutonomousSpentAtomic),
      dailyLimitUsdc: usdcAtomic(settings.dailyLimitUsdc),
      approvalThresholdUsdc: usdcAtomic(settings.requireApprovalAbove),
      maxMainnetPaymentUsdc: parseUsdc(networkConfig.maxPaymentUsdc),
      hasOwnerConfirmation: agentMode === "autonomous" && totalAtomic <= autoLimit,
      vendor: {
        id: inv.vendor.id,
        name: inv.vendor.name,
        status: inv.vendor.status,
        recordedWallet: inv.vendor.walletAddress,
        perVendorLimitUsdc: usdcAtomic(inv.vendor.perVendorLimitUsdc),
        walletCooldownUntil: inv.vendor.walletCooldownUntil,
      },
      invoice: {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        totalUsdc: usdcAtomic(totalAtomic),
        remittanceWallet: inv.vendor.walletAddress,
        matchStatus: inv.matchStatus,
        duplicateScore: inv.duplicateScore,
        isInjectionSuspect: inv.isInjectionSuspect,
        hasExistingPaymentForNetwork: false,
        isHumanApproved: agentMode === "autonomous" && totalAtomic <= autoLimit,
      },
    };

    const policyEval = evaluatePolicy(policyContext);
    let conflictWithPolicy = false;
    let policyConflictReason: string | null = null;

    if (choice === "pay_now" && policyEval.decision !== "approve") {
      conflictWithPolicy = true;
      policyConflictReason = policyEval.summary;
      // Deterministic policy ALWAYS overrides LLM/Agent proposal!
      choice = policyEval.decision === "block" ? "hold" : "escalate";
      reasoning = `Policy override: Proposed pay_now, but policy gate returned '${policyEval.decision}'. Reason: ${policyEval.summary}`;
    }

    // 4. Autonomous Execution Evaluation
    let outcome = "held";
    let escalated = false;
    let txHash: string | null = null;

    if (choice === "pay_now") {
      const isAutonomousAllowed =
        agentMode === "autonomous" &&
        policyEval.decision === "approve" &&
        totalAtomic <= autoLimit &&
        dailyAutonomousSpentAtomic + totalAtomic <= dailyCap &&
        !settings.killSwitchActive;

      if (isAutonomousAllowed) {
        // Execute automatically through server-side safe path
        const execResult = await executePaymentTransaction({
          invoiceId: inv.id,
          actor: "agent",
          isAutonomous: true,
          hasOwnerConfirmation: true,
          dryRun: params?.dryRun,
        });

        if (execResult.success) {
          outcome = "executed";
          txHash = execResult.txHash || null;
          autoExecutedCount++;
          dailyAutonomousSpentAtomic += totalAtomic;
          totalVolumeExecutedAtomic += totalAtomic;
          reasoning += ` [Autonomous settlement executed: ${txHash || "confirmed"}]`;
        } else {
          outcome = "escalated";
          escalated = true;
          choice = "escalate";
          reasoning += ` [Auto-execution failed: ${execResult.error}. Escalated to owner.]`;
          escalatedCount++;
        }
      } else {
        // Exceeds limits or assisted mode -> Escalate to human
        outcome = "escalated";
        escalated = true;
        choice = "escalate";
        escalatedCount++;
        if (agentMode !== "autonomous") {
          reasoning += " [Agent is in assisted mode: awaiting human passcode sign-off.]";
        } else if (totalAtomic > autoLimit) {
          reasoning += ` [Amount (${formatUsdc(usdcAtomic(totalAtomic))} USDC) exceeds autonomous limit (${formatUsdc(usdcAtomic(autoLimit))} USDC). Escalated.]`;
        } else if (dailyAutonomousSpentAtomic + totalAtomic > dailyCap) {
          reasoning += ` [Daily autonomous cap (${formatUsdc(usdcAtomic(dailyCap))} USDC) reached. Escalated to owner.]`;
        } else if (settings.killSwitchActive) {
          reasoning += " [Global emergency kill switch is active. Execution halted and escalated.]";
        }
      }
    } else if (choice === "schedule") {
      outcome = "scheduled";
      scheduledCount++;
    } else if (choice === "escalate") {
      outcome = "escalated";
      escalated = true;
      escalatedCount++;
    } else {
      outcome = "held";
      heldCount++;
    }

    if (settings.killSwitchActive) {
      choice = "hold";
      outcome = "held";
      escalated = false;
      reasoning = "EMERGENCY HALT: Global kill switch is armed. All settlements paused and held.";
    }

    // 5. Persist AgentDecision record
    const decision = await prisma.agentDecision.create({
      data: {
        orgId: org.id,
        invoiceId: inv.id,
        observationHash,
        cashPosition: JSON.stringify(cashPos),
        choice,
        reasoning,
        source,
        model,
        promptVersion: "v2.0",
        escalated,
        outcome,
        txHash,
        conflictWithPolicy,
        policyConflictReason,
        scheduledFor: timing.scheduledDate || null,
      },
    });

    decisionRecords.push(decision);
  }

  return {
    success: true,
    runId: `run-${Date.now()}`,
    timestamp: new Date().toISOString(),
    mode: agentMode,
    invoicesEvaluated: openInvoices.length,
    processedCount: openInvoices.length,
    autoExecutedCount,
    scheduledCount,
    heldCount,
    escalatedCount,
    totalVolumeExecutedUsdc: formatUsdc(usdcAtomic(totalVolumeExecutedAtomic)),
    decisions: decisionRecords,
  };
}
