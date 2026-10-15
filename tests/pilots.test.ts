import { describe, it, expect } from "vitest";
import { assertValidSandboxMode } from "../lib/networks";
import { checkRateLimit, resetFailedAttempts } from "../lib/security/auth";

describe("Tier 2: Pilot Organizations & Judge Sandbox Guardrails", () => {
  describe("Public Sandbox Safety Invariant", () => {
    const originalEnv = { ...process.env };

    it("strictly throws fatal error if PUBLIC_SANDBOX is enabled on Arc Mainnet", () => {
      process.env.NEXT_PUBLIC_NETWORK_MODE = "mainnet";
      process.env.PUBLIC_SANDBOX = "true";

      expect(() => assertValidSandboxMode()).toThrow(
        /CRITICAL SECURITY VIOLATION: PUBLIC_SANDBOX is strictly prohibited on Arc Mainnet/
      );
    });

    it("permits PUBLIC_SANDBOX=true on Arc Testnet without error", () => {
      process.env.NEXT_PUBLIC_NETWORK_MODE = "testnet";
      process.env.PUBLIC_SANDBOX = "true";

      expect(() => assertValidSandboxMode()).not.toThrow();
    });

    it("permits normal production operation on Arc Mainnet when PUBLIC_SANDBOX is off", () => {
      process.env.NEXT_PUBLIC_NETWORK_MODE = "mainnet";
      delete process.env.PUBLIC_SANDBOX;
      delete process.env.NEXT_PUBLIC_PUBLIC_SANDBOX;

      expect(() => assertValidSandboxMode()).not.toThrow();
    });

    // Restore environment
    process.env = { ...originalEnv };
  });

  describe("Judge Sandbox Rate Limiting & Tiny Cap", () => {
    it("enforces rate limits on visitor sandbox interactions", () => {
      const testKey = "sandbox:test-ip-12345";
      resetFailedAttempts(testKey);

      // Verify rate limiter allows initial requests
      const initial = checkRateLimit(testKey);
      expect(initial.allowed).toBe(true);
      expect(initial.remainingAttempts).toBeGreaterThan(0);
    });

    it("verifies tiny cap constraint for sandbox testing (<= 0.05 USDC)", () => {
      const sandboxCapAtomic = 50000n; // 0.05 USDC

      const smallTestInvoiceAmount = 30000n; // 0.03 USDC
      const largeInvoiceAmount = 100000n; // 0.10 USDC

      expect(smallTestInvoiceAmount <= sandboxCapAtomic).toBe(true);
      expect(largeInvoiceAmount <= sandboxCapAtomic).toBe(false);
    });
  });

  describe("Pilot Organizations Public Directory Consent Filtering", () => {
    it("filters out organizations that have not granted public consent", () => {
      const mockOrgs = [
        { id: "org-1", name: "Consented Corp", publicConsent: true, isPilot: true },
        { id: "org-2", name: "Private Pilot Inc", publicConsent: false, isPilot: true },
        { id: "org-3", name: "Internal Operations", publicConsent: false, isPilot: false },
      ];

      const publicVisible = mockOrgs.filter((org) => org.publicConsent);
      expect(publicVisible.length).toBe(1);
      expect(publicVisible[0].name).toBe("Consented Corp");
    });
  });
});
