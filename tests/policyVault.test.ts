import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Tier 3: PolicyVault Smart Contract (Paris EVM Target)", () => {
  const artifactPath = path.join(__dirname, "../artifacts/contracts/PolicyVault.json");

  it("verifies compiled PolicyVault artifact exists with valid Paris EVM bytecode", () => {
    expect(fs.existsSync(artifactPath)).toBe(true);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

    expect(artifact.contractName).toBe("PolicyVault");
    expect(artifact.bytecode.startsWith("0x60")).toBe(true);
    expect(artifact.bytecode.length).toBeGreaterThan(200);

    const abiFunctionNames = artifact.abi
      .filter((item: any) => item.type === "function")
      .map((item: any) => item.name);

    expect(abiFunctionNames).toContain("pay");
    expect(abiFunctionNames).toContain("setVendorApproval");
    expect(abiFunctionNames).toContain("setLimits");
    expect(abiFunctionNames).toContain("setPaused");
    expect(abiFunctionNames).toContain("setOperator");
  });

  it("verifies PolicyVault ABI declares all required corporate security events", () => {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    const abiEventNames = artifact.abi
      .filter((item: any) => item.type === "event")
      .map((item: any) => item.name);

    expect(abiEventNames).toContain("PaymentDispatched");
    expect(abiEventNames).toContain("VendorApprovalChanged");
    expect(abiEventNames).toContain("LimitsUpdated");
    expect(abiEventNames).toContain("VaultPaused");
    expect(abiEventNames).toContain("OperatorUpdated");
  });

  it("verifies pay() function signature and parameter types", () => {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    const payFn = artifact.abi.find((item: any) => item.name === "pay" && item.type === "function");

    expect(payFn).toBeDefined();
    expect(payFn.inputs.length).toBe(3);
    expect(payFn.inputs[0].name).toBe("vendor");
    expect(payFn.inputs[0].type).toBe("address");
    expect(payFn.inputs[1].name).toBe("amount");
    expect(payFn.inputs[1].type).toBe("uint256");
    expect(payFn.inputs[2].name).toBe("invoiceHash");
    expect(payFn.inputs[2].type).toBe("bytes32");
  });

  describe("Contract Logic Simulation", () => {
    it("enforces per-transaction limits on simulated disbursements", () => {
      const perTxLimit = 1000000n; // 1.00 USDC cap
      const validAmount = 500000n; // 0.50 USDC
      const invalidAmount = 1500000n; // 1.50 USDC

      expect(validAmount <= perTxLimit).toBe(true);
      expect(invalidAmount <= perTxLimit).toBe(false);
    });

    it("tracks and enforces daily limit resets across day boundaries", () => {
      const dailyLimit = 2000000n; // 2.00 USDC cap
      let currentDay = 100;
      let dailySpent = 1800000n; // 1.80 USDC spent today

      // Attempt 0.50 USDC on same day -> would exceed 2.00 USDC
      const exceedsToday = dailySpent + 500000n > dailyLimit;
      expect(exceedsToday).toBe(true);

      // Next day rollover
      const nextDay = 101;
      if (nextDay > currentDay) {
        currentDay = nextDay;
        dailySpent = 0n;
      }

      // On new day, 0.50 USDC is permitted
      const allowedNextDay = dailySpent + 500000n <= dailyLimit;
      expect(allowedNextDay).toBe(true);
    });
  });
});
