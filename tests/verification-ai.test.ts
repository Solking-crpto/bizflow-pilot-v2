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

  it("enforces daily budget limit when AI is configured without fabricating data", async () => {
    const origKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = "test_vision_api_key";
      const res = await assessEvidence({
        expectedChallengeCode: "X4Y7",
        forceBudgetExceededForTest: true,
      });

      expect(res.budgetExceeded).toBe(true);
      expect(res.aiConfigured).toBe(true);
      expect(res.assessment).toBeNull();
    } finally {
      if (origKey) process.env.GEMINI_API_KEY = origKey;
      else delete process.env.GEMINI_API_KEY;
    }
  });

  it("works reliably in zero-API-key environment by returning null extraction and unconfigured state", async () => {
    const origGoogle = process.env.GOOGLE_API_KEY;
    const origGemini = process.env.GEMINI_API_KEY;
    const origAnthropic = process.env.ANTHROPIC_API_KEY;
    try {
      delete process.env.GOOGLE_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const res = await assessEvidence({
        expectedChallengeCode: "TEST",
        purchaseOrderItems: [{ description: "Solar Inverter 5kW", quantity: 2 }],
      });

      expect(res.budgetExceeded).toBe(false);
      expect(res.aiConfigured).toBe(false);
      expect(res.modelUsed).toBe("none");
      expect(res.assessment).toBeNull();
    } finally {
      if (origGoogle) process.env.GOOGLE_API_KEY = origGoogle;
      if (origGemini) process.env.GEMINI_API_KEY = origGemini;
      if (origAnthropic) process.env.ANTHROPIC_API_KEY = origAnthropic;
    }
  });
});
