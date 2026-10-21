import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../lib/db";
import { evaluatePolicy, PolicyContext } from "../lib/policy/engine";
import { parseUsdc } from "../lib/money";
import { recordAuditEvent, verifyAuditChain } from "../lib/audit/ledger";
import { POST as intentHandler } from "../app/api/payments/intent/route";
import { NextRequest } from "next/server";
import { createSessionToken } from "../lib/auth/session";
import crypto from "crypto";

const db = getDb("testnet");

describe("Phase 9: Payment Gating Policy & Hash-Chained Audit Integration", () => {
  describe("RULE_DELIVERY_VERIFICATION Pure Policy Invariants (Offline/Deterministic)", () => {
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
        id: "vendor-pure-01",
        name: "Northgate Cement Supply (demo vendor)",
        status: "active",
        recordedWallet: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        perVendorLimitUsdc: parseUsdc("15000.00"),
        walletCooldownUntil: null,
      },
      invoice: {
        id: "inv-gate-01",
        invoiceNumber: "INV-GATE-01",
        totalUsdc: parseUsdc("1200.00"),
        remittanceWallet: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        matchStatus: "exact_match",
        duplicateScore: 0,
        isInjectionSuspect: false,
        hasExistingPaymentForNetwork: false,
        isHumanApproved: true,
      },
    };

    it("Regression invariant: deliveryProofMode 'off' behaves 100% identically to baseline", () => {
      const res = evaluatePolicy({
        ...baseContext,
        invoice: {
          ...baseContext.invoice,
          deliveryProofMode: "off",
        },
      });

      expect(res.decision).toBe("approve");
      const deliveryRule = res.results.find((r) => r.ruleCode === "RULE_DELIVERY_VERIFICATION");
      expect(deliveryRule).toBeDefined();
      expect(deliveryRule?.passed).toBe(true);
      expect(deliveryRule?.reason).toContain("Delivery proof mode is off");
    });

    it("Blocks payment when deliveryProofMode is 'required' and delivery is unverified", () => {
      const res = evaluatePolicy({
        ...baseContext,
        invoice: {
          ...baseContext.invoice,
          deliveryProofMode: "required",
          deliveryStatus: "pending",
          deliveryRequestId: "req-pending-99",
          deliveryConditionsMet: false,
        },
      });

      expect(res.decision).toBe("block");
      const deliveryRule = res.results.find((r) => r.ruleCode === "RULE_DELIVERY_VERIFICATION");
      expect(deliveryRule?.passed).toBe(false);
      expect(deliveryRule?.reason).toBe("Delivery proof required but not verified; request #req-pending-99");
      expect(res.summary).toContain("Delivery Proof Verification Guard");
    });

    it("Approves payment when deliveryProofMode is 'required' and delivery is approved", () => {
      const res = evaluatePolicy({
        ...baseContext,
        invoice: {
          ...baseContext.invoice,
          deliveryProofMode: "required",
          deliveryStatus: "approved",
          deliveryRequestId: "req-approved-99",
          deliveryConditionsMet: true,
        },
      });

      expect(res.decision).toBe("approve");
      const deliveryRule = res.results.find((r) => r.ruleCode === "RULE_DELIVERY_VERIFICATION");
      expect(deliveryRule?.passed).toBe(true);
      expect(deliveryRule?.reason).toContain("Delivery proof verified and approved");
    });

    it("Permits payment when owner supplies explicit override rationale", () => {
      const res = evaluatePolicy({
        ...baseContext,
        invoice: {
          ...baseContext.invoice,
          deliveryProofMode: "required",
          deliveryStatus: "pending",
          deliveryRequestId: "req-overridden-99",
          deliveryConditionsMet: false,
          ownerOverrideReason: "Owner override: Production site manager confirmed physical intake by phone",
        },
      });

      expect(res.decision).toBe("approve");
      const deliveryRule = res.results.find((r) => r.ruleCode === "RULE_DELIVERY_VERIFICATION");
      expect(deliveryRule?.passed).toBe(true);
      expect(deliveryRule?.reason).toContain("Owner override: Production site manager confirmed physical intake by phone");
    });
  });

  describe("API Intent Gating & Owner Override", () => {
    let testInvoiceId: string;
    let authCookie: string;

    beforeAll(async () => {
      const org = await db.organization.findFirst({
        include: { vendors: true, invoices: true },
      });
      if (!org) throw new Error("No organization found in testnet");

      const token = createSessionToken({
        address: org.walletAddress,
        orgId: org.id,
        role: "owner",
        expiresAt: Date.now() + 86400000,
      });
      authCookie = `bizflow_session=${token}; bizflow_network=testnet`;

      // Find or create an invoice with deliveryProofMode: "required"
      let invoice = await db.invoice.findFirst({
        where: { orgId: org.id, status: { not: "paid" } },
      });

      if (!invoice) {
        invoice = await db.invoice.create({
          data: {
            orgId: org.id,
            vendorId: org.vendors[0]?.id || "vendor-fallback",
            invoiceNumber: `INV-GATING-${Date.now()}`,
            fileHash: crypto.randomBytes(32).toString("hex"),
            extractedData: JSON.stringify({}),
            totalUsdc: 500_000n,
            status: "pending_verification",
            matchStatus: "exact_match",
            deliveryProofMode: "required",
          },
        });
      } else {
        invoice = await db.invoice.update({
          where: { id: invoice.id },
          data: { deliveryProofMode: "required" },
        });
      }
      testInvoiceId = invoice.id;
    });

    it("POST /api/payments/intent rejects unverified required delivery proof, and allows with owner override", async () => {
      const headers = {
        "Content-Type": "application/json",
        "X-Bizflow-Network": "testnet",
        Cookie: authCookie,
      };

      // 1. Attempt without override -> 403 block
      const blockReq = new NextRequest("http://localhost:3002/api/payments/intent", {
        method: "POST",
        headers,
        body: JSON.stringify({ invoiceId: testInvoiceId }),
      });

      const blockRes = await intentHandler(blockReq);
      expect(blockRes.status).toBe(403);
      const blockData = await blockRes.json();
      expect(blockData.allowed).toBe(false);
      expect(blockData.decision).toBe("block");
      expect(blockData.reasons.some((r: string) => r.includes("Delivery proof required but not verified"))).toBe(true);

      // 2. Attempt with ownerOverrideReason -> 200 allowed
      const overrideReq = new NextRequest("http://localhost:3002/api/payments/intent", {
        method: "POST",
        headers,
        body: JSON.stringify({
          invoiceId: testInvoiceId,
          ownerOverrideReason: "Owner override: Field director signed off on shipment",
        }),
      });

      const overrideRes = await intentHandler(overrideReq);
      expect(overrideRes.status).toBe(200);
      const overrideData = await overrideRes.json();
      expect(overrideData.allowed).toBe(true);
      expect(overrideData.intent.id).toBeDefined();

      // Check intent in DB has isOverridden: true
      const intentDb = await db.paymentIntent.findUnique({
        where: { id: overrideData.intent.id },
      });
      expect(intentDb?.isOverridden).toBe(true);
      expect(intentDb?.overrideReason).toBe("Owner override: Field director signed off on shipment");
    });
  });

  describe("SHA-256 Hash-Chained Audit Ledger Lifecycle Events", () => {
    const testOrgId = `org-chain-${Date.now()}`;
    const dummyTokenHash = crypto.createHash("sha256").update("token_12345").digest("hex");
    const dummyFileHash = crypto.createHash("sha256").update("image_bytes").digest("hex");
    const dummyReportHash = crypto.createHash("sha256").update("assessment_json").digest("hex");

    beforeAll(async () => {
      await db.organization.create({
        data: {
          id: testOrgId,
          name: "Audit Chain Test Org",
        },
      });
    });

    it("records all 6 delivery verification lifecycle events and verifies cryptographic chain integrity", async () => {
      // 1. delivery_request_created
      const ev1 = await recordAuditEvent(
        {
          orgId: testOrgId,
          eventType: "delivery_request_created",
          referenceId: "req-audit-01",
          eventData: {
            requestId: "req-audit-01",
            tokenHash: dummyTokenHash,
            challengeCode: "7G4K",
          },
        },
        "testnet"
      );
      expect(ev1.prevHash).toBe("0000000000000000000000000000000000000000000000000000000000000000");

      // 2. access_code_entered (failed)
      const ev2 = await recordAuditEvent(
        {
          orgId: testOrgId,
          eventType: "access_code_entered",
          referenceId: "req-audit-01",
          eventData: {
            requestId: "req-audit-01",
            success: false,
            remainingAttempts: 4,
          },
        },
        "testnet"
      );
      expect(ev2.prevHash).toBe(ev1.eventHash);

      // 3. access_code_entered (success)
      const ev3 = await recordAuditEvent(
        {
          orgId: testOrgId,
          eventType: "access_code_entered",
          referenceId: "req-audit-01",
          eventData: {
            requestId: "req-audit-01",
            success: true,
          },
        },
        "testnet"
      );
      expect(ev3.prevHash).toBe(ev2.eventHash);

      // 4. evidence_uploaded
      const ev4 = await recordAuditEvent(
        {
          orgId: testOrgId,
          eventType: "evidence_uploaded",
          referenceId: "file-audit-01",
          eventData: {
            requestId: "req-audit-01",
            fileId: "file-audit-01",
            sha256: dummyFileHash,
            mime: "image/jpeg",
          },
        },
        "testnet"
      );
      expect(ev4.prevHash).toBe(ev3.eventHash);

      // 5. assessment_generated
      const ev5 = await recordAuditEvent(
        {
          orgId: testOrgId,
          eventType: "assessment_generated",
          referenceId: "rep-audit-01",
          eventData: {
            requestId: "req-audit-01",
            reportId: "rep-audit-01",
            reportHash: dummyReportHash,
            overall: "ready",
          },
        },
        "testnet"
      );
      expect(ev5.prevHash).toBe(ev4.eventHash);

      // 6. delivery_approved
      const ev6 = await recordAuditEvent(
        {
          orgId: testOrgId,
          eventType: "delivery_approved",
          referenceId: "req-audit-01",
          eventData: {
            requestId: "req-audit-01",
            decisionBy: "0x123",
            status: "approved",
          },
        },
        "testnet"
      );
      expect(ev6.prevHash).toBe(ev5.eventHash);

      // 7. delivery_overridden
      const ev7 = await recordAuditEvent(
        {
          orgId: testOrgId,
          eventType: "delivery_overridden",
          referenceId: "inv-audit-01",
          eventData: {
            invoiceId: "inv-audit-01",
            reason: "Owner override: Site inspection complete",
            actor: "human",
          },
        },
        "testnet"
      );
      expect(ev7.prevHash).toBe(ev6.eventHash);

      // Traversal and cryptographic verification of the entire hash chain
      const verification = await verifyAuditChain(testOrgId, "testnet");
      expect(verification.valid).toBe(true);
      expect(verification.totalEvents).toBe(7);
      expect(verification.tamperedIndex).toBeUndefined();
    });
  });
});
