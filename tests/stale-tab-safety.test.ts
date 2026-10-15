import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as paymentIntentRoute } from "../app/api/payments/intent/route";
import { createSessionToken } from "../lib/auth/session";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

describe("Stale Tab Safety & Race-Condition Defense", () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const address = account.address.toLowerCase();

  const sessionToken = createSessionToken({
    address,
    orgId: "org-stale-test",
    role: "owner",
    expiresAt: Date.now() + 3600000,
  });

  it("Tab A on testnet rejected when Tab B switches cookie to mainnet", async () => {
    // Scenario:
    // 1. User opened Tab A on testnet.
    // 2. User opened Tab B and switched network to mainnet. Cookie is now 'bizflow_network=mainnet'.
    // 3. Tab A, still displaying testnet UI, submits a payment intent for a testnet invoice.
    //    Tab A includes its render-time network: 'X-Bizflow-Network: testnet'.
    const req = new NextRequest("http://localhost:3002/api/payments/intent", {
      method: "POST",
      headers: {
        cookie: `bizflow_session=${sessionToken}; bizflow_network=mainnet`,
        "x-bizflow-network": "testnet",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        invoiceId: "inv-testnet-01",
      }),
    });

    const res = await paymentIntentRoute(req);
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.code).toBe("NETWORK_MISMATCH_CONFLICT");
    expect(body.cookieNetwork).toBe("mainnet");
    expect(body.headerNetwork).toBe("testnet");
    expect(body.error).toContain("Network conflict");
  });

  it("Tab A on mainnet rejected when Tab B switches cookie to testnet", async () => {
    const req = new NextRequest("http://localhost:3002/api/payments/intent", {
      method: "POST",
      headers: {
        cookie: `bizflow_session=${sessionToken}; bizflow_network=testnet`,
        "x-bizflow-network": "mainnet",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        invoiceId: "inv-mainnet-01",
      }),
    });

    const res = await paymentIntentRoute(req);
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.code).toBe("NETWORK_MISMATCH_CONFLICT");
    expect(body.cookieNetwork).toBe("testnet");
    expect(body.headerNetwork).toBe("mainnet");
  });
});
