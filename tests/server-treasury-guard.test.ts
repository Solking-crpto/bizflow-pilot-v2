import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { executePaymentTransaction } from "@/lib/payments/executor";
import { getDb } from "@/lib/db";
import { POST as executeRoute } from "@/app/api/payments/execute/route";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";

const prisma = getDb("testnet");

describe("Server Treasury Non-Custodial Isolation Guard", () => {
  const originalEnv = { ...process.env };
  const ADMIN_WALLET = "0x061F5c70D68A246b654724C0f9595F3a14cF9b0B";
  const PUBLIC_USER_WALLET = "0x1111111111111111111111111111111111111111";

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ADMIN_WALLET_ADDRESS = ADMIN_WALLET;
    process.env.OWNER_PASSCODE = "test_passcode_123";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("strictly rejects execution on testnet when called by a non-admin session", async () => {
    // Public user session token
    const token = createSessionToken({
      address: PUBLIC_USER_WALLET,
      orgId: "org-public-testnet",
      role: "owner",
      expiresAt: Date.now() + 60000,
    });

    const req = new NextRequest("http://localhost:3001/api/payments/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bizflow-Network": "testnet",
        cookie: `bizflow_session=${token}; bizflow_network=testnet`,
      },
      body: JSON.stringify({
        invoiceId: "inv-testnet-01",
        passcode: "test_passcode_123",
      }),
    });

    const res = await executeRoute(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/(Public organizations must sign payments|Server treasury execution is restricted)/i);
  });

  it("strictly rejects execution on mainnet when called by a non-admin session", async () => {
    // Public user session token
    const token = createSessionToken({
      address: PUBLIC_USER_WALLET,
      orgId: "org-public-mainnet",
      role: "owner",
      expiresAt: Date.now() + 60000,
    });

    const req = new NextRequest("http://localhost:3001/api/payments/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bizflow-Network": "mainnet",
        cookie: `bizflow_session=${token}; bizflow_network=mainnet`,
      },
      body: JSON.stringify({
        invoiceId: "inv-mainnet-01",
        passcode: "test_passcode_123",
      }),
    });

    const res = await executeRoute(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/Public organizations must sign payments with their own wallet/i);
  });

  it("strictly rejects executePaymentTransaction when invoice organization is not admin", async () => {
    // Generate unique random wallet address
    const uniqueUserWallet = "0x" + Math.random().toString(16).slice(2).padStart(40, "0").slice(0, 40);

    // Mock public org and invoice in database
    const org = await prisma.organization.create({
      data: {
        name: `Public SME Corp ${Date.now()}`,
        walletAddress: uniqueUserWallet,
        country: "US",
        settings: {
          create: {
            requireApprovalAbove: 10000000n,
            priceToleranceBps: 100,
            minReserveUsdc: 1000000n,
            dailyLimitUsdc: 10000000n,
          },
        },
      },
    });

    const vendor = await prisma.vendor.create({
      data: {
        orgId: org.id,
        name: "Public Vendor",
        walletAddress: "0x2222222222222222222222222222222222222222",
        status: "active",
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        orgId: org.id,
        vendorId: vendor.id,
        invoiceNumber: `INV-PUB-${Date.now()}`,
        totalUsdc: 100000n,
        rawContent: "Test public invoice",
        fileHash: `file-hash-${Date.now()}`,
        extractedData: JSON.stringify({ amount: "0.10" }),
        status: "pending",
      },
    });

    const result = await executePaymentTransaction({
      invoiceId: invoice.id,
      actor: "human",
      hasOwnerConfirmation: true,
      network: "testnet",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/(Non-custodial invariant violation|Server treasury execution is restricted)/i);
  });
});
