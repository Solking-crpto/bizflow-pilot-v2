import { describe, it, expect } from "vitest";
import { evaluatePolicy, PolicyContext } from "../lib/policy/engine";
import { parseUsdc } from "../lib/money";

describe("lib/policy/engine - 10 Deterministic Policy Rules", () => {
  const baseContext: PolicyContext = {
    network: "testnet",
    killSwitchActive: false,
    availableTreasuryUsdc: parseUsdc("100000.00"),
    minReserveUsdc: parseUsdc("2000.00"),
    dailySpentUsdc: parseUsdc("1000.00"),
    dailyLimitUsdc: parseUsdc("20000.00"),
    approvalThresholdUsdc: parseUsdc("5000.00"),
    maxMainnetPaymentUsdc: parseUsdc("1.00"),
    hasOwnerConfirmation: true,

    vendor: {
      id: "vendor-dangote",
      name: "Dangote Cement Distribution",
      status: "active",
      recordedWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      perVendorLimitUsdc: parseUsdc("15000.00"),
      walletCooldownUntil: null,
    },

    invoice: {
      id: "inv-401",
      invoiceNumber: "INV-DANGOTE-401",
      totalUsdc: parseUsdc("1700.00"),
      remittanceWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      matchStatus: "exact_match",
      duplicateScore: 0,
      isInjectionSuspect: false,
      hasExistingPaymentForNetwork: false,
      isHumanApproved: false,
    },
  };

  it("RULE 1-10: Approves clean golden path invoice", () => {
    const evalResult = evaluatePolicy(baseContext);
    expect(evalResult.decision).toBe("approve");
    expect(evalResult.results.every((r) => r.passed)).toBe(true);
    expect(evalResult.decisionHash).toBeDefined();
  });

  it("RULE 1: Blocks payment if vendor is not active", () => {
    const ctx = {
      ...baseContext,
      vendor: { ...baseContext.vendor, status: "suspended" },
    };
    const res = evaluatePolicy(ctx);
    expect(res.decision).toBe("block");
    const r1 = res.results.find((r) => r.ruleCode === "RULE_VENDOR_ACTIVE");
    expect(r1?.passed).toBe(false);
  });

  it("RULE 2: Blocks payment if remittance wallet does not match authorized vendor wallet", () => {
    const ctx = {
      ...baseContext,
      invoice: {
        ...baseContext.invoice,
        remittanceWallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Attacker address
      },
    };
    const res = evaluatePolicy(ctx);
    expect(res.decision).toBe("block");
    const r2 = res.results.find((r) => r.ruleCode === "RULE_WALLET_AUTHENTICITY");
    expect(r2?.passed).toBe(false);
  });

  it("RULE 3: Routes to human review if 3-way match has quantity or price discrepancy", () => {
    const ctx = {
      ...baseContext,
      invoice: {
        ...baseContext.invoice,
        matchStatus: "qty_mismatch",
      },
    };
    const res = evaluatePolicy(ctx);
    expect(res.decision).toBe("review");
    const r3 = res.results.find((r) => r.ruleCode === "RULE_3WAY_MATCH");
    expect(r3?.passed).toBe(false);
  });

  it("RULE 4: Blocks duplicate invoices or prompt-injection attempts", () => {
    // Duplicate test
    const dupCtx = {
      ...baseContext,
      invoice: { ...baseContext.invoice, duplicateScore: 95 },
    };
    expect(evaluatePolicy(dupCtx).decision).toBe("block");

    // Injection test
    const injectCtx = {
      ...baseContext,
      invoice: { ...baseContext.invoice, isInjectionSuspect: true },
    };
    expect(evaluatePolicy(injectCtx).decision).toBe("block");
  });

  it("RULE 5: Blocks amounts exceeding vendor limits or daily caps", () => {
    const ctx = {
      ...baseContext,
      invoice: { ...baseContext.invoice, totalUsdc: parseUsdc("25000.00") }, // Exceeds 20,000 daily cap
    };
    const res = evaluatePolicy(ctx);
    expect(res.decision).toBe("block");
    const r5 = res.results.find((r) => r.ruleCode === "RULE_SPENDING_LIMITS");
    expect(r5?.passed).toBe(false);
  });

  it("RULE 6: Requires review if amount exceeds approval threshold and lacks sign-off", () => {
    const ctx = {
      ...baseContext,
      invoice: {
        ...baseContext.invoice,
        totalUsdc: parseUsdc("7000.00"), // Exceeds 5,000 threshold
        isHumanApproved: false,
      },
    };
    const res = evaluatePolicy(ctx);
    expect(res.decision).toBe("review");
    const r6 = res.results.find((r) => r.ruleCode === "RULE_APPROVAL_THRESHOLD");
    expect(r6?.passed).toBe(false);
  });

  it("RULE 7: Flags review if post-payment balance dips below operating reserve", () => {
    const ctx = {
      ...baseContext,
      availableTreasuryUsdc: parseUsdc("3000.00"),
      minReserveUsdc: parseUsdc("2000.00"),
      invoice: { ...baseContext.invoice, totalUsdc: parseUsdc("1500.00") }, // Leaves 1,500 < 2,000 reserve
    };
    const res = evaluatePolicy(ctx);
    expect(res.decision).toBe("review");
    const r7 = res.results.find((r) => r.ruleCode === "RULE_RESERVE_PROTECTION");
    expect(r7?.passed).toBe(false);
  });

  it("RULE 8: Enforces Arc Mainnet safety cap (e.g. 1.00 USDC)", () => {
    const ctx = {
      ...baseContext,
      network: "mainnet" as const,
      invoice: { ...baseContext.invoice, totalUsdc: parseUsdc("5.00") }, // Exceeds 1.00 USDC mainnet cap
    };
    const res = evaluatePolicy(ctx);
    expect(res.decision).toBe("block");
    const r8 = res.results.find((r) => r.ruleCode === "RULE_MAINNET_GUARD");
    expect(r8?.passed).toBe(false);
  });

  it("RULE 9: Global Kill Switch halts all execution immediately", () => {
    const ctx = {
      ...baseContext,
      killSwitchActive: true,
    };
    const res = evaluatePolicy(ctx);
    expect(res.decision).toBe("block");
    const r9 = res.results.find((r) => r.ruleCode === "RULE_KILL_SWITCH");
    expect(r9?.passed).toBe(false);
  });

  it("RULE 10: Enforces idempotency and prevents double-spending", () => {
    const ctx = {
      ...baseContext,
      invoice: { ...baseContext.invoice, hasExistingPaymentForNetwork: true },
    };
    const res = evaluatePolicy(ctx);
    expect(res.decision).toBe("block");
    const r10 = res.results.find((r) => r.ruleCode === "RULE_IDEMPOTENCY");
    expect(r10?.passed).toBe(false);
  });

  describe("RULE_DELIVERY_VERIFICATION & Regression Invariants", () => {
    it("Regression: when deliveryProofMode is 'off', payment behaviour is 100% identical to before", () => {
      const offCtx = {
        ...baseContext,
        invoice: { ...baseContext.invoice, deliveryProofMode: "off" },
      };
      const res = evaluatePolicy(offCtx);
      expect(res.decision).toBe("approve");
      const rDelivery = res.results.find((r) => r.ruleCode === "RULE_DELIVERY_VERIFICATION");
      expect(rDelivery?.passed).toBe(true);
      expect(rDelivery?.reason).toContain("Delivery proof mode is off");
    });

    it("Blocks payment when deliveryProofMode is 'required' and no delivery request or proof is approved", () => {
      const requiredCtx = {
        ...baseContext,
        invoice: {
          ...baseContext.invoice,
          deliveryProofMode: "required",
          deliveryStatus: "pending",
          deliveryRequestId: "req-123",
          deliveryConditionsMet: false,
        },
      };
      const res = evaluatePolicy(requiredCtx);
      expect(res.decision).toBe("block");
      const rDelivery = res.results.find((r) => r.ruleCode === "RULE_DELIVERY_VERIFICATION");
      expect(rDelivery?.passed).toBe(false);
      expect(rDelivery?.reason).toBe("Delivery proof required but not verified; request #req-123");
    });

    it("Approves payment when deliveryProofMode is 'required' and delivery is approved", () => {
      const approvedCtx = {
        ...baseContext,
        invoice: {
          ...baseContext.invoice,
          deliveryProofMode: "required",
          deliveryStatus: "approved",
          deliveryRequestId: "req-123",
          deliveryConditionsMet: true,
        },
      };
      const res = evaluatePolicy(approvedCtx);
      expect(res.decision).toBe("approve");
      const rDelivery = res.results.find((r) => r.ruleCode === "RULE_DELIVERY_VERIFICATION");
      expect(rDelivery?.passed).toBe(true);
      expect(rDelivery?.reason).toContain("Delivery proof verified and approved");
    });

    it("Allows owner override when deliveryProofMode is 'required' with logged reason", () => {
      const overrideCtx = {
        ...baseContext,
        invoice: {
          ...baseContext.invoice,
          deliveryProofMode: "required",
          deliveryStatus: "pending",
          deliveryRequestId: "req-123",
          deliveryConditionsMet: false,
          ownerOverrideReason: "Owner override: Emergency goods needed on site immediately",
        },
      };
      const res = evaluatePolicy(overrideCtx);
      expect(res.decision).toBe("approve");
      const rDelivery = res.results.find((r) => r.ruleCode === "RULE_DELIVERY_VERIFICATION");
      expect(rDelivery?.passed).toBe(true);
      expect(rDelivery?.reason).toContain("Owner override: Emergency goods needed on site immediately");
    });

    it("Passes when deliveryProofMode is 'optional'", () => {
      const optionalCtx = {
        ...baseContext,
        invoice: {
          ...baseContext.invoice,
          deliveryProofMode: "optional",
        },
      };
      const res = evaluatePolicy(optionalCtx);
      expect(res.decision).toBe("approve");
      const rDelivery = res.results.find((r) => r.ruleCode === "RULE_DELIVERY_VERIFICATION");
      expect(rDelivery?.passed).toBe(true);
      expect(rDelivery?.reason).toContain("Delivery proof is optional");
    });
  });
});
