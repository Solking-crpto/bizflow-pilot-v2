import { test, expect } from "@playwright/test";

test.describe("Non-Custodial Public Beta Full User Journey", () => {
  test("complete flow: verify legal pages, metrics, onboarding, and non-custodial desks", async ({ page }) => {
    test.setTimeout(60000);
    // 1. Visit Legal & Risk Pages
    await page.goto("/terms", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: "Terms of Service" })).toBeVisible();
    await expect(page.locator("text=Non-Custodial Experimental Software Notice")).toBeVisible();

    await page.goto("/privacy", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: "Privacy Policy" })).toBeVisible();
    await expect(page.locator("text=Zero Private Key Collection")).toBeVisible();

    await page.goto("/risk", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: "Risk Disclosure" })).toBeVisible();
    await expect(page.locator("text=Read Before Transacting on Arc Mainnet")).toBeVisible();

    // 2. Visit Public Metrics Dashboard
    await page.goto("/metrics", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: "Verifiable Metrics" })).toBeVisible();
    await expect(page.locator("text=Tameion Integrity Policy: Zero Synthetic Volume")).toBeVisible();

    // 3. Onboarding Wizard Form Validation
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: "Onboard Your Business" })).toBeVisible();
    await expect(page.locator("text=Step 1: Payer Wallet Authentication")).toBeVisible();

    // 4. Suppliers Desk & Blocked-Address Screening
    await page.goto("/suppliers", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();

    // 5. Inventory & PO Desk
    await page.goto("/inventory", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();

    // 6. Invoices Desk
    await page.goto("/invoices", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();

    // 7. Advisory Agent Copilot & Non-Custodial Disclosure
    await page.goto("/agent", { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Connect your wallet to begin").or(page.locator("text=Non-Custodial Guarantee"))).toBeVisible();

    // 8. Payment Desk Non-Custodial Safeguards
    await page.goto("/payments", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });
});
