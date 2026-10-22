import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { assessEvidence } from "../lib/verification/ai";
import {
  evaluate,
  DEFAULT_CONDITION_RULES,
  VerificationEvaluationInput,
} from "../lib/verification/conditions";

describe("AI Honesty & Zero-Simulation Invariant Tests", () => {
  const origGoogle = process.env.GOOGLE_API_KEY;
  const origGemini = process.env.GEMINI_API_KEY;
  const origAnthropic = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterAll(() => {
    if (origGoogle) process.env.GOOGLE_API_KEY = origGoogle;
    if (origGemini) process.env.GEMINI_API_KEY = origGemini;
    if (origAnthropic) process.env.ANTHROPIC_API_KEY = origAnthropic;
  });

  it("1. Runtime returns null extraction when no vision LLM key is configured", async () => {
    const input = {
      expectedChallengeCode: "ABCD",
      purchaseOrderItems: [
        { description: "Portland Cement Type I", quantity: 50 },
        { description: "Rebar Steel 12mm", quantity: 20 },
      ],
      mediaUrlsOrBase64: ["data:image/jpeg;base64,sample123"],
    };

    const res = await assessEvidence(input);

    // Strict assertions: runtime MUST NOT synthesize or copy PO items into AI output
    expect(res.assessment).toBeNull();
    expect(res.aiConfigured).toBe(false);
    expect(res.modelUsed).toBe("none");
    expect(res.budgetExceeded).toBe(false);
  });

  it("2. Fails if runtime ever returns made-up or rule-derived data labelled as AI", async () => {
    const testPoItems = [{ description: "Concrete Blocks", quantity: 100 }];
    const testCode = "W9X2";

    const res = await assessEvidence({
      expectedChallengeCode: testCode,
      purchaseOrderItems: testPoItems,
    });

    if (res.assessment !== null) {
      // If assessment is non-null without configured keys, fail immediately
      const anyDerivedItems = (res.assessment as any).itemsObserved?.some(
        (item: any) => item.description === "Concrete Blocks"
      );
      const anyDerivedCode = (res.assessment as any).extractedChallengeCode === testCode;
      if (anyDerivedItems || anyDerivedCode) {
        throw new Error(
          "AI Honesty Invariant Violated: Runtime returned synthetic or rule-derived data labelled as AI!"
        );
      }
    }

    expect(res.assessment).toBeNull();
  });

  it("3. Rules needing AI show 'needs review: AI not configured' when AI is unconfigured", () => {
    const evalInput: VerificationEvaluationInput = {
      files: [{ sha256: "testfilehash123", kind: "photo" }],
      historicalOrgSha256s: [],
      expectedChallengeCode: "ABCD",
      aiExtraction: {
        extractedChallengeCode: undefined,
        challengeCodeConfidence: 0,
        similarityScore: undefined,
        extractedItems: [],
        aiConfigured: false,
      },
    };

    const evaluation = evaluate(evalInput, [
      { ruleId: "challenge_code_visible", severity: "warn" },
      { ruleId: "ai_matches_po", severity: "warn" },
    ]);

    const challengeRule = evaluation.ruleResults.find(
      (r) => r.ruleId === "challenge_code_visible"
    );
    expect(challengeRule).toBeDefined();
    expect(challengeRule?.passed).toBe(false);
    expect(challengeRule?.reason).toBe("needs review: AI not configured");

    const matchRule = evaluation.ruleResults.find((r) => r.ruleId === "ai_matches_po");
    expect(matchRule).toBeDefined();
    expect(matchRule?.passed).toBe(false);
    expect(matchRule?.reason).toBe("needs review: AI not configured");

    // Overall status must be needs_review
    expect(evaluation.overall).toBe("needs_review");
  });

  it("4. Evaluates default rules with unconfigured AI to overall 'needs_review'", () => {
    const evalInput: VerificationEvaluationInput = {
      files: [{ sha256: "unique-sha256-hex-123", kind: "photo" }],
      historicalOrgSha256s: [],
      expectedChallengeCode: "XYZ9",
      submission: {
        receivedQuantities: { "Steel Beam": 5 },
        verifierName: "Amara Okonkwo",
        verifierContact: "+234 803 123 4567",
      },
      purchaseOrder: {
        items: [{ description: "Steel Beam", quantity: 5 }],
      },
      aiExtraction: {
        aiConfigured: false,
      },
    };

    const evaluation = evaluate(evalInput, DEFAULT_CONDITION_RULES);

    // Min files, required kinds, verifier identified, quantities match, no duplicate should PASS
    expect(evaluation.ruleResults.find((r) => r.ruleId === "min_files")?.passed).toBe(true);
    expect(evaluation.ruleResults.find((r) => r.ruleId === "required_kinds")?.passed).toBe(true);
    expect(evaluation.ruleResults.find((r) => r.ruleId === "verifier_identified")?.passed).toBe(true);
    expect(evaluation.ruleResults.find((r) => r.ruleId === "quantities_match")?.passed).toBe(true);
    expect(evaluation.ruleResults.find((r) => r.ruleId === "no_duplicate_evidence")?.passed).toBe(true);

    // challenge_code_visible should be needs review: AI not configured
    const challengeRule = evaluation.ruleResults.find(
      (r) => r.ruleId === "challenge_code_visible"
    );
    expect(challengeRule?.passed).toBe(false);
    expect(challengeRule?.reason).toBe("needs review: AI not configured");

    // Overall must be needs_review, allowing owner human inspection
    expect(evaluation.overall).toBe("needs_review");
  });

  it("5. Duplicate evidence rule explicitly specifies SHA-256 exact byte match limit", () => {
    const evalInput: VerificationEvaluationInput = {
      files: [{ sha256: "duplicate-hash-abc", kind: "photo" }],
      historicalOrgSha256s: ["duplicate-hash-abc"],
    };

    const evaluation = evaluate(evalInput, [
      { ruleId: "no_duplicate_evidence", severity: "block" },
    ]);

    const dupRule = evaluation.ruleResults[0];
    expect(dupRule.passed).toBe(false);
    expect(dupRule.name).toContain("SHA-256");
    expect(dupRule.reason).toContain("catches exact byte copies only");
  });
});
