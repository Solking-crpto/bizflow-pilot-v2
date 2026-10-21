import { describe, it, expect } from "vitest";
import {
  evaluate,
  DEFAULT_CONDITION_RULES,
  ConditionRuleConfig,
  VerificationEvaluationInput,
} from "../lib/verification/conditions";

describe("Phase 5: Conditions Engine & Truth Table Unit Tests", () => {
  describe("Rule 1: min_files", () => {
    it("fails when attached files count is below minCount", () => {
      const inputs: VerificationEvaluationInput = {
        files: [{ sha256: "hash1", kind: "photo" }],
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "min_files", severity: "block", params: { minCount: 2 } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("failed");
      expect(res.ruleResults[0].passed).toBe(false);
      expect(res.ruleResults[0].reason).toContain("Insufficient evidence");
    });

    it("passes when attached files count equals or exceeds minCount", () => {
      const inputs: VerificationEvaluationInput = {
        files: [
          { sha256: "hash1", kind: "photo" },
          { sha256: "hash2", kind: "photo" },
        ],
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "min_files", severity: "block", params: { minCount: 2 } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("ready");
      expect(res.ruleResults[0].passed).toBe(true);
    });
  });

  describe("Rule 2: required_kinds", () => {
    it("fails when a required kind is missing", () => {
      const inputs: VerificationEvaluationInput = {
        files: [{ sha256: "hash1", kind: "photo" }],
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "required_kinds", severity: "block", params: { kinds: ["photo", "document"] } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("failed");
      expect(res.ruleResults[0].passed).toBe(false);
      expect(res.ruleResults[0].reason).toContain("Missing required evidence types: [document]");
    });

    it("passes when all required kinds are present (treating pdf as document)", () => {
      const inputs: VerificationEvaluationInput = {
        files: [
          { sha256: "hash1", kind: "photo" },
          { sha256: "hash2", kind: "pdf" },
        ],
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "required_kinds", severity: "block", params: { kinds: ["photo", "document"] } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("ready");
      expect(res.ruleResults[0].passed).toBe(true);
    });
  });

  describe("Rule 3: quantities_match", () => {
    const poItems = [
      { description: "Cement Bags (50kg)", quantity: 100 },
      { description: "Steel Rods (12mm)", quantity: 50 },
    ];

    it("passes when received quantities exactly match PO items", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        purchaseOrder: { items: poItems },
        submission: {
          receivedQuantities: {
            "Cement Bags (50kg)": 100,
            "Steel Rods (12mm)": 50,
          },
        },
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "quantities_match", severity: "warn", params: { tolerancePct: 0 } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("ready");
      expect(res.ruleResults[0].passed).toBe(true);
    });

    it("passes when received quantity is within allowed tolerance", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        purchaseOrder: { items: poItems },
        submission: {
          receivedQuantities: {
            "Cement Bags (50kg)": 98, // 2% diff
            "Steel Rods (12mm)": 50,
          },
        },
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "quantities_match", severity: "warn", params: { tolerancePct: 5 } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("ready");
      expect(res.ruleResults[0].passed).toBe(true);
    });

    it("fails (needs_review) when received quantity exceeds tolerance", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        purchaseOrder: { items: poItems },
        submission: {
          receivedQuantities: {
            "Cement Bags (50kg)": 80, // 20% diff
            "Steel Rods (12mm)": 50,
          },
        },
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "quantities_match", severity: "warn", params: { tolerancePct: 5 } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("needs_review");
      expect(res.ruleResults[0].passed).toBe(false);
      expect(res.ruleResults[0].reason).toContain("Quantity discrepancies detected");
    });
  });

  describe("Rule 4: delivery_window", () => {
    const deadline = new Date("2026-10-20T12:00:00Z");

    it("passes when submission is on or before expected delivery date", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        purchaseOrder: { expectedDeliveryDate: deadline, graceHours: 12 },
        submission: { submittedAt: new Date("2026-10-20T10:00:00Z") },
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "delivery_window", severity: "warn", params: { graceHours: 12 } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("ready");
      expect(res.ruleResults[0].passed).toBe(true);
    });

    it("passes when submission is within the grace window", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        purchaseOrder: { expectedDeliveryDate: deadline, graceHours: 12 },
        submission: { submittedAt: new Date("2026-10-20T18:00:00Z") }, // 6 hours after deadline
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "delivery_window", severity: "warn", params: { graceHours: 12 } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("ready");
      expect(res.ruleResults[0].passed).toBe(true);
    });

    it("fails when submission is past the grace window", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        purchaseOrder: { expectedDeliveryDate: deadline, graceHours: 12 },
        submission: { submittedAt: new Date("2026-10-21T06:00:00Z") }, // 18 hours after deadline
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "delivery_window", severity: "warn", params: { graceHours: 12 } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("needs_review");
      expect(res.ruleResults[0].passed).toBe(false);
      expect(res.ruleResults[0].reason).toContain("Delivery submitted 18.0h after PO deadline");
    });
  });

  describe("Rule 5: verifier_identified", () => {
    it("passes when verifier name and contact are provided", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        submission: { verifierName: "John Doe", verifierContact: "+1234567890" },
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "verifier_identified", severity: "warn" },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("ready");
      expect(res.ruleResults[0].passed).toBe(true);
    });

    it("fails when verifier contact is missing", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        submission: { verifierName: "John Doe", verifierContact: "" },
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "verifier_identified", severity: "warn" },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("needs_review");
      expect(res.ruleResults[0].passed).toBe(false);
    });
  });

  describe("Rule 6: challenge_code_visible", () => {
    it("passes when AI extracted code matches expected challenge code", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        expectedChallengeCode: "ABCD",
        aiExtraction: {
          extractedChallengeCode: "ABCD",
          challengeCodeConfidence: 0.95,
        },
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "challenge_code_visible", severity: "warn" },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("ready");
      expect(res.ruleResults[0].passed).toBe(true);
    });

    it("fails when extracted code does not match expected", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        expectedChallengeCode: "ABCD",
        aiExtraction: {
          extractedChallengeCode: "WXYZ",
          challengeCodeConfidence: 0.9,
        },
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "challenge_code_visible", severity: "warn" },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("needs_review");
      expect(res.ruleResults[0].passed).toBe(false);
      expect(res.ruleResults[0].reason).toContain("Challenge code mismatch");
    });
  });

  describe("Rule 7: no_duplicate_evidence", () => {
    it("passes when all file sha256 hashes are novel", () => {
      const inputs: VerificationEvaluationInput = {
        files: [{ sha256: "new-hash-1", kind: "photo" }],
        historicalOrgSha256s: ["old-hash-1", "old-hash-2"],
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "no_duplicate_evidence", severity: "block" },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("ready");
      expect(res.ruleResults[0].passed).toBe(true);
    });

    it("blocks when a file sha256 has already been uploaded previously", () => {
      const inputs: VerificationEvaluationInput = {
        files: [{ sha256: "duplicate-hash-123456", kind: "photo" }],
        historicalOrgSha256s: ["duplicate-hash-123456", "other-hash"],
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "no_duplicate_evidence", severity: "block" },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("failed");
      expect(res.ruleResults[0].passed).toBe(false);
      expect(res.ruleResults[0].reason).toContain("Duplicate evidence detected");
    });
  });

  describe("Rule 8: ai_matches_po", () => {
    it("passes when AI similarity score meets or exceeds threshold", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        aiExtraction: { similarityScore: 0.88 },
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "ai_matches_po", severity: "warn", params: { minSimilarity: 0.75 } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("ready");
      expect(res.ruleResults[0].passed).toBe(true);
    });

    it("fails when AI similarity score is below threshold", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        aiExtraction: { similarityScore: 0.6 },
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "ai_matches_po", severity: "warn", params: { minSimilarity: 0.75 } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("needs_review");
      expect(res.ruleResults[0].passed).toBe(false);
    });
  });

  describe("Rule 9: invoice_matches_po", () => {
    it("passes when invoice total equals PO total", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        purchaseOrder: { totalAmountUsdc: 1500 },
        invoice: { totalUsdc: BigInt(1500_000000) },
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "invoice_matches_po", severity: "block" },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("ready");
      expect(res.ruleResults[0].passed).toBe(true);
    });

    it("fails when invoice total diverges from PO total", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        purchaseOrder: { totalAmountUsdc: 1500 },
        invoice: { totalUsdc: BigInt(1800_000000) },
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "invoice_matches_po", severity: "block" },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("failed");
      expect(res.ruleResults[0].passed).toBe(false);
    });
  });

  describe("Rule 10: owner_approval_above_amount", () => {
    it("passes automatically when invoice amount is below threshold", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        invoice: { totalUsdc: BigInt(250_000000) }, // $250
        ownerApproved: false,
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "owner_approval_above_amount", severity: "block", params: { thresholdUsdc: 500 } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("ready");
      expect(res.ruleResults[0].passed).toBe(true);
    });

    it("fails when invoice amount exceeds threshold and owner has not approved", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        invoice: { totalUsdc: BigInt(1200_000000) }, // $1,200
        ownerApproved: false,
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "owner_approval_above_amount", severity: "block", params: { thresholdUsdc: 500 } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("failed");
      expect(res.ruleResults[0].passed).toBe(false);
      expect(res.ruleResults[0].reason).toContain("requires explicit owner approval");
    });

    it("passes when invoice amount exceeds threshold and owner has approved", () => {
      const inputs: VerificationEvaluationInput = {
        files: [],
        invoice: { totalUsdc: BigInt(1200_000000) },
        ownerApproved: true,
      };
      const rules: ConditionRuleConfig[] = [
        { ruleId: "owner_approval_above_amount", severity: "block", params: { thresholdUsdc: 500 } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("ready");
      expect(res.ruleResults[0].passed).toBe(true);
    });
  });

  describe("Overall Status Hierarchy Truth Table", () => {
    const inputs: VerificationEvaluationInput = { files: [] };

    it("results in 'failed' if any block rule fails, even if warn rules pass", () => {
      const rules: ConditionRuleConfig[] = [
        { ruleId: "min_files", severity: "block", params: { minCount: 5 } }, // fails (block)
        { ruleId: "verifier_identified", severity: "warn" }, // fails (warn)
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("failed");
    });

    it("results in 'needs_review' if only warn rules fail and all block rules pass", () => {
      const rules: ConditionRuleConfig[] = [
        { ruleId: "min_files", severity: "block", params: { minCount: 0 } }, // passes (block)
        { ruleId: "verifier_identified", severity: "warn" }, // fails (warn)
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("needs_review");
    });

    it("results in 'ready' if all rules pass", () => {
      const rules: ConditionRuleConfig[] = [
        { ruleId: "min_files", severity: "block", params: { minCount: 0 } },
      ];
      const res = evaluate(inputs, rules);
      expect(res.overall).toBe("ready");
    });
  });
});
