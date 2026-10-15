import { describe, it, expect } from "vitest";
import { AppKitSendProvider } from "../lib/payments/appKitProvider";
import { vendorScreeningProvider } from "../lib/security/screening";

describe("Tier 3 Feature-Flagged Extensions", () => {
  describe("Arc App Kit Send Provider", () => {
    it("generates valid Arc App Kit Send URL matching specification", () => {
      const provider = new AppKitSendProvider("testnet");
      const url = provider.generateSendLink({
        to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        amountAtomic: 500000n, // 0.50 USDC
        idempotencyKey: "PAY-TEST-01",
        refId: "INV-TEST-01",
      });

      expect(url.startsWith("https://testnet.arc.network/send?")).toBe(true);
      expect(url).toContain("to=0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
      expect(url).toContain("token=0x3600000000000000000000000000000000000000");
      expect(url).toContain("amount=0.500000");
      expect(url).toContain("ref=INV-TEST-01");
    });

    it("respects ENABLE_APP_KIT_SEND feature flag on mainnet", () => {
      const originalFlag = process.env.ENABLE_APP_KIT_SEND;
      delete process.env.ENABLE_APP_KIT_SEND;
      delete process.env.NEXT_PUBLIC_ENABLE_APP_KIT_SEND;

      const mainnetProvider = new AppKitSendProvider("mainnet");
      expect(mainnetProvider.isFeatureEnabled()).toBe(false);

      process.env.ENABLE_APP_KIT_SEND = "true";
      expect(mainnetProvider.isFeatureEnabled()).toBe(true);

      process.env.ENABLE_APP_KIT_SEND = originalFlag;
    });

    it("executes successfully in dryRun mode when enabled", async () => {
      process.env.ENABLE_APP_KIT_SEND = "true";
      const provider = new AppKitSendProvider("testnet");

      const result = await provider.transferUsdc({
        to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        amountAtomic: 300000n,
        idempotencyKey: "PAY-DRY-APPKIT-1",
        refId: "INV-DRY-1",
        dryRun: true,
      });

      expect(result.status).toBe("success");
      expect(result.receipt.provider).toBe("appkit");
      expect(result.receipt.protocol).toBe("arc-app-kit-send");
    });
  });

  describe("Vendor Address Screening & Honest Disclaimers", () => {
    it("transparently reports that official sanctions feed is NOT loaded", () => {
      const info = vendorScreeningProvider.getProviderInfo();
      expect(info.isLoaded).toBe(false);
      expect(info.disclaimer).toContain("Official sanctions list is NOT loaded");
    });

    it("identifies and blocks known public testnet wallets via local screening", async () => {
      const blocklistedAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
      const result = await vendorScreeningProvider.screenAddress(blocklistedAddress);

      expect(result.passed).toBe(false);
      expect(result.isBlocklisted).toBe(true);
      expect(result.details).toContain("BLOCKED: Address is a known public test account");
      expect(result.disclaimer).toContain("Official sanctions list is NOT loaded");
    });

    it("passes safe addresses while maintaining unconfigured sanctions disclaimer", async () => {
      const safeVendor = "0x000000000000000000000000000000000000dEaD";
      const result = await vendorScreeningProvider.screenAddress(safeVendor);

      expect(result.passed).toBe(true);
      expect(result.isBlocklisted).toBe(false);
      expect(result.details).toContain("Official sanctions list is not loaded");
    });
  });
});
