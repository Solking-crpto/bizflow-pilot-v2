import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../lib/db";
import { NextRequest } from "next/server";
import { createSessionToken } from "../lib/auth/session";

describe("Phase 7: Delivery Proof Management Endpoints", () => {
  const db = getDb("testnet");
  let testOrgId: string;
  let testPoId: string;
  let testInvoiceId: string;
  let authCookie: string;
  let createdRequestId: string;
  let createdRawToken: string;

  beforeAll(async () => {
    // 1. Get or create test organization
    const org = await db.organization.findFirst({
      include: { vendors: true },
    });
    if (!org) throw new Error("No organization found in testnet");
    testOrgId = org.id;

    // 2. Create auth session token
    const token = createSessionToken({
      address: org.walletAddress,
      orgId: testOrgId,
      role: "owner",
      expiresAt: Date.now() + 86400000,
    });
    authCookie = `bizflow_session=${token}; bizflow_network=testnet`;

    // 3. Find or create a PO and Invoice
    const po = await db.purchaseOrder.findFirst({ where: { orgId: testOrgId } });
    if (po) testPoId = po.id;

    const invoice = await db.invoice.findFirst({ where: { orgId: testOrgId } });
    if (invoice) testInvoiceId = invoice.id;
  });

  it("POST /api/delivery-proof/request: creates delivery request with single-reveal token and access code", async () => {
    const { POST } = await import("../app/api/delivery-proof/request/route");

    const req = new NextRequest("http://localhost:3002/api/delivery-proof/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bizflow-Network": "testnet",
        Cookie: authCookie,
      },
      body: JSON.stringify({
        purchaseOrderId: testPoId || undefined,
        invoiceId: testInvoiceId || undefined,
        verifierName: "Test Warehouse Lead",
        verifierContact: "+1234567890",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.requestId).toBeDefined();
    expect(data.token).toHaveLength(64);
    expect(data.accessCode).toHaveLength(6);
    expect(data.challengeCode).toHaveLength(4);
    expect(data.shareUrl).toContain(`/verify-delivery/${data.token}`);
    expect(data.waLink).toContain("https://wa.me/?text=");
    expect(data.mailtoLink).toContain("mailto:");

    createdRequestId = data.requestId;
    createdRawToken = data.token;
  });

  it("GET /api/delivery-proof/[id]: retrieves request details and signed evidence links", async () => {
    const { GET } = await import("../app/api/delivery-proof/[id]/route");

    const req = new NextRequest(`http://localhost:3002/api/delivery-proof/${createdRequestId}`, {
      method: "GET",
      headers: {
        "X-Bizflow-Network": "testnet",
        Cookie: authCookie,
      },
    });

    const res = await GET(req, { params: { id: createdRequestId } });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.deliveryRequest.id).toBe(createdRequestId);
    expect(data.deliveryRequest.status).toBe("pending");
    // Verify raw token is NOT returned in query
    expect(data.deliveryRequest.token).toBeUndefined();
    expect(data.deliveryRequest.tokenHash).toBeDefined();
  });

  it("POST /api/delivery-proof/[id]/regenerate-code: generates new access code and resets lockout", async () => {
    const { POST } = await import("../app/api/delivery-proof/[id]/regenerate-code/route");

    const req = new NextRequest(`http://localhost:3002/api/delivery-proof/${createdRequestId}/regenerate-code`, {
      method: "POST",
      headers: {
        "X-Bizflow-Network": "testnet",
        Cookie: authCookie,
      },
    });

    const res = await POST(req, { params: { id: createdRequestId } });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.accessCode).toHaveLength(6);
  });

  it("POST /api/delivery-proof/[id]/decision: records owner decision", async () => {
    const { POST } = await import("../app/api/delivery-proof/[id]/decision/route");

    const req = new NextRequest(`http://localhost:3002/api/delivery-proof/${createdRequestId}/decision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bizflow-Network": "testnet",
        Cookie: authCookie,
      },
      body: JSON.stringify({
        action: "approve",
        notes: "Audited and verified in person by owner",
      }),
    });

    const res = await POST(req, { params: { id: createdRequestId } });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.status).toBe("approved");
  });

  it("POST /api/delivery-proof/[id]/revoke: invalidates verification token", async () => {
    const { POST } = await import("../app/api/delivery-proof/[id]/revoke/route");

    const req = new NextRequest(`http://localhost:3002/api/delivery-proof/${createdRequestId}/revoke`, {
      method: "POST",
      headers: {
        "X-Bizflow-Network": "testnet",
        Cookie: authCookie,
      },
    });

    const res = await POST(req, { params: { id: createdRequestId } });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.status).toBe("revoked");
  });

  it("GET /api/delivery-proof/templates: returns condition templates", async () => {
    const { GET } = await import("../app/api/delivery-proof/templates/route");

    const req = new NextRequest("http://localhost:3002/api/delivery-proof/templates", {
      method: "GET",
      headers: {
        "X-Bizflow-Network": "testnet",
        Cookie: authCookie,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(Array.isArray(data.templates)).toBe(true);
    expect(data.templates.length).toBeGreaterThanOrEqual(1);
  });
});
