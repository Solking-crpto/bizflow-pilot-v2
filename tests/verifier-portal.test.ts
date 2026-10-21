import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../lib/db";
import { NextRequest } from "next/server";
import {
  generateToken,
  generateAccessCode,
  generateChallengeCode,
  VERIFIER_SESSION_COOKIE,
} from "../lib/verification/security";

describe("Phase 8: Mobile Verifier Portal & Endpoints", () => {
  const db = getDb("testnet");
  let testOrgId: string;
  let rawToken: string;
  let tokenHash: string;
  let rawAccessCode: string;
  let accessCodeHash: string;
  let challengeCode: string;
  let requestId: string;
  let verifierSessionCookie: string;
  let uploadedFileId: string;

  beforeAll(async () => {
    const org = await db.organization.findFirst({
      include: { purchaseOrders: { include: { lines: true } } },
    });
    if (!org) throw new Error("No organization found in testnet");
    testOrgId = org.id;

    const po = org.purchaseOrders[0] || (await db.purchaseOrder.findFirst({ where: { orgId: testOrgId } }));

    const tok = generateToken();
    rawToken = tok.rawToken;
    tokenHash = tok.tokenHash;

    const acc = generateAccessCode();
    rawAccessCode = acc.rawCode;
    accessCodeHash = acc.codeHash;

    challengeCode = generateChallengeCode();

    const req = await db.deliveryRequest.create({
      data: {
        orgId: testOrgId,
        purchaseOrderId: po?.id || null,
        tokenHash,
        accessCodeHash,
        challengeCode,
        expiresAt: new Date(Date.now() + 86400000),
        status: "pending",
      },
    });
    requestId = req.id;
  });

  it("GET /api/verifier/portal: returns unauthenticated status before login", async () => {
    const { GET } = await import("../app/api/verifier/portal/route");

    const req = new NextRequest(`http://localhost:3002/api/verifier/portal?token=${rawToken}`, {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.authenticated).toBe(false);
    expect(data.locked).toBe(false);
    expect(data.remainingAttempts).toBe(5);
  });

  it("POST /api/verifier/auth: rejects wrong access code and decrements remaining attempts", async () => {
    const { POST } = await import("../app/api/verifier/auth/route");

    const req = new NextRequest("http://localhost:3002/api/verifier/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawToken, accessCode: "WRONG1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();

    expect(data.locked).toBe(false);
    expect(data.remainingAttempts).toBe(4);
  });

  it("POST /api/verifier/auth: unlocks portal with correct access code and sets session cookie", async () => {
    const { POST } = await import("../app/api/verifier/auth/route");

    const req = new NextRequest("http://localhost:3002/api/verifier/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawToken, accessCode: rawAccessCode }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.authenticated).toBe(true);

    // Verify Set-Cookie header contains v2_verifier_session
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain(VERIFIER_SESSION_COOKIE);

    const match = setCookie.match(new RegExp(`${VERIFIER_SESSION_COOKIE}=([^;]+)`));
    verifierSessionCookie = match ? match[1] : "";
    expect(verifierSessionCookie.length).toBeGreaterThan(10);
  });

  it("GET /api/verifier/portal: returns order summary without prices when session is authenticated", async () => {
    const { GET } = await import("../app/api/verifier/portal/route");

    const req = new NextRequest(`http://localhost:3002/api/verifier/portal?token=${rawToken}`, {
      method: "GET",
      headers: {
        Cookie: `${VERIFIER_SESSION_COOKIE}=${verifierSessionCookie}`,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.authenticated).toBe(true);
    expect(data.challengeCode).toBe(challengeCode);
    expect(data.orderSummary).toBeDefined();
    expect(data.orderSummary.vendorName).toBeDefined();

    // Verify STRICT privacy invariant: no confidential pricing is exposed
    const stringified = JSON.stringify(data.orderSummary);
    expect(stringified).not.toContain("unitPrice");
    expect(stringified).not.toContain("totalUsdc");
  });

  it("POST /api/verifier/upload-url: generates signed direct upload URL", async () => {
    const { POST } = await import("../app/api/verifier/upload-url/route");

    const req = new NextRequest("http://localhost:3002/api/verifier/upload-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${VERIFIER_SESSION_COOKIE}=${verifierSessionCookie}`,
      },
      body: JSON.stringify({
        token: rawToken,
        fileName: "delivery_goods.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 102400,
        kind: "photo",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.fileId).toBeDefined();
    expect(data.uploadUrl).toBeDefined();
    uploadedFileId = data.fileId;
  });

  it("POST /api/verifier/submit: rejects if privacy consent is not given", async () => {
    const { POST } = await import("../app/api/verifier/submit/route");

    const req = new NextRequest("http://localhost:3002/api/verifier/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${VERIFIER_SESSION_COOKIE}=${verifierSessionCookie}`,
      },
      body: JSON.stringify({
        token: rawToken,
        receivedQuantities: { "Sample Item": 10 },
        verifierName: "John Receiver",
        verifierContact: "+1234567890",
        consentGiven: false, // Not given
        fileIds: [uploadedFileId],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Consent required");
  });

  it("POST /api/verifier/submit: records verification proof, runs conditions engine, and locks portal", async () => {
    const { POST } = await import("../app/api/verifier/submit/route");

    const req = new NextRequest("http://localhost:3002/api/verifier/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${VERIFIER_SESSION_COOKIE}=${verifierSessionCookie}`,
      },
      body: JSON.stringify({
        token: rawToken,
        receivedQuantities: { "Sample Item": 10 },
        verifierName: "John Receiver",
        verifierContact: "+1234567890",
        note: "All boxes sealed and intact",
        consentGiven: true,
        fileIds: [uploadedFileId],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.submissionId).toBeDefined();
    expect(data.overall).toBeDefined(); // ready, needs_review, or failed
  });
});
