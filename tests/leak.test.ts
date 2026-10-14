import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const APP_URL = process.env.APP_URL || "http://localhost:3001";

const ROUTES = [
  "/",
  "/judges",
  "/inventory",
  "/invoices",
  "/agent",
  "/payments",
  "/audit",
  "/simulator",
  "/settings",
  "/about",
  "/verify/demo",
  "/agent/decisions",
];

const API_ROUTES = [
  "/api/proof",
  "/api/health",
  "/api/settings",
  "/api/audit/verify",
  "/api/audit/verify-rpc",
  "/api/payments/execute",
  "/api/agent/run",
  "/api/agent/decisions",
];

function assertNoSecrets(content: string) {
  expect(content).not.toMatch(/postgres:\/\/[^"'\s]+/i);
  expect(content).not.toMatch(/postgresql:\/\/[^"'\s]+/i);
  expect(content).not.toContain("TREASURY_PRIVATE_KEY");
  expect(content).not.toContain("CIRCLE_ENTITY_SECRET");
  expect(content).not.toContain("SUPABASE_SERVICE_ROLE_KEY");

  const rawTreasuryKey = process.env.TREASURY_PRIVATE_KEY;
  if (rawTreasuryKey && rawTreasuryKey.length > 20 && !rawTreasuryKey.includes("0000000000")) {
    expect(content).not.toContain(rawTreasuryKey);
  }

  expect(content).not.toContain("supabase.co:6543");
  expect(content).not.toContain("pooler.supabase.com");
}

describe("P0-B Security: Secret & Credential Leakage Prevention Test", () => {
  ROUTES.forEach((route) => {
    it(`verifies rendered HTML or source at ${route} contains no secrets or connection strings`, async () => {
      let content = "";
      try {
        const res = await fetch(`${APP_URL}${route}`, { signal: AbortSignal.timeout(500) });
        if (res.ok) {
          content = await res.text();
        }
      } catch {
        // Dev server not active: examine client page file directly
        const relativeFile = route === "/" ? "app/page.tsx" : `app${route}/page.tsx`;
        const filePath = path.join(__dirname, "..", relativeFile);
        if (fs.existsSync(filePath)) {
          content = fs.readFileSync(filePath, "utf-8");
        }
      }

      if (content) {
        assertNoSecrets(content);
      }
    });
  });

  API_ROUTES.forEach((apiRoute) => {
    it(`verifies API route ${apiRoute} source code contains no hardcoded secrets`, () => {
      const filePath = path.join(__dirname, "..", "app", apiRoute, "route.ts");
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        assertNoSecrets(content);
      }
    });
  });
});
