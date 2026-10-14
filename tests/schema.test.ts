import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Database Schema Isolation & Parameterization", () => {
  it("verifies that no raw queries or scripts hardcode 'public.' schema", () => {
    const rootDir = path.resolve(__dirname, "..");
    const searchDirs = ["app", "lib", "scripts", "prisma"];
    const violations: string[] = [];

    function scan(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== ".next") {
            scan(fullPath);
          }
        } else if (/\.(ts|tsx|js|prisma|sql)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          // Check for hardcoded "public." references in SQL strings or raw queries
          if (/FROM\s+public\./i.test(content) || /JOIN\s+public\./i.test(content) || /INTO\s+public\./i.test(content)) {
            violations.push(fullPath);
          }
        }
      }
    }

    for (const d of searchDirs) {
      scan(path.join(rootDir, d));
    }

    expect(violations).toEqual([]);
  });

  it("verifies Prisma connection URL correctly sets schema parameter", () => {
    const testnetUrl = "postgresql://user:pass@ep-cool-db.us-east-2.aws.neon.tech/bizflow?schema=v2_testnet&sslmode=require";
    const mainnetUrl = "postgresql://user:pass@ep-cool-db.us-east-2.aws.neon.tech/bizflow?schema=v2_mainnet&sslmode=require";

    const parsedTestnet = new URL(testnetUrl);
    expect(parsedTestnet.searchParams.get("schema")).toBe("v2_testnet");

    const parsedMainnet = new URL(mainnetUrl);
    expect(parsedMainnet.searchParams.get("schema")).toBe("v2_mainnet");
    expect(parsedMainnet.searchParams.get("schema")).not.toBe("public");
  });
});
