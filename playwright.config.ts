import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests-e2e",
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: process.env.APP_URL || "http://localhost:3002",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath:
            "C:\\Users\\DELL\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe",
        },
      },
    },
  ],
});
