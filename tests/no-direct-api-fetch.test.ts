import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function getAllTsFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== ".git") {
        getAllTsFiles(fullPath, fileList);
      }
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe("Static Guard: No Direct Client-Side fetch('/api/...') Calls", () => {
  it("ensures all client components use apiFetch instead of raw fetch('/api/...')", () => {
    const rootDir = path.resolve(__dirname, "..");
    const searchDirs = ["components", "app"];
    const allFiles: string[] = [];

    for (const d of searchDirs) {
      getAllTsFiles(path.join(rootDir, d), allFiles);
    }

    const violations: { file: string; line: number; text: string }[] = [];
    const directApiFetchPattern = /\bfetch\s*\(\s*[`'"]\/api\b/;

    for (const filePath of allFiles) {
      // Exclude lib/apiFetch.ts if it was in the search dirs (it's in lib, but just in case)
      if (filePath.includes("apiFetch.ts")) continue;
      // Exclude server-only route handlers inside app/api
      const relative = path.relative(rootDir, filePath).replace(/\\/g, "/");
      if (relative.startsWith("app/api/")) continue;

      const content = fs.readFileSync(filePath, "utf-8");
      // Only examine client components or pages
      const isClientComponent = content.includes('"use client"') || content.includes("'use client'");
      if (!isClientComponent) continue;

      const lines = content.split("\n");
      lines.forEach((line, index) => {
        if (directApiFetchPattern.test(line)) {
          violations.push({
            file: relative,
            line: index + 1,
            text: line.trim(),
          });
        }
      });
    }

    expect(
      violations,
      `Found direct fetch('/api/...') in client components. Use apiFetch from '@/lib/apiFetch' instead:\n${JSON.stringify(violations, null, 2)}`
    ).toHaveLength(0);
  });
});
