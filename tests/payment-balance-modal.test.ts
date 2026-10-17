import { describe, it, expect, vi } from "vitest";
import {
  convert6To18,
  convert18To6,
  formatUsdc18,
  formatUsdc6,
  checkGasAndBalanceSufficiency,
  readWalletBalance,
} from "../lib/payments/balanceCheck";
import { NETWORKS } from "../lib/networks";

describe("Payment Modal — Wallet Balance, Gas Sufficiency & Decimals Suite", () => {
  const testAddress = "0x1234567890123456789012345678901234567890" as `0x${string}`;
  const testToken = "0x3600000000000000000000000000000000000000" as `0x${string}`;
  const testnet = NETWORKS.testnet;

  describe("1. Decimals Conversion & Formatting Cases", () => {
    it("converts 6-decimal atomic USDC to 18-decimal native units", () => {
      // 1 USDC = 1_000_000 (6 decimals) -> 1_000_000_000_000_000_000 (18 decimals)
      expect(convert6To18(1_000_000n)).toBe(1_000_000_000_000_000_000n);

      // 0.10 USDC = 100_000 (6 decimals) -> 100_000_000_000_000_000 (18 decimals)
      expect(convert6To18(100_000n)).toBe(100_000_000_000_000_000n);

      // 5.00 USDC = 5_000_000 (6 decimals) -> 5_000_000_000_000_000_000 (18 decimals)
      expect(convert6To18(5_000_000n)).toBe(5_000_000_000_000_000_000n);

      // 0 USDC
      expect(convert6To18(0n)).toBe(0n);
    });

    it("converts 18-decimal native units to 6-decimal atomic USDC", () => {
      expect(convert18To6(1_000_000_000_000_000_000n)).toBe(1_000_000n);
      expect(convert18To6(100_000_000_000_000_000n)).toBe(100_000n);
      expect(convert18To6(50_000_000_000_000n)).toBe(50n); // Small fraction
    });

    it("formats 18-decimal units into human-readable USDC strings", () => {
      // Balance 5.00 USDC
      expect(formatUsdc18(5_000_000_000_000_000_000n)).toBe("5.00");

      // Payment 0.10 USDC
      expect(formatUsdc18(100_000_000_000_000_000n)).toBe("0.10");

      // Estimated gas 0.0013 USDC (65,000 gas * 20 Gwei = 1.3e15 wei)
      expect(formatUsdc18(1_300_000_000_000_000n)).toBe("0.0013");

      // Zero balance
      expect(formatUsdc18(0n)).toBe("0.00");
    });

    it("formats 6-decimal atomic units into standard currency format", () => {
      expect(formatUsdc6(100_000n)).toBe("0.10");
      expect(formatUsdc6(5_000_000n)).toBe("5.00");
      expect(formatUsdc6(25_500_000n)).toBe("25.50");
    });
  });

  describe("2. Split Checks: Balance, Payment and Gas", () => {
    it("funded wallet passes with complete real numbers summary", () => {
      // User has 5.00 USDC, payment is 0.10 USDC
      const balance18 = convert6To18(5_000_000n); // 5.00 USDC
      const payment6 = 100_000n; // 0.10 USDC

      const res = checkGasAndBalanceSufficiency({
        effectiveBal18: balance18,
        paymentAmountAtomic6: payment6,
        gasLimit: 65_000n,
        maxFeePerGasWei: 20_000_000_000n, // 20 Gwei floor
      });

      expect(res.hasSufficientPayment).toBe(true);
      expect(res.hasSufficientGas).toBe(true);
      expect(res.hasSufficientTotal).toBe(true);
      expect(res.errorType).toBe("NONE");
      expect(res.errorMessage).toBeNull();
      expect(res.summaryLine).toBe(
        "Balance 5.00 USDC · Payment 0.10 USDC · Estimated gas 0.0013 USDC"
      );
    });

    it("zero balance fails with the right message", () => {
      const balance18 = 0n;
      const payment6 = 100_000n; // 0.10 USDC

      const res = checkGasAndBalanceSufficiency({
        effectiveBal18: balance18,
        paymentAmountAtomic6: payment6,
      });

      expect(res.hasSufficientPayment).toBe(false);
      expect(res.hasSufficientGas).toBe(false);
      expect(res.hasSufficientTotal).toBe(false);
      expect(res.errorType).toBe("BALANCE_TOO_LOW_FOR_PAYMENT");
      expect(res.errorMessage).toContain(
        "Your wallet holds 0 USDC, but this settlement requires 0.10 USDC (plus estimated gas)."
      );
    });

    it("balance insufficient for payment amount fails with balance message", () => {
      // User has 0.05 USDC, payment is 0.10 USDC
      const balance18 = convert6To18(50_000n); // 0.05 USDC
      const payment6 = 100_000n; // 0.10 USDC

      const res = checkGasAndBalanceSufficiency({
        effectiveBal18: balance18,
        paymentAmountAtomic6: payment6,
      });

      expect(res.hasSufficientPayment).toBe(false);
      expect(res.hasSufficientTotal).toBe(false);
      expect(res.errorType).toBe("BALANCE_TOO_LOW_FOR_PAYMENT");
      expect(res.errorMessage).toContain(
        "Your balance of 0.05 USDC is too low for this payment of 0.10 USDC."
      );
    });

    it("balance exactly equal to payment amount without gas fails with the gas message", () => {
      // User has EXACTLY 0.10 USDC, payment is 0.10 USDC, gas requires 0.0013 USDC
      const payment6 = 100_000n; // 0.10 USDC
      const balance18 = convert6To18(payment6); // exactly 0.10 USDC (0 left for gas)

      const res = checkGasAndBalanceSufficiency({
        effectiveBal18: balance18,
        paymentAmountAtomic6: payment6,
        gasLimit: 65_000n,
        maxFeePerGasWei: 20_000_000_000n,
      });

      // Covers payment itself...
      expect(res.hasSufficientPayment).toBe(true);
      // ...but fails for gas!
      expect(res.hasSufficientGas).toBe(false);
      expect(res.hasSufficientTotal).toBe(false);
      expect(res.errorType).toBe("NOT_ENOUGH_FOR_GAS");
      expect(res.errorMessage).toContain("Not enough USDC left for gas");
      expect(res.errorMessage).toContain(
        "your balance covers the 0.10 USDC payment, but Arc requires ~0.0013 USDC for gas fees (20 Gwei floor)."
      );
    });
  });

  describe("3. Provider-First and Public RPC Retry Fallback", () => {
    it("successfully reads balance via wallet provider", async () => {
      const mockProvider = {
        request: vi.fn(async ({ method }) => {
          if (method === "eth_call") {
            // 5 USDC in 6 decimals = 5_000_000 -> 0x4c4b40
            return "0x00000000000000000000000000000000000000000000000000000000004c4b40";
          }
          if (method === "eth_getBalance") {
            // 0.05 native USDC gas = 50_000_000_000_000_000 -> 0xb1a2bc2ec50000
            return "0x00000000000000000000000000000000000000000000000000b1a2bc2ec50000";
          }
          if (method === "eth_chainId") {
            return "0x4cef52"; // 5042002
          }
          return null;
        }),
      };

      const result = await readWalletBalance({
        address: testAddress,
        activeNetwork: testnet,
        tokenAddress: testToken,
        walletProvider: mockProvider,
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe("provider");
      expect(result.tokenBal6).toBe(5_000_000n);
      expect(result.effectiveBalFormatted).toBe("5.00");
    });

    it("falls back to public RPC when wallet provider throws", async () => {
      const faultyProvider = {
        request: vi.fn(async () => {
          throw new Error("Provider RPC method not supported");
        }),
      };

      // When public RPC fails in test environment, it handles cleanly without throwing
      const result = await readWalletBalance({
        address: testAddress,
        activeNetwork: {
          ...testnet,
          publicRpcUrl: "https://invalid-rpc-test.example",
          fallbackRpcs: [],
        },
        tokenAddress: testToken,
        walletProvider: faultyProvider,
      });

      // Provider was attempted first
      expect(faultyProvider.request).toHaveBeenCalled();
      // Result is reported as failed with retry message, NEVER treated as 0 balance
      expect(result.success).toBe(false);
      expect(result.source).toBe("failed");
      expect(result.error).toBe("Could not read your balance. Retry");
    });

    it("RPC failure shows retry state and never claims 0 USDC balance", async () => {
      const result = await readWalletBalance({
        address: testAddress,
        activeNetwork: {
          ...testnet,
          publicRpcUrl: "https://nonexistent-rpc.invalid",
          fallbackRpcs: ["https://nonexistent-fallback.invalid"],
        },
        tokenAddress: testToken,
        walletProvider: undefined,
      });

      expect(result.success).toBe(false);
      expect(result.source).toBe("failed");
      expect(result.error).toBe("Could not read your balance. Retry");
    });
  });
});
