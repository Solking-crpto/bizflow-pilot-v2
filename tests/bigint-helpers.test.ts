import { describe, it, expect, vi } from "vitest";
import { bigintMax, bigintMin, clampBigInt, clampMaxFeePerGas } from "@/lib/bigint";
import { ARC_GAS_CONFIG } from "@/lib/networks";

describe("BigInt Math Helpers & Payment Modal Fee Clamp", () => {
  it("proves Math.max throws TypeError on BigInt values in JavaScript", () => {
    expect(() => {
      // @ts-ignore - purposefully passing BigInt to verify runtime TypeError
      Math.max(10n, 20n);
    }).toThrow(TypeError);

    expect(() => {
      // @ts-ignore
      Math.min(10n, 20n);
    }).toThrow(TypeError);
  });

  it("bigintMax correctly returns the maximum without throwing TypeError", () => {
    expect(bigintMax(10n, 20n)).toBe(20n);
    expect(bigintMax(20n, 10n)).toBe(20n);
    expect(bigintMax(15n, 15n)).toBe(15n);
    expect(bigintMax(-5n, 0n)).toBe(0n);
    expect(bigintMax(-10n, -20n)).toBe(-10n);
    expect(bigintMax(1n, 5n, 3n, 9n, 2n)).toBe(9n);
  });

  it("bigintMin correctly returns the minimum without throwing TypeError", () => {
    expect(bigintMin(10n, 20n)).toBe(10n);
    expect(bigintMin(20n, 10n)).toBe(10n);
    expect(bigintMin(15n, 15n)).toBe(15n);
    expect(bigintMin(-5n, 0n)).toBe(-5n);
    expect(bigintMin(-10n, -20n)).toBe(-20n);
    expect(bigintMin(9n, 5n, 3n, 1n, 7n)).toBe(1n);
  });

  it("clampBigInt correctly clamps values within range", () => {
    expect(clampBigInt(5n, 10n, 20n)).toBe(10n);
    expect(clampBigInt(15n, 10n, 20n)).toBe(15n);
    expect(clampBigInt(25n, 10n, 20n)).toBe(20n);
  });

  it("clampMaxFeePerGas clamps fees to at least the 20 Gwei floor", () => {
    const floor = ARC_GAS_CONFIG.MIN_MAX_FEE_PER_GAS_WEI; // 20_000_000_000n

    // Lower than 20 Gwei -> clamped to 20 Gwei floor
    expect(clampMaxFeePerGas(10_000_000_000n)).toBe(floor);
    expect(clampMaxFeePerGas(0n)).toBe(floor);
    expect(clampMaxFeePerGas(undefined)).toBe(floor);
    expect(clampMaxFeePerGas(null)).toBe(floor);

    // Higher than 20 Gwei -> preserved
    expect(clampMaxFeePerGas(35_000_000_000n)).toBe(35_000_000_000n);
    expect(clampMaxFeePerGas(50_000_000_000n)).toBe(50_000_000_000n);
  });

  it("proves payment modal fee clamp runs without TypeError using a mocked client returning bigint fees", async () => {
    // 1. Mock publicClient that returns BigInt fees higher than 20 Gwei
    const mockHighClient = {
      estimateFeesPerGas: vi.fn(async () => ({
        maxFeePerGas: 35_000_000_000n, // 35 Gwei
        maxPriorityFeePerGas: 2_000_000_000n, // 2 Gwei
      })),
    };

    let maxFeePerGas = ARC_GAS_CONFIG.MIN_MAX_FEE_PER_GAS_WEI;
    let maxPriorityFeePerGas = ARC_GAS_CONFIG.DEFAULT_PRIORITY_FEE_WEI;

    const feesHigh = await mockHighClient.estimateFeesPerGas();
    if (feesHigh?.maxFeePerGas) {
      maxFeePerGas = bigintMax(feesHigh.maxFeePerGas, ARC_GAS_CONFIG.MIN_MAX_FEE_PER_GAS_WEI);
    }
    if (feesHigh?.maxPriorityFeePerGas) {
      maxPriorityFeePerGas = feesHigh.maxPriorityFeePerGas;
    }

    expect(maxFeePerGas).toBe(35_000_000_000n);
    expect(maxPriorityFeePerGas).toBe(2_000_000_000n);

    // 2. Mock publicClient that returns BigInt fees LOWER than 20 Gwei floor
    const mockLowClient = {
      estimateFeesPerGas: vi.fn(async () => ({
        maxFeePerGas: 5_000_000_000n, // 5 Gwei (underpriced!)
        maxPriorityFeePerGas: 1_000_000_000n,
      })),
    };

    let clampedFee = ARC_GAS_CONFIG.MIN_MAX_FEE_PER_GAS_WEI;
    const feesLow = await mockLowClient.estimateFeesPerGas();
    if (feesLow?.maxFeePerGas) {
      clampedFee = bigintMax(feesLow.maxFeePerGas, ARC_GAS_CONFIG.MIN_MAX_FEE_PER_GAS_WEI);
    }

    // Must be clamped up to 20 Gwei floor
    expect(clampedFee).toBe(20_000_000_000n);
    expect(clampedFee).toBe(ARC_GAS_CONFIG.MIN_MAX_FEE_PER_GAS_WEI);
  });
});
