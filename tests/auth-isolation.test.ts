import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../lib/db";

const prisma = getDb("testnet");
import {
  createSessionToken,
  verifySessionToken,
  buildSiweMessage,
  parseSiweMessage,
  isAdminWallet,
  SESSION_COOKIE_NAME,
} from "../lib/auth/session";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { NextRequest } from "next/server";
import { POST as verifyRoute } from "../app/api/auth/verify/route";
import { POST as settingsRoute } from "../app/api/settings/route";
import { POST as decisionsRoute } from "../app/api/agent/decisions/route";
import { getActiveNetwork } from "../lib/networks";
import { createStatelessNonce, AUTH_NONCE_COOKIE_NAME } from "../lib/auth/stateless-nonce";

describe("Phase 2 — Wallet Authentication & Multi-User Isolation Matrix", () => {
  const accountA = privateKeyToAccount(generatePrivateKey());
  const accountB = privateKeyToAccount(generatePrivateKey());
  const adminAccount = privateKeyToAccount(generatePrivateKey());

  const orgIdA = "org-test-tenant-alpha";
  const orgIdB = "org-test-tenant-bravo";

  beforeEach(async () => {
    // Clean up test records
    await prisma.authNonce.deleteMany({
      where: {
        nonce: { in: ["test-nonce-12345", "replayed-nonce-999", "valid-nonce-abc"] },
      },
    });

    await prisma.agentDecision.deleteMany({
      where: { orgId: { in: [orgIdA, orgIdB] } },
    });
    await prisma.invoice.deleteMany({
      where: { orgId: { in: [orgIdA, orgIdB] } },
    });
    await prisma.vendor.deleteMany({
      where: { orgId: { in: [orgIdA, orgIdB] } },
    });
    await prisma.setting.deleteMany({
      where: { orgId: { in: [orgIdA, orgIdB] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgIdA, orgIdB] } },
    });

    // Create Org A
    await prisma.organization.create({
      data: {
        id: orgIdA,
        name: "Tenant Alpha Corp",
        currency: "USDC",
        walletAddress: accountA.address.toLowerCase(),
        settings: {
          create: {
            killSwitchActive: false,
            priceToleranceBps: 100,
            requireApprovalAbove: 5_000_000n,
            minReserveUsdc: 2_000_000n,
            dailyLimitUsdc: 25_000_000n,
            autoApproveLimitUsdc: 500_000n,
          },
        },
      },
    });

    // Create Org B
    await prisma.organization.create({
      data: {
        id: orgIdB,
        name: "Tenant Bravo Industries",
        currency: "USDC",
        walletAddress: accountB.address.toLowerCase(),
        settings: {
          create: {
            killSwitchActive: false,
            priceToleranceBps: 100,
            requireApprovalAbove: 5_000_000n,
            minReserveUsdc: 2_000_000n,
            dailyLimitUsdc: 25_000_000n,
            autoApproveLimitUsdc: 500_000n,
          },
        },
      },
    });
  }, 120000);

  describe("1. Session Token Integrity & Security", () => {
    it("generates and verifies a valid HMAC-signed session token", () => {
      const payload = {
        address: accountA.address,
        orgId: orgIdA,
        role: "owner",
        expiresAt: Date.now() + 3600 * 1000,
      };

      const token = createSessionToken(payload);
      const verified = verifySessionToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.address).toBe(accountA.address.toLowerCase());
      expect(verified?.orgId).toBe(orgIdA);
    });

    it("rejects tampered session tokens with signature mismatch", () => {
      const payload = {
        address: accountA.address,
        orgId: orgIdA,
        role: "owner",
        expiresAt: Date.now() + 3600 * 1000,
      };

      const token = createSessionToken(payload);
      const parts = token.split(".");
      const tamperedToken = `${parts[0]}.forgedsignature123456789`;

      expect(verifySessionToken(tamperedToken)).toBeNull();
    });

    it("rejects expired session tokens", () => {
      const expiredPayload = {
        address: accountA.address,
        orgId: orgIdA,
        role: "owner",
        expiresAt: Date.now() - 5000, // Expired 5 seconds ago
      };

      const token = createSessionToken(expiredPayload);
      expect(verifySessionToken(token)).toBeNull();
    });
  });

  describe("2. SIWE Message & Replay Protection", () => {
    it("builds and correctly parses a standard EIP-191 SIWE message", () => {
      const activeNetwork = getActiveNetwork();
      const message = buildSiweMessage({
        domain: "localhost:3001",
        address: accountA.address,
        uri: "http://localhost:3001",
        nonce: "test-nonce-12345",
        chainId: activeNetwork.chainId,
      });

      const parsed = parseSiweMessage(message);
      expect(parsed).not.toBeNull();
      expect(parsed?.domain).toBe("localhost:3001");
      expect(parsed?.address).toBe(accountA.address);
      expect(parsed?.nonce).toBe("test-nonce-12345");
      expect(parsed?.chainId).toBe(activeNetwork.chainId);
    });

    it("verifies wallet signature and invalidates nonce to prevent replay attacks", async () => {
      const activeNetwork = getActiveNetwork("testnet");
      const { nonce, cookieValue } = createStatelessNonce();

      const message = buildSiweMessage({
        domain: "localhost:3001",
        address: accountA.address,
        uri: "http://localhost:3001",
        nonce,
        chainId: activeNetwork.chainId,
      });

      const signature = await accountA.signMessage({ message });

      // First verification: should succeed
      const req1 = new NextRequest("http://localhost:3001/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bizflow-Network": "testnet",
          cookie: `bizflow_network=testnet; ${AUTH_NONCE_COOKIE_NAME}=${cookieValue}`,
        },
        body: JSON.stringify({ message, signature, address: accountA.address }),
      });

      const res1 = await verifyRoute(req1);
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.success).toBe(true);
      expect(data1.org.id).toBe(orgIdA);

      // Replay attempt without cookie or with consumed nonce: MUST fail with 401
      const req2 = new NextRequest("http://localhost:3001/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bizflow-Network": "testnet",
          cookie: "bizflow_network=testnet",
        },
        body: JSON.stringify({ message, signature, address: accountA.address }),
      });

      const res2 = await verifyRoute(req2);
      expect(res2.status).toBe(401);
      const data2 = await res2.json();
      expect(data2.error).toContain("nonce");
    });

    it("rejects signature signed by a different wallet address", async () => {
      const activeNetwork = getActiveNetwork("testnet");
      const { nonce, cookieValue } = createStatelessNonce();

      const message = buildSiweMessage({
        domain: "localhost:3001",
        address: accountA.address, // Declares Account A
        uri: "http://localhost:3001",
        nonce,
        chainId: activeNetwork.chainId,
      });

      // Account B signs message claiming to be Account A
      const maliciousSignature = await accountB.signMessage({ message });

      const req = new NextRequest("http://localhost:3001/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bizflow-Network": "testnet",
          cookie: `bizflow_network=testnet; ${AUTH_NONCE_COOKIE_NAME}=${cookieValue}`,
        },
        body: JSON.stringify({ message, signature: maliciousSignature, address: accountA.address }),
      });

      const res = await verifyRoute(req);
      expect(res.status).toBe(401);
    });
  });

  describe("3. Cross-Tenant IDOR & Multi-User Isolation", () => {
    it("prevents Tenant A from modifying Tenant B's settings (IDOR rejection)", async () => {
      // Create session for Wallet A
      const sessionTokenA = createSessionToken({
        address: accountA.address,
        orgId: orgIdA,
        role: "owner",
        expiresAt: Date.now() + 3600 * 1000,
      });

      // Tenant A attempts to update Org B's settings by sending orgId: orgIdB
      const req = new NextRequest("http://localhost:3001/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bizflow-Network": "testnet",
          Cookie: `${SESSION_COOKIE_NAME}=${sessionTokenA}; bizflow_network=testnet`,
        },
        body: JSON.stringify({
          orgId: orgIdB,
          killSwitchActive: true,
        }),
      });

      const res = await settingsRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Cross-organization modification is strictly prohibited");

      // Verify Org B's settings were untouched
      const orgBSetting = await prisma.setting.findFirst({ where: { orgId: orgIdB } });
      expect(orgBSetting?.killSwitchActive).toBe(false);
    });

    it("prevents Tenant A from acting on Tenant B's agent escalations (IDOR rejection)", async () => {
      // Create vendor, invoice, and decision in Org B
      const vendorB = await prisma.vendor.create({
        data: {
          orgId: orgIdB,
          name: "Bravo Vendor",
          walletAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        },
      });

      const invoiceB = await prisma.invoice.create({
        data: {
          orgId: orgIdB,
          vendorId: vendorB.id,
          invoiceNumber: "INV-BRAVO-001",
          fileHash: "hash-001",
          extractedData: "{}",
          totalUsdc: 1_000_000n, // 1 USDC
        },
      });

      const decisionB = await prisma.agentDecision.create({
        data: {
          orgId: orgIdB,
          invoiceId: invoiceB.id,
          observationHash: "obs-001",
          cashPosition: "{}",
          choice: "escalate",
          reasoning: "Review required",
          source: "deterministic",
          model: "rules-engine",
          escalated: true,
          outcome: "escalated",
        },
      });

      // Tenant A attempts to reject or approve Tenant B's decision
      const sessionTokenA = createSessionToken({
        address: accountA.address,
        orgId: orgIdA,
        role: "owner",
        expiresAt: Date.now() + 3600 * 1000,
      });

      const req = new NextRequest("http://localhost:3001/api/agent/decisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bizflow-Network": "testnet",
          Cookie: `${SESSION_COOKIE_NAME}=${sessionTokenA}; bizflow_network=testnet`,
        },
        body: JSON.stringify({
          decisionId: decisionB.id,
          action: "reject",
        }),
      });

      const res = await decisionsRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("You do not have permission to modify decisions for another organization");
    });

    it("enforces non-custodial rule: public org approval requires wallet signature", async () => {
      // Create invoice and decision for Org A
      const vendorA = await prisma.vendor.create({
        data: {
          orgId: orgIdA,
          name: "Alpha Vendor",
          walletAddress: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
        },
      });

      const invoiceA = await prisma.invoice.create({
        data: {
          orgId: orgIdA,
          vendorId: vendorA.id,
          invoiceNumber: "INV-ALPHA-001",
          fileHash: "hash-alpha",
          extractedData: "{}",
          totalUsdc: 500_000n,
        },
      });

      const decisionA = await prisma.agentDecision.create({
        data: {
          orgId: orgIdA,
          invoiceId: invoiceA.id,
          observationHash: "obs-alpha",
          cashPosition: "{}",
          choice: "escalate",
          reasoning: "Manual review",
          source: "deterministic",
          model: "rules-engine",
          escalated: true,
          outcome: "escalated",
        },
      });

      const sessionTokenA = createSessionToken({
        address: accountA.address,
        orgId: orgIdA,
        role: "owner",
        expiresAt: Date.now() + 3600 * 1000,
      });

      const req = new NextRequest("http://localhost:3001/api/agent/decisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bizflow-Network": "testnet",
          Cookie: `${SESSION_COOKIE_NAME}=${sessionTokenA}; bizflow_network=testnet`,
        },
        body: JSON.stringify({
          decisionId: decisionA.id,
          action: "approve",
        }),
      });

      const res = await decisionsRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      // Server must NOT execute treasury payment for public org
      expect(data.requiresWalletSignature).toBe(true);
      expect(data.action).toBe("approved_pending_signature");
    });
  });
});
