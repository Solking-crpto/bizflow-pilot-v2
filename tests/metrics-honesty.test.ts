import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { getBuilderWallets, isTestOrganization } from "../lib/builder-wallets";
import { GET as getMetrics } from "../app/api/metrics/route";
import fs from "fs";
import path from "path";

describe("Metrics Honesty & Builder Test Activity Isolation Suite", () => {
  it("1. Parses BUILDER_WALLETS environment variable and normalizes addresses", () => {
    const originalBuilder = process.env.BUILDER_WALLETS;
    const originalAdmin = process.env.ADMIN_WALLET_ADDRESS;

    try {
      process.env.BUILDER_WALLETS = "0x1111111111111111111111111111111111111111, 0x2222222222222222222222222222222222222222";
      const wallets = getBuilderWallets();
      expect(wallets.has("0x1111111111111111111111111111111111111111")).toBe(true);
      expect(wallets.has("0x2222222222222222222222222222222222222222")).toBe(true);

      // Falls back to ADMIN_WALLET_ADDRESS if BUILDER_WALLETS is empty
      delete process.env.BUILDER_WALLETS;
      process.env.ADMIN_WALLET_ADDRESS = "0x3333333333333333333333333333333333333333";
      const fallbackWallets = getBuilderWallets();
      expect(fallbackWallets.has("0x3333333333333333333333333333333333333333")).toBe(true);
    } finally {
      process.env.BUILDER_WALLETS = originalBuilder;
      process.env.ADMIN_WALLET_ADDRESS = originalAdmin;
    }
  });

  it("2. Accurately identifies test organizations using isTest, TEST- prefix, or builder wallets", () => {
    const originalBuilder = process.env.BUILDER_WALLETS;
    try {
      process.env.BUILDER_WALLETS = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

      // 1. isTest = true
      expect(isTestOrganization({ isTest: true, name: "Acme Logistics" })).toBe(true);

      // 2. Name prefix "TEST-" (case-insensitive)
      expect(isTestOrganization({ name: "TEST-E2E Runner" })).toBe(true);
      expect(isTestOrganization({ name: "test-integration-co" })).toBe(true);

      // 3. Name prefix "TEST " or integration keywords
      expect(isTestOrganization({ name: "Test Business (0x123...456)" })).toBe(true);
      expect(isTestOrganization({ name: "Integration Test Corp" })).toBe(true);

      // 4. Builder wallet match
      expect(
        isTestOrganization({
          name: "Legit Sounding Name",
          walletAddress: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        })
      ).toBe(true);

      // 5. Genuine external business
      expect(
        isTestOrganization({
          name: "Global Freight & Forwarding Ltd",
          walletAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          isTest: false,
        })
      ).toBe(false);
    } finally {
      process.env.BUILDER_WALLETS = originalBuilder;
    }
  });

  it("3. GET /api/metrics exposes separate 'external' and 'testActivity' metrics per network", async () => {
    const res = await getMetrics(new NextRequest("http://localhost:3002/api/metrics"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.mainnet).toBeDefined();
    expect(data.testnet).toBeDefined();
    expect(data.integrity.builderTestSeparation).toBe(true);

    // Both networks must expose external and testActivity
    for (const net of [data.mainnet, data.testnet]) {
      if (net.available) {
        expect(net.external).toBeDefined();
        expect(net.testActivity).toBeDefined();
        expect(typeof net.external.invoicesProcessed).toBe("number");
        expect(typeof net.testActivity.invoicesProcessed).toBe("number");
        expect(typeof net.external.settledVolumeUsdc).toBe("string");
        expect(typeof net.testActivity.settledVolumeUsdc).toBe("string");
      }
    }
  });

  it("4. Honesty Check: Verifies no unprovable claims exist across public pages and README", () => {
    const bannedPhrases = [
      /\baudited\b/i,
      /\baudit-grade\b/i,
      /\bfully secure\b/i,
      /\bcompliant\b/i,
      /\bverified by\b/i,
      /\bguaranteed\b/i,
      /\bbank-grade\b/i,
    ];

    const allowedExceptions = [
      /audit ledger/i,
      /audit trail/i,
      /auditanchor/i,
      /AuditAnchor\.sol/i,
      /AuditTrailCard/i,
      /audited.*false/i,
    ];

    const targets = [
      "README.md",
      "app/guide/page.tsx",
      "app/judges/page.tsx",
      "app/about/page.tsx",
      "app/privacy/page.tsx",
      "app/metrics/page.tsx",
      "app/pilots/page.tsx",
    ];

    for (const relativePath of targets) {
      const fullPath = path.resolve(process.cwd(), relativePath);
      if (!fs.existsSync(fullPath)) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip lines matching allowed exceptions
        if (allowedExceptions.some((re) => re.test(line))) continue;

        for (const banned of bannedPhrases) {
          if (banned.test(line)) {
            // Throw descriptive error with file and line
            expect.fail(
              `Found unprovable claim "${banned.source}" in ${relativePath}:${i + 1} -> "${line.trim()}"`
            );
          }
        }
      }
    }
  });
});
