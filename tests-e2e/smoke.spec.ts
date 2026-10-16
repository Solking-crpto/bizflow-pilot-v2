import { test, expect } from "@playwright/test";

const ROUTES = [
  { path: "/", name: "Command Center" },
  { path: "/judges", name: "Judge Guide" },
  { path: "/inventory", name: "Inventory & POs" },
  { path: "/invoices", name: "Invoice Desk" },
  { path: "/agent", name: "AI Agent" },
  { path: "/payments", name: "Payment Desk" },
  { path: "/audit", name: "Audit Ledger" },
  { path: "/simulator", name: "Policy Simulator" },
  { path: "/settings", name: "Rules & Settings" },
  { path: "/about", name: "About Architecture" },
  { path: "/verify/demo", name: "Public Passport" },
  { path: "/agent/decisions", name: "Agent Decisions" },
  { path: "/pilots", name: "Pilot Businesses" },
  { path: "/settings/pilots", name: "Pilot Admin" },
  { path: "/guide", name: "User Guide" },
];

test.describe("P0-A Playwright Navigation & Interactive Smoke Suite", () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss first-visit modal in localStorage
    await page.addInitScript(() => {
      try {
        localStorage.setItem("bizflow_first_visit_choice_dismissed", "true");
      } catch {}
    });
  });

  test("visits every route without 5xx or unhandled console errors", async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (text.includes("favicon.ico") || text.includes("404") || text.includes("Failed to load resource")) return;
        consoleErrors.push(`[Console Error at ${page.url()}]: ${text}`);
      }
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(`[Page Error at ${page.url()}]: ${err.message}`);
    });

    for (const route of ROUTES) {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 20000 });
      expect(response, `No response for ${route.path}`).not.toBeNull();
      expect(response!.status(), `Route ${route.path} returned status ${response!.status()}`).toBe(200);

      // Verify page body is visible
      await expect(page.locator("body")).toBeVisible();
      await page.waitForTimeout(300);
    }

    expect(consoleErrors, `Encountered console errors: ${consoleErrors.join("; ")}`).toEqual([]);
  });

  test("tests Public /guide page and interactive elements", async ({ page }) => {
    await page.goto("/guide", { waitUntil: "domcontentloaded" });

    // Verify Title and Subtitle
    await expect(page.locator("h1", { hasText: "How to use BizFlow Pilot" })).toBeVisible();
    await expect(
      page.locator("text=BizFlow Pilot checks your supplier invoices before you pay")
    ).toBeVisible();

    // Verify Table of Contents
    await expect(page.locator("text=Table of Contents")).toBeVisible();

    // Verify Comparison Box
    await expect(page.locator("text=Testnet vs Mainnet Comparison")).toBeVisible();

    // Verify 10 numbered step headings
    await expect(page.getByRole("heading", { name: "Choose a network" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Connect your wallet" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Get test USDC" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create your business profile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add your suppliers" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Record the order and delivery" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Enter the invoice" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ask the AI agent" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Review and sign the payment" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check the proof" })).toBeVisible();

    // Verify Action Buttons at bottom
    const tryTestnetBtn = page.getByRole("link", { name: /Try it free on testnet/i });
    await expect(tryTestnetBtn).toBeVisible();

    const getUsdcBtn = page.getByRole("link", { name: /Get free test USDC/i }).first();
    await expect(getUsdcBtn).toBeVisible();
    expect(await getUsdcBtn.getAttribute("href")).toContain("faucet.circle.com");
  });

  test("tests Policy Simulator interactive controls", async ({ page }) => {
    await page.goto("/simulator", { waitUntil: "domcontentloaded" });

    // Check selectors exist and decision banner is active
    await expect(page.locator("select").first()).toBeVisible();
    await expect(page.locator("text=Engine Decision Outcome")).toBeVisible();
  });

  test("verifies /api/proof and /api/health public endpoints via Playwright", async ({ request }) => {
    const proofRes = await request.get("/api/proof");
    expect(proofRes.status()).toBe(200);
    const proofData = await proofRes.json();
    expect(proofData).toHaveProperty("status");

    const healthRes = await request.get("/api/health");
    expect([200, 503]).toContain(healthRes.status());
    const healthData = await healthRes.json();
    expect(["healthy", "degraded"]).toContain(healthData.status);
  });

  test("tests Public /pilots Directory page", async ({ page }) => {
    await page.goto("/pilots", { waitUntil: "domcontentloaded" });

    await expect(page.locator("h1", { hasText: "Pilot Businesses Directory" })).toBeVisible();
    await expect(page.locator("text=Builder-Operated Treasury Model")).toBeVisible();
  });

  test("tests Signed-out Isolation states on private routes", async ({ page }) => {
    // Command Center
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Connect your wallet to begin")).toBeVisible();
    await expect(page.locator("text=Read the 2-minute user guide")).toBeVisible();

    // Invoices Desk
    await page.goto("/invoices", { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Connect your wallet to begin")).toBeVisible();

    // Payments Desk
    await page.goto("/payments", { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Connect your wallet to begin")).toBeVisible();
  });
});
