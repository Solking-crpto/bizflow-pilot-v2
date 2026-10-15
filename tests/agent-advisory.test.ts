import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../lib/db";

const prisma = getDb("testnet");
import { createSessionToken } from "../lib/auth/session";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { NextRequest } from "next/server";
import { POST as analyzeRoute } from "../app/api/agent/analyze/route";
import { evaluatePaymentTiming } from "../lib/agent/timing";
import { usdcAtomic } from "../lib/money";

describe("Phase 5 — Advisory Agent (Proposes, Explains, NEVER Signs)", () => {
  const accountUser = privateKeyToAccount(generatePrivateKey());
  const orgId = "org-test-advisory-phase5";

  const sessionCookie = createSessionToken({
    address: accountUser.address.toLowerCase(),
    orgId,
    role: "owner",
    expiresAt: Date.now() + 3600000,
  });

  let vendorId: string;
  let invoiceId: string;

  beforeEach(async () => {
    // Clean up test data
    await prisma.agentDecision.deleteMany({
      where: { orgId },
    });
    await prisma.payment.deleteMany({
      where: { orgId },
    });
    await prisma.invoice.deleteMany({
      where: { orgId },
    });
    await prisma.vendor.deleteMany({
      where: { orgId },
    });
    await prisma.setting.deleteMany({
      where: { orgId },
    });
    await prisma.organization.deleteMany({
      where: { id: orgId },
    });

    // Create test organization
    await prisma.organization.create({
      data: {
        id: orgId,
        name: "Advisory Test Org",
        walletAddress: accountUser.address.toLowerCase(),
        isPilot: false,
        settings: {
          create: {
            minReserveUsdc: 2_000_000n, // 2.00 USDC
            autoApproveLimitUsdc: 500_000n, // 0.50 USDC
          },
        },
      },
    });

    // Create approved vendor
    const vendor = await prisma.vendor.create({
      data: {
        orgId,
        name: "Cloud Hosting Ltd",
        walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".toLowerCase(),
        status: "active",
        perVendorLimitUsdc: 25_000_000n,
      },
    });
    vendorId = vendor.id;

    // Create an open verified invoice
    const invoice = await prisma.invoice.create({
      data: {
        orgId,
        vendorId,
        invoiceNumber: "INV-ADVISORY-101",
        fileHash: "0x" + "a".repeat(64),
        totalUsdc: 1_500_000n, // 1.50 USDC
        status: "verified",
        matchStatus: "exact_match",
        duplicateScore: 0,
        isInjectionSuspect: false,
        rawContent: "Standard monthly hosting invoice",
        extractedData: "{}",
        dueDate: new Date(Date.now() + 86400000 * 5),
        earlyPayDiscountPct: 2.0,
        earlyPayDays: 10,
        network: "testnet",
      },
    });
    invoiceId = invoice.id;
  });

  it("1. Refuses unauthenticated requests to POST /api/agent/analyze", async () => {
    const req = new NextRequest("http://localhost:3000/api/agent/analyze", {
      method: "POST",
      headers: {
        "x-bizflow-network": "testnet",
        cookie: "bizflow_network=testnet",
      },
    });

    const res = await analyzeRoute(req);
    expect(res.status).toBe(401);
  });

  it("2. Produces advisory recommendations with outcome='proposed' and never executes a payment", async () => {
    const req = new NextRequest("http://localhost:3000/api/agent/analyze", {
      method: "POST",
      headers: {
        cookie: `bizflow_session=${sessionCookie}; bizflow_network=testnet`,
        "x-bizflow-network": "testnet",
      },
    });

    const res = await analyzeRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.nonCustodialNotice).toContain("Every payment requires your wallet signature");
    expect(body.recommendations.length).toBe(1);

    const rec = body.recommendations[0];
    expect(rec.invoiceNumber).toBe("INV-ADVISORY-101");
    expect(rec.choice).toBeDefined();

    // Verify AgentDecision row was created with outcome="proposed"
    const decision = await prisma.agentDecision.findFirst({
      where: { orgId, invoiceId },
    });

    expect(decision).toBeDefined();
    expect(decision?.outcome).toBe("proposed");
    expect(decision?.choice).toBe(rec.choice);

    // INVARIANT: Server MUST NEVER create a payment or execute
    const paymentCount = await prisma.payment.count({
      where: { orgId },
    });
    expect(paymentCount).toBe(0);
  });

  it("3. Incorporates cash position and holds/schedules when liquidity is below minimum reserve", () => {
    const timing = evaluatePaymentTiming({
      invoiceId: "inv-test-3",
      invoiceNumber: "INV-TEST-03",
      totalUsdc: 10_000_000n, // 10.00 USDC
      dueDate: new Date(Date.now() + 86400000 * 10),
      earlyPayDiscountPct: 0,
      earlyPayDays: 0,
      createdAt: new Date(),
      availableTreasuryUsdc: 5_000_000n, // 5.00 USDC
      minReserveUsdc: 2_000_000n, // 2.00 USDC
      upcomingObligationsUsdc: 0n,
    });

    // Should schedule or hold because payment would breach minReserve
    expect(["schedule", "hold", "escalate"]).toContain(timing.choice);
  });

  it("4. Recommends pay_now with early-pay discount when liquidity is abundant", () => {
    const timing = evaluatePaymentTiming({
      invoiceId: "inv-test-4",
      invoiceNumber: "INV-TEST-04",
      totalUsdc: 1_000_000n, // 1.00 USDC
      dueDate: new Date(Date.now() + 86400000 * 20),
      earlyPayDiscountPct: 2.5,
      earlyPayDays: 10,
      createdAt: new Date(),
      availableTreasuryUsdc: 50_000_000n, // 50.00 USDC
      minReserveUsdc: 5_000_000n, // 5.00 USDC
      upcomingObligationsUsdc: 0n,
    });

    expect(timing.choice).toBe("pay_now");
    expect(timing.discountAvailable).toBe(true);
    expect(timing.discountCapturedUsdc).toBeGreaterThan(0);
  });

  it("5. Respects per-organization daily advisory budget cap (20 runs)", async () => {
    // Seed 20 decisions for today
    const now = new Date();
    const fakeDecisions = Array.from({ length: 20 }).map((_, i) => ({
      orgId,
      invoiceId,
      observationHash: "0x123",
      cashPosition: "10.00 USDC",
      choice: "pay_now",
      reasoning: "Test run",
      source: "llm",
      model: "test-model",
      promptVersion: "v2.0",
      outcome: "proposed",
      timestamp: now,
    }));

    await prisma.agentDecision.createMany({
      data: fakeDecisions,
    });

    const req = new NextRequest("http://localhost:3000/api/agent/analyze", {
      method: "POST",
      headers: {
        cookie: `bizflow_session=${sessionCookie}; bizflow_network=testnet`,
        "x-bizflow-network": "testnet",
      },
    });

    const res = await analyzeRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.budgetNotice).toContain("Daily AI budget reached; using deterministic business logic.");
    expect(body.recommendations[0].source).toBe("fallback");
    expect(body.recommendations[0].modelName).toBe("deterministic-fallback");
  });
});
