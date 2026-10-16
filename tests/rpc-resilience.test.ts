import { describe, it, expect, vi } from "vitest";
import {
  isArcLagError,
  withRpcRetry,
  ARC_RPC_ERROR_BLOCK_LAG,
} from "@/lib/rpc/client";

describe("Arc RPC Client & -32014 Lag Resilience", () => {
  it("identifies error -32014 as Arc block lag error", () => {
    expect(isArcLagError({ code: -32014 })).toBe(true);
    expect(isArcLagError({ code: ARC_RPC_ERROR_BLOCK_LAG })).toBe(true);
    expect(isArcLagError({ cause: { code: -32014 } })).toBe(true);
    expect(isArcLagError(new Error("RPC error -32014: backend behind head block"))).toBe(true);
    expect(isArcLagError(new Error("Header not found"))).toBe(true);

    expect(isArcLagError({ code: 4001 })).toBe(false);
    expect(isArcLagError(new Error("User rejected transaction"))).toBe(false);
  });

  it("retries with backoff on error -32014 and succeeds", async () => {
    let callCount = 0;
    const retryDelays: number[] = [];

    const mockAction = vi.fn(async () => {
      callCount++;
      if (callCount < 3) {
        const err: any = new Error("Arc backend block height lag");
        err.code = -32014;
        throw err;
      }
      return { blockNumber: 123456n, status: "success" };
    });

    const result = await withRpcRetry(mockAction, {
      maxRetries: 3,
      initialDelayMs: 10,
      backoffFactor: 2,
      onRetry: (_attempt, _err, delay) => {
        retryDelays.push(delay);
      },
    });

    expect(result).toEqual({ blockNumber: 123456n, status: "success" });
    expect(callCount).toBe(3);
    expect(retryDelays).toEqual([10, 20]);
  });

  it("does not retry on non-lag errors", async () => {
    let callCount = 0;
    const mockAction = vi.fn(async () => {
      callCount++;
      const err: any = new Error("User rejected transaction");
      err.code = 4001;
      throw err;
    });

    await expect(
      withRpcRetry(mockAction, { maxRetries: 3, initialDelayMs: 10 })
    ).rejects.toThrow("User rejected transaction");

    expect(callCount).toBe(1);
  });

  it("throws after exceeding maxRetries on continuous -32014 errors", async () => {
    let callCount = 0;
    const mockAction = vi.fn(async () => {
      callCount++;
      const err: any = new Error("Persistent -32014 error");
      err.code = -32014;
      throw err;
    });

    await expect(
      withRpcRetry(mockAction, { maxRetries: 2, initialDelayMs: 10 })
    ).rejects.toThrow("Persistent -32014 error");

    // Initial attempt (1) + 2 retries = 3 calls
    expect(callCount).toBe(3);
  });
});
