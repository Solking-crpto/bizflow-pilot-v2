import { describe, it, expect, beforeEach } from "vitest";
import {
  assessEvidence,
  generateDeterministicAssessment,
  VerificationAiAssessmentSchema,
  DISCLAIMER_TEXT,
  resetDailyBudgetForTesting,
  getDailyCallBudget,
} from "../lib/verification/ai";

describe("Phase 6: AI Evidence Assessment (Advisory Only)", () => {
  beforeEach(() => {
    resetDailyBudgetForTesting();
  });

  it("validates that structured output complies with strict Zod schema", () => {
    const assessment = generateDeterministicAssessment({
      expectedChallengeCode: "T9K2",
      purchaseOrderItems: [
        { description: "Reinforced Rebar #4", quantity: 200 },
      ],
    });

    const parsed = VerificationAiAssessmentSchema.parse(assessment);
    expect(parsed.extractedChallengeCode).toBe("T9K2");
    expect(parsed.challengeCodeConfidence).toBeGreaterThanOrEqual(0.9);
    expect(parsed.itemsObserved).toHaveLength(1);
    expect(parsed.itemsObserved[0].description).toBe("Reinforced Rebar #4");
    expect(parsed.itemsObserved[0].estimatedQuantity).toBe(200);
    expect(parsed.disclaimer).toBe(DISCLAIMER_TEXT);
  });

  it("enforces mandatory disclaimer exact wording", () => {
    const invalid = {
      extractedChallengeCode: "T9K2",
      challengeCodeConfidence: 0.9,
      itemsObserved: [],
      packagingNotes: "Notes",
      anomalies: [],
      overallMatchConfidence: 0.9,
      disclaimer: "Legal certified audit proof", // Wrong disclaimer!
    };

    expect(() => VerificationAiAssessmentSchema.parse(invalid)).toThrow();
  });

  it("falls back gracefully when daily budget limit is reached", async () => {
    const res = await assessEvidence({
      expectedChallengeCode: "X4Y7",
      forceBudgetExceededForTest: true,
    });

    expect(res.budgetExceeded).toBe(true);
    expect(res.assessment.anomalies).toContain(
      "Daily AI assessment budget exceeded; manual review required"
    );
    expect(res.assessment.disclaimer).toBe(DISCLAIMER_TEXT);
  });

  it("works reliably in zero-API-key environment without errors", async () => {
    const res = await assessEvidence({
      expectedChallengeCode: "TEST",
      purchaseOrderItems: [{ description: "Solar Inverter 5kW", quantity: 2 }],
    });

    expect(res.budgetExceeded).toBe(false);
    expect(res.assessment.extractedChallengeCode).toBe("TEST");
    expect(res.assessment.overallMatchConfidence).toBeGreaterThanOrEqual(0.9);
    expect(res.assessment.itemsObserved[0].description).toBe("Solar Inverter 5kW");
  });
});
