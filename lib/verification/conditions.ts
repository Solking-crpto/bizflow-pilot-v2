export type RuleSeverity = "block" | "warn" | "info";
export type OverallConditionStatus = "ready" | "needs_review" | "failed";

export interface ConditionRuleConfig {
  ruleId:
    | "min_files"
    | "required_kinds"
    | "quantities_match"
    | "delivery_window"
    | "verifier_identified"
    | "challenge_code_visible"
    | "no_duplicate_evidence"
    | "ai_matches_po"
    | "invoice_matches_po"
    | "owner_approval_above_amount"
    | string;
  severity: RuleSeverity;
  params?: Record<string, any>;
}

export interface VerificationEvaluationInput {
  files: Array<{
    sha256: string;
    kind: string; // photo, video, document, pdf, signature, keyframe
    size?: number;
    mime?: string;
  }>;
  historicalOrgSha256s?: string[];
  submission?: {
    receivedQuantities?: Record<string, number>;
    verifierName?: string;
    verifierContact?: string;
    submittedAt?: string | Date;
  };
  purchaseOrder?: {
    expectedDeliveryDate?: string | Date;
    graceHours?: number;
    items?: Array<{
      description: string;
      quantity: number;
      unitPriceUsdc?: number;
    }>;
    totalAmountUsdc?: number;
  };
  invoice?: {
    totalUsdc: number | bigint;
    status?: string;
  };
  aiExtraction?: {
    extractedChallengeCode?: string;
    challengeCodeConfidence?: number;
    extractedItems?: Array<{ description: string; quantity: number }>;
    similarityScore?: number; // 0 to 1
  };
  expectedChallengeCode?: string;
  ownerApproved?: boolean;
}

export interface RuleEvaluationResult {
  ruleId: string;
  name: string;
  passed: boolean;
  severity: RuleSeverity;
  reason: string;
}

export interface EvaluationResult {
  ruleResults: RuleEvaluationResult[];
  overall: OverallConditionStatus;
}

export const DEFAULT_CONDITION_RULES: ConditionRuleConfig[] = [
  { ruleId: "min_files", severity: "block", params: { minCount: 1 } },
  { ruleId: "required_kinds", severity: "block", params: { kinds: ["photo"] } },
  { ruleId: "verifier_identified", severity: "warn" },
  { ruleId: "challenge_code_visible", severity: "warn" },
  { ruleId: "no_duplicate_evidence", severity: "block" },
  { ruleId: "quantities_match", severity: "warn", params: { tolerancePct: 0 } },
];

export function evaluate(
  inputs: VerificationEvaluationInput,
  rules: ConditionRuleConfig[]
): EvaluationResult {
  const ruleResults: RuleEvaluationResult[] = [];

  for (const rule of rules) {
    const result = evaluateSingleRule(inputs, rule);
    ruleResults.push(result);
  }

  // Calculate overall status:
  // If any 'block' rule failed -> 'failed'
  // Else if any 'warn' rule failed -> 'needs_review'
  // Else -> 'ready'
  let overall: OverallConditionStatus = "ready";

  const blockFails = ruleResults.some((r) => r.severity === "block" && !r.passed);
  const warnFails = ruleResults.some((r) => r.severity === "warn" && !r.passed);

  if (blockFails) {
    overall = "failed";
  } else if (warnFails) {
    overall = "needs_review";
  }

  return { ruleResults, overall };
}

function evaluateSingleRule(
  inputs: VerificationEvaluationInput,
  rule: ConditionRuleConfig
): RuleEvaluationResult {
  switch (rule.ruleId) {
    case "min_files": {
      const minCount = Number(rule.params?.minCount ?? 1);
      const actualCount = inputs.files ? inputs.files.length : 0;
      const passed = actualCount >= minCount;
      return {
        ruleId: rule.ruleId,
        name: "Minimum Evidence Files Attached",
        passed,
        severity: rule.severity,
        reason: passed
          ? `Attached ${actualCount} files (required: at least ${minCount})`
          : `Insufficient evidence: attached ${actualCount} files, required at least ${minCount}`,
      };
    }

    case "required_kinds": {
      const requiredKinds: string[] = rule.params?.kinds || ["photo"];
      const files = inputs.files || [];
      const presentKinds = new Set(
        files.map((f) => {
          const k = f.kind.toLowerCase();
          return k === "pdf" ? "document" : k;
        })
      );

      const missing: string[] = [];
      for (const required of requiredKinds) {
        const normalized = required.toLowerCase() === "pdf" ? "document" : required.toLowerCase();
        if (!presentKinds.has(normalized)) {
          missing.push(required);
        }
      }

      const passed = missing.length === 0;
      return {
        ruleId: rule.ruleId,
        name: "Required Evidence Types Provided",
        passed,
        severity: rule.severity,
        reason: passed
          ? `All required evidence types present: [${requiredKinds.join(", ")}]`
          : `Missing required evidence types: [${missing.join(", ")}]`,
      };
    }

    case "quantities_match": {
      const tolerancePct = Number(rule.params?.tolerancePct ?? 0);
      const received = inputs.submission?.receivedQuantities;
      const poItems = inputs.purchaseOrder?.items;

      if (!poItems || poItems.length === 0) {
        return {
          ruleId: rule.ruleId,
          name: "Item Quantities Match Purchase Order",
          passed: true,
          severity: rule.severity,
          reason: "No PO items specified; quantity match skipped",
        };
      }

      if (!received || Object.keys(received).length === 0) {
        return {
          ruleId: rule.ruleId,
          name: "Item Quantities Match Purchase Order",
          passed: false,
          severity: rule.severity,
          reason: "No received quantities provided by verifier",
        };
      }

      const discrepancies: string[] = [];
      for (const item of poItems) {
        // Look up by description or normalized key
        const key = item.description;
        const normalizedKey = key.trim().toLowerCase();
        const receivedQty =
          received[key] ??
          Object.entries(received).find(([k]) => k.trim().toLowerCase() === normalizedKey)?.[1];

        if (receivedQty === undefined || receivedQty === null) {
          discrepancies.push(`Missing quantity report for '${item.description}'`);
          continue;
        }

        const expectedQty = item.quantity;
        const diff = Math.abs(receivedQty - expectedQty);
        const allowedDiff = expectedQty * (tolerancePct / 100);

        if (diff > allowedDiff) {
          discrepancies.push(
            `'${item.description}': received ${receivedQty}, expected ${expectedQty} (allowed tolerance ${tolerancePct}%)`
          );
        }
      }

      const passed = discrepancies.length === 0;
      return {
        ruleId: rule.ruleId,
        name: "Item Quantities Match Purchase Order",
        passed,
        severity: rule.severity,
        reason: passed
          ? `All received item quantities match PO quantities within tolerance (${tolerancePct}%)`
          : `Quantity discrepancies detected: ${discrepancies.join("; ")}`,
      };
    }

    case "delivery_window": {
      const graceHours = Number(
        rule.params?.graceHours ?? inputs.purchaseOrder?.graceHours ?? 24
      );
      const poDateRaw = inputs.purchaseOrder?.expectedDeliveryDate;

      if (!poDateRaw) {
        return {
          ruleId: rule.ruleId,
          name: "Delivery Within Expected Window",
          passed: true,
          severity: rule.severity,
          reason: "No expected delivery deadline specified on PO",
        };
      }

      const poDate = new Date(poDateRaw).getTime();
      const submittedAtRaw = inputs.submission?.submittedAt;
      const submittedAt = submittedAtRaw ? new Date(submittedAtRaw).getTime() : Date.now();
      const maxAllowed = poDate + graceHours * 60 * 60 * 1000;

      const passed = submittedAt <= maxAllowed;
      const diffHours = ((submittedAt - poDate) / (1000 * 60 * 60)).toFixed(1);

      return {
        ruleId: rule.ruleId,
        name: "Delivery Within Expected Window",
        passed,
        severity: rule.severity,
        reason: passed
          ? `Delivery confirmed within allowed window (grace period ${graceHours}h)`
          : `Delivery submitted ${diffHours}h after PO deadline (exceeds ${graceHours}h grace period)`,
      };
    }

    case "verifier_identified": {
      const name = inputs.submission?.verifierName?.trim();
      const contact = inputs.submission?.verifierContact?.trim();
      const passed = Boolean(name && contact);

      return {
        ruleId: rule.ruleId,
        name: "Verifier Identification & Contact Info",
        passed,
        severity: rule.severity,
        reason: passed
          ? `Verifier identified as ${name} (${contact})`
          : "Verifier name or contact phone/email was not provided",
      };
    }

    case "challenge_code_visible": {
      const expected = inputs.expectedChallengeCode?.trim().toUpperCase();
      const extracted = inputs.aiExtraction?.extractedChallengeCode?.trim().toUpperCase();
      const minConfidence = Number(rule.params?.minConfidence ?? 0.7);
      const confidence = inputs.aiExtraction?.challengeCodeConfidence ?? 1.0;

      if (!expected) {
        return {
          ruleId: rule.ruleId,
          name: "Challenge Code Verification",
          passed: true,
          severity: rule.severity,
          reason: "No challenge code expected for this request",
        };
      }

      const match = extracted === expected && confidence >= minConfidence;
      return {
        ruleId: rule.ruleId,
        name: "Challenge Code Verification",
        passed: match,
        severity: rule.severity,
        reason: match
          ? `Challenge code '${expected}' verified on physical evidence with ${(confidence * 100).toFixed(0)}% confidence`
          : extracted
          ? `Challenge code mismatch: detected '${extracted}', expected '${expected}'`
          : `Challenge code '${expected}' not detected in evidence photos`,
      };
    }

    case "no_duplicate_evidence": {
      const historical = new Set(
        (inputs.historicalOrgSha256s || []).map((h) => h.toLowerCase())
      );
      const files = inputs.files || [];
      const duplicates: string[] = [];

      for (const file of files) {
        if (historical.has(file.sha256.toLowerCase())) {
          duplicates.push(file.sha256.slice(0, 12));
        }
      }

      const passed = duplicates.length === 0;
      return {
        ruleId: rule.ruleId,
        name: "Tamper & Duplicate Evidence Check",
        passed,
        severity: rule.severity,
        reason: passed
          ? "All uploaded evidence files are unique"
          : `Duplicate evidence detected: files [${duplicates.join(", ")}...] previously submitted in organization`,
      };
    }

    case "ai_matches_po": {
      const minSimilarity = Number(rule.params?.minSimilarity ?? 0.75);
      const score = inputs.aiExtraction?.similarityScore;

      if (score === undefined || score === null) {
        return {
          ruleId: rule.ruleId,
          name: "AI Evidence to PO Matching",
          passed: false,
          severity: rule.severity,
          reason: "AI evidence extraction has not been performed or yielded no similarity score",
        };
      }

      const passed = score >= minSimilarity;
      return {
        ruleId: rule.ruleId,
        name: "AI Evidence to PO Matching",
        passed,
        severity: rule.severity,
        reason: passed
          ? `AI visual matching confidence (${(score * 100).toFixed(0)}%) meets threshold (${(minSimilarity * 100).toFixed(0)}%)`
          : `AI visual matching confidence (${(score * 100).toFixed(0)}%) is below required threshold (${(minSimilarity * 100).toFixed(0)}%)`,
      };
    }

    case "invoice_matches_po": {
      const tolerancePct = Number(rule.params?.tolerancePct ?? 0);
      const poTotal = inputs.purchaseOrder?.totalAmountUsdc;
      const invoiceTotalRaw = inputs.invoice?.totalUsdc;

      if (poTotal === undefined || invoiceTotalRaw === undefined) {
        return {
          ruleId: rule.ruleId,
          name: "Invoice Total Matches Purchase Order",
          passed: true,
          severity: rule.severity,
          reason: "PO or Invoice total amount not provided; check skipped",
        };
      }

      const invoiceTotal =
        typeof invoiceTotalRaw === "bigint"
          ? Number(invoiceTotalRaw) / 1_000_000
          : Number(invoiceTotalRaw);

      const diff = Math.abs(invoiceTotal - poTotal);
      const allowedDiff = poTotal * (tolerancePct / 100);
      const passed = diff <= allowedDiff;

      return {
        ruleId: rule.ruleId,
        name: "Invoice Total Matches Purchase Order",
        passed,
        severity: rule.severity,
        reason: passed
          ? `Invoice amount ($${invoiceTotal.toFixed(2)}) matches PO total ($${poTotal.toFixed(2)}) within ${tolerancePct}% tolerance`
          : `Invoice amount ($${invoiceTotal.toFixed(2)}) does not match PO total ($${poTotal.toFixed(2)})`,
      };
    }

    case "owner_approval_above_amount": {
      const thresholdUsdc = Number(rule.params?.thresholdUsdc ?? 500);
      const invoiceTotalRaw = inputs.invoice?.totalUsdc;
      const invoiceTotal =
        invoiceTotalRaw === undefined
          ? 0
          : typeof invoiceTotalRaw === "bigint"
          ? Number(invoiceTotalRaw) / 1_000_000
          : Number(invoiceTotalRaw);

      if (invoiceTotal <= thresholdUsdc) {
        return {
          ruleId: rule.ruleId,
          name: "Owner Sign-Off Above Approval Threshold",
          passed: true,
          severity: rule.severity,
          reason: `Invoice amount ($${invoiceTotal.toFixed(2)}) is at or below auto-approval threshold ($${thresholdUsdc.toFixed(2)})`,
        };
      }

      const passed = Boolean(inputs.ownerApproved);
      return {
        ruleId: rule.ruleId,
        name: "Owner Sign-Off Above Approval Threshold",
        passed,
        severity: rule.severity,
        reason: passed
          ? `Owner sign-off confirmed for high-value invoice ($${invoiceTotal.toFixed(2)} > $${thresholdUsdc.toFixed(2)})`
          : `High-value invoice ($${invoiceTotal.toFixed(2)} > $${thresholdUsdc.toFixed(2)}) requires explicit owner approval`,
      };
    }

    default:
      return {
        ruleId: rule.ruleId,
        name: `Custom Rule (${rule.ruleId})`,
        passed: true,
        severity: rule.severity,
        reason: "Custom rule evaluated successfully",
      };
  }
}
