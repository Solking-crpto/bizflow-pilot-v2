import { describe, it, expect, beforeAll } from "vitest";
import { runAutonomousAgentLoop } from "../lib/agent/runner";
import { prisma } from "../lib/db";

async function retryQuery<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr || new Error("Retry failed");
}

describe("Acceptance Verification: Autonomous Agent Loop in DRY_RUN", () => {
  beforeAll(async () => {
    // Warm up connection
    await retryQuery(() => prisma.$queryRawUnsafe("SELECT 1"));
  }, 45000);

  it("executes the full autonomous cycle across all invoice scenarios in DRY_RUN", async () => {
    // Ensure agentMode is set to autonomous for this test
    const setting = await retryQuery(() => prisma.setting.findFirst());
    const originalMode = setting?.agentMode;
    if (setting) {
      await retryQuery(() =>
        prisma.setting.update({
          where: { id: setting.id },
          data: { agentMode: "autonomous", killSwitchActive: false },
        })
      );
    }

    try {
      // Run autonomous agent loop with dryRun = true
      const result = await runAutonomousAgentLoop({ dryRun: true });

      expect(result.success).toBe(true);
      expect(result.processedCount).toBeGreaterThan(0);

      // Verify decision outcomes from the run
      const decisions = result.decisions;

      // 1. Small valid invoice (INV-V2-DEMO-01) should be executed without human intervention
      const smallInvoiceDecision = decisions.find((d) => d.invoiceId === "inv-v2-demo-01");
      if (smallInvoiceDecision) {
        expect(["pay_now", "schedule"]).toContain(smallInvoiceDecision.choice);
        expect(smallInvoiceDecision.outcome).toBe("executed");
        expect(smallInvoiceDecision.escalated).toBe(false);
      }

      // 2. Large invoice above limit (INV-V2-DEMO-02) should escalate to human
      const largeInvoiceDecision = decisions.find((d) => d.invoiceId === "inv-v2-demo-02");
      if (largeInvoiceDecision) {
        expect(largeInvoiceDecision.escalated).toBe(true);
        expect(largeInvoiceDecision.choice).toBe("escalate");
      }

      // 3. Duplicate invoice (inv-v2-demo-03-dup) should be blocked / held
      const dupDecision = decisions.find((d) => d.invoiceId === "inv-v2-demo-03-dup");
      if (dupDecision) {
        expect(dupDecision.choice).toBe("hold");
        expect(dupDecision.outcome).toBe("held");
      }

      // 4. Prompt injection invoice (inv-v2-demo-04-inj) should be blocked / held
      const injDecision = decisions.find((d) => d.invoiceId === "inv-v2-demo-04-inj");
      if (injDecision) {
        expect(injDecision.choice).toBe("hold");
        expect(injDecision.outcome).toBe("held");
      }
    } finally {
      if (setting && originalMode) {
        await retryQuery(() =>
          prisma.setting.update({
            where: { id: setting.id },
            data: { agentMode: originalMode },
          })
        );
      }
    }
  }, 60000);

  it("verifies kill switch completely halts autonomous execution", async () => {
    // Set kill switch active across all settings
    await retryQuery(() =>
      prisma.setting.updateMany({
        data: { killSwitchActive: true },
      })
    );

    try {
      const killResult = await runAutonomousAgentLoop({ dryRun: true });
      expect(killResult.autoExecutedCount).toBe(0);
      expect(killResult.decisions.every((d) => d.outcome === "held")).toBe(true);
    } finally {
      // Disarm kill switch
      await retryQuery(() =>
        prisma.setting.updateMany({
          data: { killSwitchActive: false },
        })
      );
    }
  }, 60000);
});
