import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../lib/db";
import { createSessionToken } from "../lib/auth/session";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { NextRequest } from "next/server";
import { POST as intentRoute } from "../app/api/payments/intent/route";
import { POST as executeRoute } from "../app/api/payments/execute/route";
import { POST as verifyReceiptRoute } from "../app/api/payments/verify-receipt/route";
import { getActiveNetwork } from "../lib/networks";
import { ANCHOR_ABI } from "../lib/contracts/auditAnchorAbi";

describe("Phase 4 — Non-Custodial Payment Flow & Invariant Matrix", () => {
  const accountA = privateKeyToAccount(generatePrivateKey());
  const accountB = privateKeyToAccount(generatePrivateKey());

  const orgIdA = "org-test-custodial-alpha";
  const orgIdB = "org-test-custodial-bravo";

  const sessionCookieA = createSessionToken({
    address: accountA.address.toLowerCase(),
    orgId: orgIdA,
    role: "owner",
    expiresAt: Date.now() + 3600000,
  });

  const sessionCookieB = createSessionToken({
    address: accountB.address.toLowerCase(),
    orgId: orgIdB,
    role: "owner",
    expiresAt: Date.now() + 3600000,
  });

  let vendorAId: string;
  let invoiceAId: string;
  let invoiceBId: string;

  beforeEach(async () => {
    // Clean up test data
    await prisma.paymentIntent.deleteMany({
      where: { orgId: { in: [orgIdA, orgIdB] } },
    });
    await prisma.payment.deleteMany({
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

    // Create Org A (Public User Organization)
    const orgA = await prisma.organization.create({
      data: {
        id: orgIdA,
        name: "Public Beta Org A",
        currency: "USDC",
        walletAddress: accountA.address.toLowerCase(),
        settings: {
          create: {
            killSwitchActive: false,
            priceToleranceBps: 100,
            requireApprovalAbove: 25_000_000n,
            minReserveUsdc: 2_000_000n,
            dailyLimitUsdc: 25_000_000n,
            agentMode: "assisted",
          },
        },
      },
    });

    // Create Vendor for Org A
    const vendorA = await prisma.vendor.create({
      data: {
        orgId: orgA.id,
        name: "Arc Steel & Cement Supplies",
        walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase(),
        status: "active",
        perVendorLimitUsdc: 25_000_000n,
      },
    });
    vendorAId = vendorA.id;

    // Create verified Invoice for Org A (0.05 USDC = 50,000 atomic)
    const invA = await prisma.invoice.create({
      data: {
        orgId: orgA.id,
        vendorId: vendorA.id,
        invoiceNumber: "INV-CUSTODIAL-TEST-01",
        network: "testnet",
        totalUsdc: 50_000n,
        fileHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        status: "verified",
        matchStatus: "exact_match",
        duplicateScore: 0,
        isInjectionSuspect: false,
        extractedData: JSON.stringify({ invoiceNumber: "INV-CUSTODIAL-TEST-01", total: 0.05 }),
      },
    });
    invoiceAId = invA.id;

    // Create Org B
    const orgB = await prisma.organization.create({
      data: {
        id: orgIdB,
        name: "Public Beta Org B",
        currency: "USDC",
        walletAddress: accountB.address.toLowerCase(),
        settings: {
          create: {
            killSwitchActive: false,
            priceToleranceBps: 100,
            requireApprovalAbove: 25_000_000n,
            minReserveUsdc: 2_000_000n,
            dailyLimitUsdc: 25_000_000n,
            agentMode: "assisted",
          },
        },
      },
    });

    const vendorB = await prisma.vendor.create({
      data: {
        orgId: orgB.id,
        name: "Bravo Logistics",
        walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC".toLowerCase(),
        status: "active",
        perVendorLimitUsdc: 25_000_000n,
      },
    });

    const invB = await prisma.invoice.create({
      data: {
        orgId: orgB.id,
        vendorId: vendorB.id,
        invoiceNumber: "INV-BRAVO-TEST-02",
        network: "testnet",
        totalUsdc: 75_000n,
        fileHash: "f4b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b899",
        status: "verified",
        matchStatus: "exact_match",
        duplicateScore: 0,
        isInjectionSuspect: false,
        extractedData: JSON.stringify({ invoiceNumber: "INV-BRAVO-TEST-02", total: 0.075 }),
      },
    });
    invoiceBId = invB.id;
  });

  describe("1. Strict Non-Custodial Invariant Protection", () => {
    it("refuses to execute server treasury payment for public organization invoices (returns 403)", async () => {
      // Public Org A attempts to trigger server treasury payment endpoint
      const req = new NextRequest("http://localhost:3000/api/payments/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `bizflow_session=${sessionCookieA}`,
        },
        body: JSON.stringify({
          invoiceId: invoiceAId,
          hasOwnerConfirmation: true,
        }),
      });

      const res = await executeRoute(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toContain("Public organizations must sign payments with their own wallet");
    });
  });

  describe("2. Payment Intent Lifecycle & Policy Gate", () => {
    it("creates a verified PaymentIntent when policy passes", async () => {
      const network = getActiveNetwork();

      const req = new NextRequest("http://localhost:3000/api/payments/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `bizflow_session=${sessionCookieA}`,
        },
        body: JSON.stringify({
          invoiceId: invoiceAId,
        }),
      });

      const res = await intentRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.allowed).toBe(true);
      expect(json.intent.id).toBeDefined();
      expect(json.intent.invoiceId).toBe(invoiceAId);
      expect(json.intent.recipientAddress).toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase());
      expect(json.intent.amountAtomic).toBe("50000");
      expect(json.intent.tokenAddress.toLowerCase()).toBe(network.usdcAddress.toLowerCase());
      expect(json.intent.chainId).toBe(network.chainId);
      expect(json.policy.decision).toBe("approve");
    });

    it("prevents IDOR: Tenant B cannot create payment intent for Tenant A's invoice", async () => {
      const req = new NextRequest("http://localhost:3000/api/payments/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `bizflow_session=${sessionCookieB}`, // Tenant B credentials
        },
        body: JSON.stringify({
          invoiceId: invoiceAId, // Tenant A invoice ID
        }),
      });

      const res = await intentRoute(req);
      expect(res.status).toBe(404);
    });

    it("blocks payment intent when invoice is flagged as prompt injection suspect", async () => {
      // Mark invoice as injection suspect
      await prisma.invoice.update({
        where: { id: invoiceAId },
        data: { isInjectionSuspect: true },
      });

      const req = new NextRequest("http://localhost:3000/api/payments/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `bizflow_session=${sessionCookieA}`,
        },
        body: JSON.stringify({
          invoiceId: invoiceAId,
        }),
      });

      const res = await intentRoute(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.allowed).toBe(false);
      expect(json.decision).toBe("block");
    });
  });

  describe("3. Receipt Verification & Replay Protection", () => {
    it("prevents replay attacks: rejects transaction hash already recorded for a payment", async () => {
      // Create pending intent
      const intent = await prisma.paymentIntent.create({
        data: {
          orgId: orgIdA,
          invoiceId: invoiceAId,
          vendorId: vendorAId,
          payerAddress: accountA.address.toLowerCase(),
          recipientAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase(),
          amountAtomic: 50_000n,
          tokenAddress: "0x3600000000000000000000000000000000000000",
          chainId: 5042002,
          expiresAt: new Date(Date.now() + 600000),
          status: "pending",
        },
      });

      const fakeTxHash = "0x1111111111111111111111111111111111111111111111111111111111111111";

      // Seed an existing confirmed payment with this txHash
      await prisma.payment.create({
        data: {
          orgId: orgIdA,
          invoiceId: invoiceAId,
          vendorId: vendorAId,
          network: "testnet",
          provider: "direct",
          idempotencyKey: "test-existing-payment-replay",
          amountAtomic: 50_000n,
          destination: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase(),
          status: "confirmed",
          txHash: fakeTxHash,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/payments/verify-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `bizflow_session=${sessionCookieA}`,
        },
        body: JSON.stringify({
          intentId: intent.id,
          txHash: fakeTxHash,
        }),
      });

      const res = await verifyReceiptRoute(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error).toContain("Replay violation");
    });

    it("rejects expired payment intents", async () => {
      // Create expired intent
      const expiredIntent = await prisma.paymentIntent.create({
        data: {
          orgId: orgIdA,
          invoiceId: invoiceAId,
          vendorId: vendorAId,
          payerAddress: accountA.address.toLowerCase(),
          recipientAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase(),
          amountAtomic: 50_000n,
          tokenAddress: "0x3600000000000000000000000000000000000000",
          chainId: 5042002,
          expiresAt: new Date(Date.now() - 1000), // Expired in past
          status: "pending",
        },
      });

      const req = new NextRequest("http://localhost:3000/api/payments/verify-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `bizflow_session=${sessionCookieA}`,
        },
        body: JSON.stringify({
          intentId: expiredIntent.id,
          txHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        }),
      });

      const res = await verifyReceiptRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("expired");
    });
  });

  describe("4. AuditAnchor Smart Contract ABI & Interface", () => {
    it("contains anchorProof and getAnchor signatures for non-custodial multi-tenant anchoring", () => {
      const functionNames = ANCHOR_ABI.filter((item) => item.type === "function").map((f: any) => f.name);
      expect(functionNames).toContain("anchorProof");
      expect(functionNames).toContain("getAnchor");
      expect(functionNames).toContain("isInvoiceAnchored");
      expect(functionNames).toContain("anchor");

      const eventNames = ANCHOR_ABI.filter((item) => item.type === "event").map((e: any) => e.name);
      expect(eventNames).toContain("ProofAnchored");
      expect(eventNames).toContain("Anchored");
    });
  });
});
