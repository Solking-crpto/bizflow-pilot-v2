import { describe, it, expect } from "vitest";
import { checkRateLimit, rateLimitExceededResponse, getClientIp } from "../lib/security/rateLimit";
import { assertValidSandboxMode } from "../lib/networks";
import nextConfig from "../next.config.mjs";
import { GET as metricsGet } from "../app/api/metrics/route";

describe("Phase 6 — Safety, Legal & Public Readiness", () => {
  it("1. Verifies next.config.mjs enforces strict security headers", async () => {
    expect(nextConfig.headers).toBeDefined();
    const headersConfig = await nextConfig.headers!();
    expect(headersConfig.length).toBeGreaterThan(0);

    const globalHeaders = headersConfig[0].headers;
    const headerKeys = globalHeaders.map((h: { key: string }) => h.key);

    expect(headerKeys).toContain("X-Frame-Options");
    expect(headerKeys).toContain("X-Content-Type-Options");
    expect(headerKeys).toContain("Referrer-Policy");
    expect(headerKeys).toContain("Strict-Transport-Security");
    expect(headerKeys).toContain("Content-Security-Policy");

    const frameHeader = globalHeaders.find((h: { key: string }) => h.key === "X-Frame-Options");
    expect(frameHeader.value).toBe("DENY");

    const nosniffHeader = globalHeaders.find((h: { key: string }) => h.key === "X-Content-Type-Options");
    expect(nosniffHeader.value).toBe("nosniff");
  });

  it("2. Verifies sliding window rate limiter blocks requests exceeding threshold", () => {
    const testKey = `test-ip-${Date.now()}`;
    const limit = 5;

    // First 5 should succeed
    for (let i = 0; i < limit; i++) {
      const res = checkRateLimit(testKey, limit, 60_000);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(limit - (i + 1));
    }

    // 6th request must be rejected
    const blockedRes = checkRateLimit(testKey, limit, 60_000);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.remaining).toBe(0);
    expect(blockedRes.retryAfterSeconds).toBeGreaterThan(0);

    // 429 response verification
    const response429 = rateLimitExceededResponse(blockedRes.retryAfterSeconds);
    expect(response429.status).toBe(429);
    expect(response429.headers.get("Retry-After")).toBe(blockedRes.retryAfterSeconds.toString());
  });

  it("3. Verifies assertValidSandboxMode strictly throws on Arc Mainnet with PUBLIC_SANDBOX", () => {
    const origMode = process.env.NEXT_PUBLIC_NETWORK_MODE;
    const origSandbox = process.env.PUBLIC_SANDBOX;

    try {
      process.env.NEXT_PUBLIC_NETWORK_MODE = "mainnet";
      process.env.PUBLIC_SANDBOX = "true";

      expect(() => assertValidSandboxMode()).toThrow(
        /CRITICAL SECURITY VIOLATION: PUBLIC_SANDBOX is strictly prohibited on Arc Mainnet/
      );
    } finally {
      process.env.NEXT_PUBLIC_NETWORK_MODE = origMode;
      process.env.PUBLIC_SANDBOX = origSandbox;
    }
  });

  it("4. Verifies GET /api/metrics produces real database metrics structure with zero synthetic flags", async () => {
    const res = await metricsGet();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.mainnet).toBeDefined();
    expect(data.testnet).toBeDefined();
    expect(data.integrity.syntheticDataAllowed).toBe(false);
    expect(data.integrity.mode).toContain("100% Real Database & On-Chain Rows");
  });
});
