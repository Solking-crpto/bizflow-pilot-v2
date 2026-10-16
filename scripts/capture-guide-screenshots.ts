import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.APP_URL || "http://localhost:3002";
const GUIDE_QA_DIR = path.resolve(__dirname, "..", "docs", "qa", "guide");

const VIEWPORTS = [
  { name: "1440_desktop", width: 1440, height: 900 },
  { name: "1024_tablet", width: 1024, height: 768 },
  { name: "390_mobile", width: 390, height: 844 },
];

const NETWORKS = ["testnet", "mainnet"] as const;

async function run() {
  if (!fs.existsSync(GUIDE_QA_DIR)) {
    fs.mkdirSync(GUIDE_QA_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath:
      "C:\\Users\\DELL\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe",
    headless: true,
  });

  console.log(`Starting /guide QA screenshot capture across ${NETWORKS.length} networks and ${VIEWPORTS.length} viewports...`);

  for (const network of NETWORKS) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      });

      // Dismiss first-visit modal and set active network cookie
      await context.addCookies([
        {
          name: "bizflow_network",
          value: network,
          domain: "localhost",
          path: "/",
        },
      ]);

      const page = await context.newPage();

      // Dismiss modal in localStorage before navigation
      await page.addInitScript(() => {
        try {
          localStorage.setItem("bizflow_first_visit_choice_dismissed", "true");
        } catch {}
      });

      const url = `${BASE_URL}/guide`;
      console.log(`Capturing ${network} at ${vp.width}x${vp.height}...`);

      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      } catch {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      }

      await page.waitForTimeout(500);

      // Check horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      const isOverflowing = scrollWidth > clientWidth;

      if (isOverflowing) {
        console.warn(`[WARNING] Overflow on /guide ${network} at ${vp.width}px: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);
      }

      const filename = `${network}_${vp.name}.png`;
      const filePath = path.join(GUIDE_QA_DIR, filename);
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`Saved screenshot: ${filePath}`);

      // Also save generic viewport name for testnet
      if (network === "testnet") {
        const genericPath = path.join(GUIDE_QA_DIR, `${vp.name}.png`);
        fs.copyFileSync(filePath, genericPath);
      }

      await context.close();
    }
  }

  await browser.close();
  console.log("Guide QA screenshot capture completed successfully!");
}

run().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
