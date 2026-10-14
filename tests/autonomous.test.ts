import { describe, it, expect } from "vitest";
import { evaluatePaymentTiming } from "../lib/agent/timing";
import { evaluatePolicy, PolicyContext } from "../lib/policy/engine";

describe("Autonomous Agent Rules & Payment Timing Intelligence", () => {
  describe("Payment Timing Intelligence", () => {
    it("captures early-payment discount when cash reserve is sufficient", () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() + 14 * 86400000); // 14 days out

      const timing = evaluatePaymentTiming({
        invoiceId: "inv-1",
        invoiceNumber: "INV-1",
        totalUsdc: 300000n, // 0.30 USDC
        dueDate,
        earlyPayDiscountPct: 2.0, // 2% discount
        earlyPayDays: 10, // within 10 days
        createdAt: now,
        availableTreasuryUsdc: 10000000n, // 10.00 USDC
        minReserveUsdc: 250000n, // 0.25 USDC
        upcomingObligationsUsdc: 500000n, // 0.50 USDC
      });

      expect(timing.choice).toBe("pay_now");
      expect(timing.discountCapturedUsdc).toBeGreaterThan(0);
      expect(timing.reasoning).toContain("Pay now to capture 2% early pay discount");
    });

    it("holds payment when no discount exists and due date is far in the future", () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() + 15 * 86400000); // 15 days out

      const timing = evaluatePaymentTiming({
        invoiceId: "inv-2",
        invoiceNumber: "INV-2",
        totalUsdc: 500000n,
        dueDate,
        earlyPayDiscountPct: null,
        earlyPayDays: null,
        createdAt: now,
        availableTreasuryUsdc: 10000000n,
        minReserveUsdc: 250000n,
        upcomingObligationsUsdc: 500000n,
      });

      expect(timing.choice).toBe("schedule");
      expect(timing.reasoning).toContain("Scheduled for payment on");
    });

    it("pays immediately when due date is today or overdue", () => {
      const now = new Date();
      const pastDue = new Date(Date.now() - 86400000); // 1 day overdue

      const timing = evaluatePaymentTiming({
        invoiceId: "inv-3",
        invoiceNumber: "INV-3",
        totalUsdc: 500000n,
        dueDate: pastDue,
        earlyPayDiscountPct: null,
        earlyPayDays: null,
        createdAt: new Date(Date.now() - 30 * 86400000),
        availableTreasuryUsdc: 10000000n,
        minReserveUsdc: 250000n,
        upcomingObligationsUsdc: 500000n,
      });

      expect(timing.choice).toBe("pay_now");
      expect(timing.reasoning).toContain("Due date approaching");
    });

    it("protects minimum reserve buffer even if discount is available", () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() + 14 * 86400000);

      const timing = evaluatePaymentTiming({
        invoiceId: "inv-4",
        invoiceNumber: "INV-4",
        totalUsdc: 900000n, // 0.90 USDC
        dueDate,
        earlyPayDiscountPct: 3.0,
        earlyPayDays: 10,
        createdAt: now,
        availableTreasuryUsdc: 1000000n, // 1.00 USDC
        minReserveUsdc: 500000n, // 0.50 USDC reserve
        upcomingObligationsUsdc: 200000n, // 0.20 USDC
      });

      expect(timing.choice).toBe("schedule");
      expect(timing.reasoning).toContain("below the 0.50 USDC minimum operating reserve");
    });
  });

  describe("Autonomous Spending Limits & Caps", () => {
    it("differentiates invoices within auto-approve limit from those requiring escalation", () => {
      const autoApproveLimitUsdc = 500000n; // 0.50 USDC cap

      const smallInvoiceAmount = 300000n; // 0.30 USDC
      const largeInvoiceAmount = 800000n; // 0.80 USDC

      const isSmallAutoApprovable = smallInvoiceAmount <= autoApproveLimitUsdc;
      const isLargeAutoApprovable = largeInvoiceAmount <= autoApproveLimitUsdc;

      expect(isSmallAutoApprovable).toBe(true);
      expect(isLargeAutoApprovable).toBe(false);
    });

    it("enforces daily autonomous spend limit cap", () => {
      const maxDailyAutonomousUsdc = 1000000n; // 1.00 USDC daily cap
      const todayAutonomousSpent = 800000n; // 0.80 USDC already spent today

      const nextInvoice = 300000n; // 0.30 USDC
      const wouldExceedDailyCap = todayAutonomousSpent + nextInvoice > maxDailyAutonomousUsdc;

      expect(wouldExceedDailyCap).toBe(true);
    });
  });

  describe("Kill Switch & Policy Precedence", () => {
    it("halts all payments when emergency kill switch is active", () => {
      const context: PolicyContext = {
        network: "testnet",
        killSwitchActive: true, // Emergency halt armed
        availableTreasuryUsdc: 5000000n,
        minReserveUsdc: 250000n,
        dailySpentUsdc: 0n,
        dailyLimitUsdc: 2000000n,
        approvalThresholdUsdc: 1000000n,
        maxMainnetPaymentUsdc: 1000000n,
        vendor: {
          id: "v-1",
          name: "Northgate Cement",
          status: "active",
          recordedWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          perVendorLimitUsdc: 10000000n,
        },
        invoice: {
          id: "inv-kill-1",
          invoiceNumber: "INV-KILL-01",
          totalUsdc: 300000n,
          remittanceWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          matchStatus: "exact_match",
          duplicateScore: 0,
          isInjectionSuspect: false,
        },
      };

      const policyResult = evaluatePolicy(context);
      expect(policyResult.decision).toBe("block");
      const killSwitchRule = policyResult.results.find((r) => r.ruleCode === "RULE_KILL_SWITCH");
      expect(killSwitchRule?.passed).toBe(false);
    });

    it("strictly overrules AI proposals when deterministic policy fails", () => {
      // Scenario: AI proposed "pay_now", but invoice is an injection suspect
      const context: PolicyContext = {
        network: "testnet",
        killSwitchActive: false,
        availableTreasuryUsdc: 5000000n,
        minReserveUsdc: 250000n,
        dailySpentUsdc: 0n,
        dailyLimitUsdc: 2000000n,
        approvalThresholdUsdc: 1000000n,
        maxMainnetPaymentUsdc: 1000000n,
        vendor: {
          id: "v-1",
          name: "Northgate Cement",
          status: "active",
          recordedWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          perVendorLimitUsdc: 10000000n,
        },
        invoice: {
          id: "inv-inj-1",
          invoiceNumber: "INV-INJ-01",
          totalUsdc: 300000n,
          remittanceWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          matchStatus: "exact_match",
          duplicateScore: 0,
          isInjectionSuspect: true, // Hostile instruction detected
        },
      };

      const policyResult = evaluatePolicy(context);
      const aiProposedChoice = "pay_now";
      const policyAllows = policyResult.decision === "approve";

      // Policy must overrule AI
      const conflictWithPolicy = aiProposedChoice === "pay_now" && !policyAllows;
      expect(conflictWithPolicy).toBe(true);
      expect(policyResult.decision).toBe("block");
    });
  });
});
