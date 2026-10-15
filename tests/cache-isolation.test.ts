import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { GET as getMetricsRoute } from "../app/api/metrics/route";

function getAllPageFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next") {
        getAllPageFiles(fullPath, fileList);
      }
    } else if (entry.isFile() && entry.name === "page.tsx") {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe("Cache Isolation & Dynamic Rendering Verification", () => {
  it("ensures all database-reading pages declare force-dynamic and revalidate = 0", () => {
    const appDir = path.resolve(__dirname, "..", "app");
    const pageFiles = getAllPageFiles(appDir);

    const missingGuards: { file: string; missing: string[] }[] = [];

    for (const pageFile of pageFiles) {
      const content = fs.readFileSync(pageFile, "utf-8");
      // Check if page accesses database
      if (content.includes("getDb") || content.includes("withDbTimeout")) {
        const missing: string[] = [];
        if (!content.includes('export const dynamic = "force-dynamic"')) {
          missing.push('dynamic = "force-dynamic"');
        }
        if (!/export\s+const\s+revalidate\s*=\s*0/.test(content)) {
          missing.push("revalidate = 0");
        }

        if (missing.length > 0) {
          missingGuards.push({
            file: path.relative(appDir, pageFile),
            missing,
          });
        }
      }
    }

    expect(
      missingGuards,
      `Found database-reading pages without force-dynamic or revalidate = 0: ${JSON.stringify(missingGuards, null, 2)}`
    ).toHaveLength(0);
  });

  it("ensures /api/metrics produces isolated responses with zero cross-network aggregation", async () => {
    const req = new NextRequest("http://localhost:3002/api/metrics");
    const res = await getMetricsRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.mainnet).toBeDefined();
    expect(body.testnet).toBeDefined();
    expect(body.integrity.crossNetworkAggregation).toBe(false);
    expect(body.mainnet.chainId).toBe(5042);
    expect(body.testnet.chainId).toBe(5042002);
  });
});
