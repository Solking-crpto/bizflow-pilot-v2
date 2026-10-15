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
];

test.describe("P0-A Playwright Navigation & Interactive Smoke Suite", () => {
  test("visits every route without 5xx or unhandled console errors", async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (text.includes("favicon.ico") || text.includes("404")) return;
        consoleErrors.push(`[Console Error at ${page.url()}]: ${text}`);
      }
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(`[Page Error at ${page.url()}]: ${err.message}`);
    });

    for (const route of ROUTES) {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response, `No response for ${route.path}`).not.toBeNull();
      expect(response!.status(), `Route ${route.path} returned status ${response!.status()}`).toBe(200);

      // Verify page body is visible
      await expect(page.locator("body")).toBeVisible();
    }

    expect(consoleErrors, `Encountered console errors: ${consoleErrors.join("; ")}`).toEqual([]);
  });

  test("tests primary action buttons and interactions on Command Center", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    
    // Check navigation buttons in main header with timeout for remote DB query
    const processInvoicesLink = page.locator("main").getByRole("link", { name: "Process Invoices" });
    await expect(processInvoicesLink).toBeVisible({ timeout: 15000 });
    await expect(page.locator("main").getByRole("link", { name: "Payment Desk" }).first()).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Inspect Hash Chain" })).toBeVisible();

    // Click Process Invoices
    await processInvoicesLink.click();
    await page.waitForURL("**/invoices");
    expect(page.url()).toContain("/invoices");
  });

  test("tests Invoice Desk tabs and interactive controls", async ({ page }) => {
    await page.goto("/invoices");

    // Click filter tabs
    await page.getByRole("button", { name: /Verified/i }).click();
    await page.getByRole("button", { name: /Needs Review/i }).click();
    await page.getByRole("button", { name: /Blocked/i }).click();
    await page.getByRole("button", { name: /All Invoices/i }).click();

    // Verify sub-action links
    await expect(page.locator("main").getByRole("link", { name: "Consult AI Agent" })).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Ask AI Agent" })).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Go to Payment Desk" })).toBeVisible();
  });

  test("tests Audit Ledger Verify Chain and Export JSON buttons", async ({ page }) => {
    await page.goto("/audit");

    const verifyBtn = page.getByRole("button", { name: /Verify Chain/i });
    await expect(verifyBtn).toBeVisible();
    await verifyBtn.click();

    // Wait for cryptographic verification banner
    await expect(page.locator("text=Cryptographic Chain Verified")).toBeVisible({ timeout: 8000 });

    const exportBtn = page.getByRole("button", { name: /Export/i });
    await expect(exportBtn).toBeVisible();
  });

  test("tests Settings Save and Emergency Kill Switch controls", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });

    // Handle transient Supabase connection pooler blip gracefully
    const retryBtn = page.getByRole("button", { name: /Retry/i });
    if (await retryBtn.isVisible()) {
      await retryBtn.click();
      await page.waitForLoadState("domcontentloaded");
    }

    // Verify and click Kill Switch button
    const killSwitchBtn = page.getByRole("button", { name: /Kill Switch/i });
    await expect(killSwitchBtn).toBeVisible({ timeout: 15000 });
    await killSwitchBtn.click();

    // Verify Save Settings button
    const saveBtn = page.getByRole("button", { name: /Save Settings/i });
    await expect(saveBtn).toBeVisible();

    const passcodeInput = page.getByPlaceholder("Enter OWNER_PASSCODE");
    if ((await passcodeInput.count()) > 0 && process.env.OWNER_PASSCODE) {
      await passcodeInput.fill(process.env.OWNER_PASSCODE);
    }
    await saveBtn.click();

    // Verify feedback appears (either settings saved or passcode authorization message)
    await expect(
      page.locator("text=Policy settings updated and verified").or(page.locator("text=Owner passcode")).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("tests Policy Simulator interactive controls", async ({ page }) => {
    await page.goto("/simulator");

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

  test("tests Agent Decisions log page and filter controls", async ({ page }) => {
    await page.goto("/agent/decisions", { waitUntil: "domcontentloaded" });

    // Header and metrics banner check
    await expect(page.locator("h1", { hasText: "Agent Decisions" })).toBeVisible();
    await expect(page.locator("text=Autonomous Governance Metrics")).toBeVisible();

    // Filter controls
    await page.getByRole("button", { name: /All Decisions/i }).click();
    await page.getByRole("button", { name: /Auto-Executed/i }).click();
    await page.getByRole("button", { name: /Escalated/i }).click();
    await page.getByRole("button", { name: /Scheduled/i }).click();
    await page.getByRole("button", { name: /Holds \/ Rejections/i }).click();
    await page.getByRole("button", { name: /All Decisions/i }).click();
  });

  test("tests Run Agent Now button on Agent Dashboard", async ({ page }) => {
    await page.goto("/agent", { waitUntil: "domcontentloaded" });

    const runAgentBtn = page.getByRole("button", { name: /Run Agent Now/i });
    await expect(runAgentBtn).toBeVisible({ timeout: 15000 });
    await runAgentBtn.click();

    // Verify modal appears
    await expect(page.locator("text=Trigger Autonomous Agent Run")).toBeVisible({ timeout: 5000 });
    
    // Close modal
    const cancelBtn = page.getByRole("button", { name: /Cancel/i });
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    }
  });

  test("tests Public /pilots Directory page", async ({ page }) => {
    await page.goto("/pilots", { waitUntil: "domcontentloaded" });

    await expect(page.locator("h1", { hasText: "Pilot Businesses Directory" })).toBeVisible();
    await expect(page.locator("text=Builder-Operated Treasury Model")).toBeVisible();
  });
});
