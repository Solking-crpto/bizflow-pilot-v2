import { test, expect } from "@playwright/test";
import { getDb, withDbTimeout } from "../lib/db";
import { createSessionToken } from "../lib/auth/session";
import path from "path";
import fs from "fs";

test.describe("Phase 11: End-to-End Delivery Proof & Payment Verification Journey", () => {
  const QA_DIR = path.resolve(process.cwd(), "docs/qa-part1");

  test.beforeAll(async () => {
    if (!fs.existsSync(QA_DIR)) {
      fs.mkdirSync(QA_DIR, { recursive: true });
    }
  });

  test("executes end-to-end delivery proof workflow and generates 5 mandatory QA screenshots", async ({
    page,
    browser,
  }) => {
    test.setTimeout(240000);

    const prisma = getDb("testnet");

    // 1. Find or prepare seeded organization and invoice
    let org = await withDbTimeout(() =>
      prisma.organization.findFirst({
        include: { vendors: true },
      })
    );

    if (!org) {
      org = await withDbTimeout(() =>
        prisma.organization.create({
          data: {
            name: "Apex Logistics Corp",
            currency: "USDC",
            walletAddress: "0x061f5c70d68a246b654724c0f9595f3a14cf9b0b",
          },
          include: { vendors: true },
        })
      );
    }

    let vendor = org.vendors[0];
    if (!vendor) {
      vendor = await withDbTimeout(() =>
        prisma.vendor.create({
          data: {
            orgId: org.id,
            name: "Northgate Heavy Supplies",
            walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          },
        })
      );
    }

    // Create / ensure an Item
    let item = await withDbTimeout(() => prisma.item.findFirst({ where: { orgId: org.id } }));
    if (!item) {
      item = await withDbTimeout(() =>
        prisma.item.create({
          data: {
            orgId: org.id,
            name: "Industrial Portland Cement (50kg)",
            sku: "CEM-IND-50",
            unit: "BAG",
            currentStock: 100,
            unitPriceUsdc: 25_000_000n, // $25
          },
        })
      );
    }

    // Clean any prior test delivery requests for this test PO
    const testPoNumber = "PO-PROOF-QA-001";
    let po = await withDbTimeout(() =>
      prisma.purchaseOrder.findFirst({
        where: { orgId: org.id, poNumber: testPoNumber },
        include: { lines: true, deliveryRequests: true },
      })
    );

    if (!po) {
      po = await withDbTimeout(() =>
        prisma.purchaseOrder.create({
          data: {
            orgId: org.id,
            vendorId: vendor.id,
            poNumber: testPoNumber,
            totalUsdc: 10_000_000n,
            status: "approved",
            lines: {
              create: [
                {
                  itemId: item.id,
                  quantity: 1,
                  unitPriceUsdc: 10_000_000n,
                  totalUsdc: 10_000_000n,
                },
              ],
            },
          },
          include: { lines: true, deliveryRequests: true },
        })
      );
    } else {
      await withDbTimeout(() =>
        prisma.pOLine.updateMany({
          where: { purchaseOrderId: po.id },
          data: { quantity: 1, unitPriceUsdc: 10_000_000n, totalUsdc: 10_000_000n },
        })
      );
      await withDbTimeout(() =>
        prisma.purchaseOrder.update({
          where: { id: po.id },
          data: { totalUsdc: 10_000_000n },
        })
      );
    }

    const testInvNumber = "INV-PROOF-QA-001";
    let invoice = await withDbTimeout(() =>
      prisma.invoice.findFirst({
        where: { orgId: org.id, invoiceNumber: testInvNumber },
        include: { deliveryRequests: true },
      })
    );

    if (!invoice) {
      invoice = await withDbTimeout(() =>
        prisma.invoice.create({
          data: {
            orgId: org.id,
            vendorId: vendor.id,
            purchaseOrderId: po.id,
            invoiceNumber: testInvNumber,
            totalUsdc: 10_000_000n,
            fileHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            extractedData: JSON.stringify({
              invoiceNumber: testInvNumber,
              totalUsdc: "10.00",
              items: [{ description: "Industrial Portland Cement (50kg)", quantity: 1, unitPriceUsdc: "10.00", totalUsdc: "10.00" }],
            }),
            deliveryProofMode: "required",
            status: "verified",
            matchStatus: "exact_match",
          },
          include: { deliveryRequests: true },
        })
      );
    } else {
      // Reset invoice to required and block for this run
      await withDbTimeout(() =>
        prisma.deliveryRequest.deleteMany({
          where: { invoiceId: invoice.id },
        })
      );
      invoice = await withDbTimeout(() =>
        prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            totalUsdc: 10_000_000n,
            deliveryProofMode: "required",
            status: "verified",
            matchStatus: "exact_match",
          },
          include: { deliveryRequests: true },
        })
      );
    }

    // Create session token for owner wallet
    const sessionToken = createSessionToken({
      address: org.walletAddress,
      orgId: org.id,
      role: "owner",
      network: "testnet",
      expiresAt: Date.now() + 24 * 3600 * 1000,
    });

    // 2. Setup desktop browser context with session cookies
    await page.addInitScript(() => {
      try {
        localStorage.setItem("bizflow_first_visit_choice_dismissed", "true");
        localStorage.setItem("bizflow_network", "testnet");
      } catch {}
    });

    await page.context().addCookies([
      { name: "bizflow_network", value: "testnet", url: "http://localhost:3002" },
      { name: "bizflow_session_testnet", value: sessionToken, url: "http://localhost:3002" },
      { name: "bizflow_session", value: sessionToken, url: "http://localhost:3002" },
    ]);

    await page.setViewportSize({ width: 1280, height: 800 });

    // Open Invoices Desk
    await page.goto("http://localhost:3002/invoices", { waitUntil: "domcontentloaded", timeout: 30000 });
    const retryBtn = page.getByRole("button", { name: /Retry Connection/i });
    if (await retryBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await retryBtn.click();
      await page.waitForTimeout(1000);
    }
    await expect(page.locator("h1", { hasText: "Invoice Desk" })).toBeVisible({ timeout: 25000 });

    // Select our QA test invoice in the list
    const invoiceRow = page.locator(`text=${testInvNumber}`).first();
    await expect(invoiceRow).toBeVisible({ timeout: 15000 });
    await invoiceRow.click();

    // Click "Request Delivery Proof" button
    const requestProofBtn = page.getByRole("button", { name: /Request Delivery Proof/i });
    await expect(requestProofBtn).toBeVisible({ timeout: 10000 });
    await requestProofBtn.click();

    // Modal opens: fill verifier details
    const verifierNameInput = page.locator("form input").first();
    await expect(verifierNameInput).toBeVisible({ timeout: 10000 });
    await verifierNameInput.fill("Chief Inspector Michael Vance");

    const verifierContactInput = page.locator("form input").nth(1);
    await verifierContactInput.fill("+234 803 555 0192");

    // Click "Generate Secure Link" and intercept the response to extract tokens
    const generateBtn = page.getByRole("button", { name: /Generate Secure Link/i });
    const [createRes] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/api/delivery-proof/request") && res.status() === 200,
        { timeout: 60000 }
      ),
      generateBtn.click(),
    ]);

    const createData = await createRes.json();
    const rawToken = createData.token;
    const accessCodeText = createData.accessCode;
    const challengeCodeText = createData.challengeCode;

    // Modal updates to single-reveal created state
    await expect(page.locator("text=Single reveal")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=6-Character Access Code")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Physical Challenge Code/i).first()).toBeVisible({ timeout: 10000 });

    // Take SCREENSHOT 1: Modal with single-reveal access code & WhatsApp/email share links
    const screenshot1Path = path.join(QA_DIR, "01-request-created-modal.png");
    await page.screenshot({ path: screenshot1Path, fullPage: false });
    console.log(`Saved screenshot 1 to: ${screenshot1Path}`);

    // Close the creation modal
    const doneBtn = page.getByRole("button", { name: "Done" });
    await doneBtn.click();
    await page.waitForTimeout(1000);

    // 3. Open Mobile-First Verifier Portal at 390px viewport
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    });

    await mobileContext.addInitScript(() => {
      try {
        localStorage.setItem("bizflow_first_visit_choice_dismissed", "true");
        localStorage.setItem("bizflow_network", "testnet");
      } catch {}
    });

    await mobileContext.addCookies([
      { name: "bizflow_network", value: "testnet", url: "http://localhost:3002" },
    ]);

    const mobilePage = await mobileContext.newPage();
    const portalUrl = `http://localhost:3002/verify-delivery/${rawToken}`;
    await mobilePage.goto(portalUrl, { waitUntil: "domcontentloaded" });

    // Verify locked portal is rendered
    await expect(mobilePage.locator("text=Enter Access Code")).toBeVisible({ timeout: 15000 });
    await expect(
      mobilePage.locator("text=Case-insensitive").or(mobilePage.locator("text=attempts remaining"))
    ).toBeVisible();

    // Take SCREENSHOT 2: Mobile portal locked at 390px
    const screenshot2Path = path.join(QA_DIR, "02-mobile-portal-locked.png");
    await mobilePage.screenshot({ path: screenshot2Path, fullPage: false });
    console.log(`Saved screenshot 2 to: ${screenshot2Path}`);

    // Enter the 6-character access code
    const codeInput = mobilePage.locator("input[maxlength='6']").first();
    await codeInput.fill(accessCodeText);

    // Click "Unlock Delivery Portal"
    const unlockBtn = mobilePage.getByRole("button", { name: /Unlock Delivery Portal/i });
    await unlockBtn.click();

    // Portal unlocks to Active state
    await expect(mobilePage.locator("text=Delivery Summary")).toBeVisible({ timeout: 30000 });
    await expect(mobilePage.getByText(/Physical Challenge Code/i).first()).toBeVisible({ timeout: 20000 });

    // Take SCREENSHOT 3: Mobile portal active with order summary and challenge code
    const screenshot3Path = path.join(QA_DIR, "03-mobile-portal-active.png");
    await mobilePage.screenshot({ path: screenshot3Path, fullPage: false });
    console.log(`Saved screenshot 3 to: ${screenshot3Path}`);

    // Upload evidence photo
    // Minimal valid JPEG binary buffer
    const validJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00,
      0x60, 0x00, 0x60, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9,
    ]);

    const tempUploadPath = path.join(QA_DIR, "temp_proof.jpg");
    fs.writeFileSync(tempUploadPath, validJpeg);

    const fileInput = mobilePage.locator("input[type='file']").first();
    await fileInput.setInputFiles(tempUploadPath);

    // Wait for file to show in uploaded files list
    await expect(mobilePage.locator("text=temp_proof.jpg")).toBeVisible({ timeout: 45000 });

    // Check consent checkbox
    const consentCheckbox = mobilePage.locator("input[type='checkbox']").first();
    await consentCheckbox.check();

    // Fill verifier name & contact if empty
    const mobileNameInput = mobilePage.locator("input[placeholder*='Your Full Name']");
    if (await mobileNameInput.isVisible()) {
      await mobileNameInput.fill("Chief Inspector Michael Vance");
    }
    const mobileContactInput = mobilePage.locator("input[placeholder*='Phone']").or(mobilePage.locator("input[placeholder*='WhatsApp']")).first();
    if (await mobileContactInput.isVisible()) {
      await mobileContactInput.fill("+234 803 555 0192");
    }

    // Submit proof
    const submitProofBtn = mobilePage.getByRole("button", { name: /Submit Delivery Proof/i });
    await submitProofBtn.click();

    // Wait for confirmation receipt
    await expect(mobilePage.locator("text=Proof Submitted Successfully")).toBeVisible({ timeout: 30000 });

    // Clean temp file
    if (fs.existsSync(tempUploadPath)) fs.unlinkSync(tempUploadPath);
    await mobileContext.close();

    // 4. Back to Desktop Owner Browser: Inspect Report
    await page.goto("http://localhost:3002/invoices", { waitUntil: "domcontentloaded" });
    const invoiceRowAfterSubmit = page.locator(`text=${testInvNumber}`).first();
    await expect(invoiceRowAfterSubmit).toBeVisible({ timeout: 15000 });
    await invoiceRowAfterSubmit.click();

    // Click "Inspect Evidence & Report"
    const inspectBtn = page.getByRole("button", { name: /Inspect Evidence & Report/i });
    await expect(inspectBtn).toBeVisible({ timeout: 20000 });
    await inspectBtn.click();

    // Inspection modal opens
    await expect(page.locator("text=Delivery Proof & Condition Report")).toBeVisible({ timeout: 30000 });
    await expect(page.locator("text=Item Reconciliation Matrix")).toBeVisible({ timeout: 20000 });

    // Take SCREENSHOT 4: Side-by-side PO vs verifier vs AI report
    const screenshot4Path = path.join(QA_DIR, "04-owner-inspection-report.png");
    await page.screenshot({ path: screenshot4Path, fullPage: false });
    console.log(`Saved screenshot 4 to: ${screenshot4Path}`);

    // Owner approves the delivery and waits for the approval API response to complete
    const approveBtn = page.getByRole("button", { name: /Approve Delivery/i });
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/decision") && res.status() === 200,
        { timeout: 30000 }
      ),
      approveBtn.click(),
    ]);
    await page.waitForTimeout(1500);

    // Close modal
    const closeInspectionBtn = page.locator("button:has(svg.lucide-x)").first();
    if (await closeInspectionBtn.isVisible()) {
      await closeInspectionBtn.click();
    }

    // 5. Navigate to Payment Desk
    await page.goto("http://localhost:3002/payments", { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page.locator("h1", { hasText: "Payment Desk" })).toBeVisible({ timeout: 25000 });

    // Select our QA invoice in Payment Desk
    const paymentInvoiceRow = page.locator(`text=${testInvNumber}`).first();
    await expect(paymentInvoiceRow).toBeVisible({ timeout: 15000 });
    await paymentInvoiceRow.click();

    // Verify Delivery Verified status badge and ready payment button
    await expect(page.getByText(/Delivery Verified/i).first()).toBeVisible({ timeout: 15000 });
    const payBtn = page.getByRole("button", { name: /Pay .* with Wallet/i });
    await expect(payBtn).toBeVisible({ timeout: 15000 });
    await expect(payBtn).toBeEnabled();

    // Take SCREENSHOT 5: Payment desk ready with DELIVERY VERIFIED chip and enabled pay button
    const screenshot5Path = path.join(QA_DIR, "05-payment-desk-ready.png");
    await page.screenshot({ path: screenshot5Path, fullPage: false });
    console.log(`Saved screenshot 5 to: ${screenshot5Path}`);

    // Assert all 5 screenshots exist and are non-empty
    for (const f of [
      "01-request-created-modal.png",
      "02-mobile-portal-locked.png",
      "03-mobile-portal-active.png",
      "04-owner-inspection-report.png",
      "05-payment-desk-ready.png",
    ]) {
      const p = path.join(QA_DIR, f);
      expect(fs.existsSync(p), `Missing screenshot: ${f}`).toBe(true);
      expect(fs.statSync(p).size, `Screenshot is empty: ${f}`).toBeGreaterThan(1000);
    }
  });
});
