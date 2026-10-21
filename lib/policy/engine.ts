import { UsdcAtomic, UsdcMath, usdcAtomic, formatUsdc } from "../money";
import { sha256, canonicalJson } from "../crypto";
import { isBlocklistedWallet } from "../security/walletBlocklist";

export interface PolicyRuleResult {
  ruleCode: string;
  ruleName: string;
  passed: boolean;
  severity: "block" | "review";
  reason: string;
}

export interface PolicyContext {
  network: "testnet" | "mainnet";
  killSwitchActive: boolean;
  availableTreasuryUsdc: UsdcAtomic;
  minReserveUsdc: UsdcAtomic;
  dailySpentUsdc: UsdcAtomic;
  dailyLimitUsdc: UsdcAtomic;
  approvalThresholdUsdc: UsdcAtomic;
  maxMainnetPaymentUsdc: UsdcAtomic;
  hasOwnerConfirmation?: boolean;

  vendor: {
    id: string;
    name: string;
    status: string; // active, suspended, pending_cooldown
    recordedWallet: string;
    perVendorLimitUsdc: UsdcAtomic;
    walletCooldownUntil?: Date | null;
  };

  invoice: {
    id: string;
    invoiceNumber: string;
    totalUsdc: UsdcAtomic;
    remittanceWallet: string;
    matchStatus: string; // exact_match, qty_mismatch, price_mismatch, missing_receipt
    duplicateScore: number;
    isInjectionSuspect: boolean;
    hasExistingPaymentForNetwork?: boolean;
    isHumanApproved?: boolean;
    deliveryProofMode?: "off" | "optional" | "required" | string;
    deliveryStatus?: "approved" | "pending" | "rejected" | "none" | string;
    deliveryConditionsMet?: boolean;
    deliveryRequestId?: string;
    ownerOverrideReason?: string;
  };
}

export interface PolicyEvaluationOutput {
  decision: "approve" | "review" | "block";
  decisionHash: string;
  results: PolicyRuleResult[];
  summary: string;
}

/**
 * Deterministic Server-Side Policy Engine
 * Evaluates all 10 corporate security rules without external network dependencies.
 */
export function evaluatePolicy(context: PolicyContext): PolicyEvaluationOutput {
  const results: PolicyRuleResult[] = [];

  // RULE 1: Vendor must be on the approved list and active
  const isVendorActive = context.vendor.status === "active";
  results.push({
    ruleCode: "RULE_VENDOR_ACTIVE",
    ruleName: "Approved & Active Vendor Verification",
    passed: isVendorActive,
    severity: "block",
    reason: isVendorActive
      ? `Vendor ${context.vendor.name} is verified active.`
      : `Vendor status is '${context.vendor.status}'. Invoices from non-active vendors cannot be settled.`,
  });

  // RULE 2: Destination wallet must match vendor's recorded wallet; cooldown check
  const isWalletMatch =
    context.invoice.remittanceWallet.toLowerCase() === context.vendor.recordedWallet.toLowerCase();
  const isCooldownActive =
    context.vendor.walletCooldownUntil && context.vendor.walletCooldownUntil.getTime() > Date.now();

  const passedRule2 = isWalletMatch && !isCooldownActive;
  results.push({
    ruleCode: "RULE_WALLET_AUTHENTICITY",
    ruleName: "Destination Wallet Authenticity & Cooldown Guard",
    passed: passedRule2,
    severity: isWalletMatch ? "review" : "block",
    reason: !isWalletMatch
      ? `Remittance destination (${context.invoice.remittanceWallet}) does not match authorized vendor wallet (${context.vendor.recordedWallet}). Possible account compromise.`
      : isCooldownActive
      ? `Vendor recently updated wallet. 24h cooling-off period active until ${context.vendor.walletCooldownUntil?.toISOString()}.`
      : "Destination wallet matches authorized vendor record with no active cooldown.",
  });

  // RULE 2B: Known-Public Test Wallet Blocklist (Hardhat / Anvil default accounts)
  const isBlocklisted = isBlocklistedWallet(context.invoice.remittanceWallet);
  if (isBlocklisted) {
    const isMainnet = context.network === "mainnet";
    results.push({
      ruleCode: "RULE_BLOCKLISTED_WALLET",
      ruleName: "Known-Public Test Wallet Blocklist",
      passed: !isMainnet,
      severity: isMainnet ? "block" : "review",
      reason: isMainnet
        ? `SECURITY ALERT: Destination ${context.invoice.remittanceWallet} is a known Hardhat/Anvil default test account with public keys. Mainnet settlement strictly blocked.`
        : `WARNING: Destination ${context.invoice.remittanceWallet} is a known testnet account. Permitted for staging/testnet demonstration only.`,
    });
  } else {
    results.push({
      ruleCode: "RULE_BLOCKLISTED_WALLET",
      ruleName: "Known-Public Test Wallet Blocklist",
      passed: true,
      severity: "block",
      reason: "Destination address passed public key leak and testnet blocklist verification.",
    });
  }

  // RULE 3: Three-way match tolerance check
  const isMatchValid = context.invoice.matchStatus === "exact_match";
  results.push({
    ruleCode: "RULE_3WAY_MATCH",
    ruleName: "Three-Way Reconciliation Match",
    passed: isMatchValid,
    severity: "review",
    reason: isMatchValid
      ? "3-Way match verified against PO and Warehouse Goods Receipt."
      : `Reconciliation discrepancy: Invoice match status is '${context.invoice.matchStatus}'.`,
  });

  // RULE 4: Duplicate invoice blocking & Prompt Injection defense
  const isDuplicateOrInjection =
    context.invoice.duplicateScore >= 90 || context.invoice.isInjectionSuspect;
  results.push({
    ruleCode: "RULE_INTEGRITY_CHECK",
    ruleName: "Duplicate Screening & Prompt-Injection Neutralizer",
    passed: !isDuplicateOrInjection,
    severity: "block",
    reason: context.invoice.isInjectionSuspect
      ? "HOSTILE INJECTION DETECTED: Untrusted document contained adversarial instructions."
      : context.invoice.duplicateScore >= 90
      ? `Duplicate invoice risk score is ${context.invoice.duplicateScore}%. Duplicate settlement blocked.`
      : "No duplicate records or prompt-injection anomalies detected.",
  });

  // RULE 5: Amount <= per-payment limit, vendor limit, and daily cap
  const exceedsVendorLimit = UsdcMath.isGreaterThan(
    context.invoice.totalUsdc,
    context.vendor.perVendorLimitUsdc
  );
  const potentialDailyTotal = UsdcMath.add(context.dailySpentUsdc, context.invoice.totalUsdc);
  const exceedsDailyCap = UsdcMath.isGreaterThan(potentialDailyTotal, context.dailyLimitUsdc);

  const passedLimits = !exceedsVendorLimit && !exceedsDailyCap;
  results.push({
    ruleCode: "RULE_SPENDING_LIMITS",
    ruleName: "Per-Payment & Aggregate Spending Caps",
    passed: passedLimits,
    severity: "block",
    reason: exceedsVendorLimit
      ? `Invoice amount (${formatUsdc(context.invoice.totalUsdc)}) exceeds per-vendor limit (${formatUsdc(context.vendor.perVendorLimitUsdc)}).`
      : exceedsDailyCap
      ? `Projected daily spend (${formatUsdc(potentialDailyTotal)}) exceeds daily cap (${formatUsdc(context.dailyLimitUsdc)}).`
      : "Amount complies with vendor limit and aggregate daily spending cap.",
  });

  // RULE 6: Approval threshold check (amounts above threshold require explicit human sign-off)
  const isAboveThreshold = UsdcMath.isGreaterThan(
    context.invoice.totalUsdc,
    context.approvalThresholdUsdc
  );
  const passedThreshold = !isAboveThreshold || !!context.invoice.isHumanApproved;
  results.push({
    ruleCode: "RULE_APPROVAL_THRESHOLD",
    ruleName: "High-Value Human Approval Sign-off",
    passed: passedThreshold,
    severity: "review",
    reason: isAboveThreshold && !context.invoice.isHumanApproved
      ? `Invoice (${formatUsdc(context.invoice.totalUsdc)}) exceeds corporate threshold (${formatUsdc(context.approvalThresholdUsdc)}). Requires owner sign-off.`
      : "Within autonomous threshold or authorized by corporate officer.",
  });

  // RULE 7: Liquidity reserve protection
  const postPaymentBalance = UsdcMath.sub(context.availableTreasuryUsdc, context.invoice.totalUsdc);
  const respectsReserve = !UsdcMath.isLessThan(postPaymentBalance, context.minReserveUsdc);
  results.push({
    ruleCode: "RULE_RESERVE_PROTECTION",
    ruleName: "Post-Settlement Liquidity Reserve",
    passed: respectsReserve,
    severity: "review",
    reason: respectsReserve
      ? `Post-payment balance (${formatUsdc(postPaymentBalance)}) maintains mandatory reserve buffer (${formatUsdc(context.minReserveUsdc)}).`
      : `Payment would deplete treasury balance below required operating reserve (${formatUsdc(context.minReserveUsdc)}).`,
  });

  // RULE 8: Mainnet safety guardrail
  if (context.network === "mainnet") {
    const exceedsMainnetCap = UsdcMath.isGreaterThan(
      context.invoice.totalUsdc,
      context.maxMainnetPaymentUsdc
    );
    const hasConfirmation = !!context.hasOwnerConfirmation;
    const passedMainnetGuard = !exceedsMainnetCap && hasConfirmation;

    results.push({
      ruleCode: "RULE_MAINNET_GUARD",
      ruleName: "Arc Mainnet Safety Cap & Owner Confirmation",
      passed: passedMainnetGuard,
      severity: "block",
      reason: exceedsMainnetCap
        ? `Mainnet amount (${formatUsdc(context.invoice.totalUsdc)}) exceeds hackathon safety cap (${formatUsdc(context.maxMainnetPaymentUsdc)}).`
        : !hasConfirmation
        ? "Explicit owner confirmation modal required for real mainnet funds."
        : "Mainnet safety cap and owner confirmation verified.",
    });
  }

  // RULE 9: Global Kill Switch
  results.push({
    ruleCode: "RULE_KILL_SWITCH",
    ruleName: "Global Emergency Kill Switch",
    passed: !context.killSwitchActive,
    severity: "block",
    reason: context.killSwitchActive
      ? "EMERGENCY HALT: Global kill switch is armed. All settlements paused."
      : "Kill switch is disarmed. Settlement pipeline operational.",
  });

  // RULE 10: Idempotency protection
  const isAlreadyPaid = !!context.invoice.hasExistingPaymentForNetwork;
  results.push({
    ruleCode: "RULE_IDEMPOTENCY",
    ruleName: "Strict One-Time Settlement Idempotency",
    passed: !isAlreadyPaid,
    severity: "block",
    reason: isAlreadyPaid
      ? "Idempotency violation: This invoice has already been settled on this network."
      : "Single-settlement constraint satisfied.",
  });

  // RULE_DELIVERY_VERIFICATION: Physical Delivery Proof & Payment Conditions Guard
  const proofMode = context.invoice.deliveryProofMode || "off";
  const isProofRequired = proofMode === "required";
  const isDeliveryApproved =
    context.invoice.deliveryStatus === "approved" ||
    context.invoice.deliveryConditionsMet === true;
  const rawOverride = context.invoice.ownerOverrideReason?.trim();
  const hasOwnerOverride = !!rawOverride && rawOverride.length > 0;

  if (isProofRequired) {
    if (isDeliveryApproved) {
      results.push({
        ruleCode: "RULE_DELIVERY_VERIFICATION",
        ruleName: "Delivery Proof Verification Guard",
        passed: true,
        severity: "block",
        reason: `Delivery proof verified and approved (request #${context.invoice.deliveryRequestId || context.invoice.id}).`,
      });
    } else if (hasOwnerOverride) {
      const formattedOverride = rawOverride.startsWith("Owner override:")
        ? rawOverride
        : `Owner override: ${rawOverride}`;
      results.push({
        ruleCode: "RULE_DELIVERY_VERIFICATION",
        ruleName: "Delivery Proof Verification Guard",
        passed: true,
        severity: "block",
        reason: `${formattedOverride} (request #${context.invoice.deliveryRequestId || "unassigned"}).`,
      });
    } else {
      results.push({
        ruleCode: "RULE_DELIVERY_VERIFICATION",
        ruleName: "Delivery Proof Verification Guard",
        passed: false,
        severity: "block",
        reason: `Delivery proof required but not verified; request #${context.invoice.deliveryRequestId || "none"}`,
      });
    }
  } else {
    results.push({
      ruleCode: "RULE_DELIVERY_VERIFICATION",
      ruleName: "Delivery Proof Verification Guard",
      passed: true,
      severity: "block",
      reason:
        proofMode === "optional"
          ? "Delivery proof is optional for this invoice; payment permitted."
          : "Delivery proof mode is off; standard payment rules apply.",
    });
  }

  // Synthesize final decision
  const hasBlock = results.some((r) => !r.passed && r.severity === "block");
  const hasReview = results.some((r) => !r.passed && r.severity === "review");

  let decision: PolicyEvaluationOutput["decision"] = "approve";
  let summary = "All policy rules satisfied. Autonomous settlement approved.";

  if (hasBlock) {
    decision = "block";
    const blockingReasons = results
      .filter((r) => !r.passed && r.severity === "block")
      .map((r) => r.ruleName)
      .join(", ");
    summary = `Settlement BLOCKED by policy rules: ${blockingReasons}`;
  } else if (hasReview) {
    decision = "review";
    const reviewReasons = results
      .filter((r) => !r.passed && r.severity === "review")
      .map((r) => r.ruleName)
      .join(", ");
    summary = `HUMAN REVIEW REQUIRED before execution due to: ${reviewReasons}`;
  }

  // Cryptographic deterministic decision hash
  const canonicalPayload = canonicalJson({
    invoiceId: context.invoice.id,
    amount: context.invoice.totalUsdc.toString(),
    remittanceWallet: context.invoice.remittanceWallet,
    decision,
    results: results.map((r) => ({ code: r.ruleCode, passed: r.passed })),
  });
  const decisionHash = sha256(canonicalPayload);

  return {
    decision,
    decisionHash,
    results,
    summary,
  };
}
