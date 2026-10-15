import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { validateApiNetwork } from "../lib/api-guard";

describe("Network Header Mismatch Protection (409 Conflict)", () => {
  it("rejects POST with cookie=mainnet and header=testnet with 409 Conflict", async () => {
    const req = new NextRequest("http://localhost:3002/api/suppliers", {
      method: "POST",
      headers: {
        cookie: "bizflow_network=mainnet",
        "X-Bizflow-Network": "testnet",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Rogue Vendor", walletAddress: "0x1234567890123456789012345678901234567890" }),
    });

    const result = validateApiNetwork(req);
    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(409);

    const body = await result.response?.json();
    expect(body.code).toBe("NETWORK_MISMATCH_CONFLICT");
    expect(body.cookieNetwork).toBe("mainnet");
    expect(body.headerNetwork).toBe("testnet");
    expect(body.error).toContain("Network conflict: Tab target network 'testnet' does not match active session network 'mainnet'");
  });

  it("rejects POST with cookie=testnet and header=mainnet with 409 Conflict", async () => {
    const req = new NextRequest("http://localhost:3002/api/suppliers", {
      method: "POST",
      headers: {
        cookie: "bizflow_network=testnet",
        "X-Bizflow-Network": "mainnet",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Rogue Vendor", walletAddress: "0x1234567890123456789012345678901234567890" }),
    });

    const result = validateApiNetwork(req);
    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(409);

    const body = await result.response?.json();
    expect(body.code).toBe("NETWORK_MISMATCH_CONFLICT");
    expect(body.cookieNetwork).toBe("testnet");
    expect(body.headerNetwork).toBe("mainnet");
    expect(body.error).toContain("Network conflict: Tab target network 'mainnet' does not match active session network 'testnet'");
  });

  it("rejects POST with missing X-Bizflow-Network header with 409 Conflict", async () => {
    const req = new NextRequest("http://localhost:3002/api/suppliers", {
      method: "POST",
      headers: {
        cookie: "bizflow_network=mainnet",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Rogue Vendor" }),
    });

    const result = validateApiNetwork(req);
    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(409);

    const body = await result.response?.json();
    expect(body.code).toBe("MISSING_NETWORK_HEADER");
    expect(body.error).toContain("Missing required header 'X-Bizflow-Network'");
  });

  it("allows matching cookie and header", async () => {
    const req = new NextRequest("http://localhost:3002/api/suppliers", {
      method: "POST",
      headers: {
        cookie: "bizflow_network=testnet",
        "X-Bizflow-Network": "testnet",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Valid Vendor" }),
    });

    const result = validateApiNetwork(req);
    expect(result.success).toBe(true);
    expect(result.network).toBe("testnet");
    expect(result.db).toBeDefined();
  });
});
