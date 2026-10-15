import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.APP_URL || "http://localhost:3002";
const QA_DIR = path.resolve(__dirname, "..", "docs", "qa");

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
];

const PAGES = [
  { path: "/", name: "home" },
  { path: "/onboarding", name: "onboarding" },
  { path: "/suppliers", name: "suppliers" },
  { path: "/inventory", name: "inventory" },
  { path: "/invoices", name: "invoices" },
  { path: "/agent", name: "agent" },
  { path: "/payments", name: "payments" },
  { path: "/audit", name: "audit" },
  { path: "/simulator", name: "simulator" },
  { path: "/settings", name: "settings" },
  { path: "/judges", name: "judges" },
  { path: "/about", name: "about" },
  { path: "/metrics", name: "metrics" },
  { path: "/verify/demo", name: "verify" },
  { path: "/terms", name: "terms" },
  { path: "/privacy", name: "privacy" },
  { path: "/risk", name: "risk" },
];

const NETWORKS = ["testnet", "mainnet"] as const;

async function run() {
  if (!fs.existsSync(QA_DIR)) {
    fs.mkdirSync(QA_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath:
      "C:\\Users\\DELL\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe",
    headless: true,
  });

  const defectsFound: string[] = [];
  let capturedCount = 0;

  for (const network of NETWORKS) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      });

      // Set cookie for network
      await context.addCookies([
        {
          name: "bizflow_network",
          value: network,
          domain: "localhost",
          path: "/",
        },
        {
          name: "bizflow_first_visit_choice_dismissed",
          value: "true",
          domain: "localhost",
          path: "/",
        },
      ]);

      const page = await context.newPage();

      for (const p of PAGES) {
        try {
          const url = `${BASE_URL}${p.path}`;
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
          await page.waitForTimeout(500);

          // Check for horizontal overflow (defect)
          const hasOverflow = await page.evaluate(() => {
            const el = document.documentElement;
            return el.scrollWidth > el.clientWidth + 1;
          });

          if (hasOverflow) {
            defectsFound.push(`[Overflow] ${network} ${p.name} at ${vp.width}px`);
          }

          const screenshotName = `${network}_${p.name}_${vp.width}px.png`;
          const filePath = path.join(QA_DIR, screenshotName);
          await page.screenshot({ path: filePath, fullPage: false });
          capturedCount++;
          console.log(`[QA] Captured ${screenshotName}`);
        } catch (err: any) {
          console.warn(`[QA Warning] ${network} ${p.name} (${vp.width}px): ${err.message}`);
        }
      }

      await context.close();
    }
  }

  await browser.close();

  console.log(`\n========================================`);
  console.log(`Visual QA Complete. Captured ${capturedCount} screenshots.`);
  console.log(`Defects found: ${defectsFound.length}`);
  if (defectsFound.length > 0) {
    defectsFound.forEach((d) => console.log(" - " + d));
  }
  console.log(`========================================\n`);
}

run().catch((err) => {
  console.error("Visual QA runner failed:", err);
  process.exit(1);
});
