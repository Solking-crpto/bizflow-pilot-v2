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

describe("Static Guard: No Unscoped Prisma Imports Allowed", () => {
  it("ensures zero files in app, lib, components import 'prisma' directly from db", () => {
    const rootDir = path.resolve(__dirname, "..");
    const searchDirs = ["app", "lib", "components"];
    const allFiles: string[] = [];

    for (const d of searchDirs) {
      getAllTsFiles(path.join(rootDir, d), allFiles);
    }

    const violations: { file: string; line: string }[] = [];
    const forbiddenPattern = /import\s+{[^}]*\bprisma\b[^}]*}\s+from\s+["'][^"']*lib\/db["']/;

    for (const filePath of allFiles) {
      // Exclude lib/db.ts itself
      if (filePath.endsWith("lib" + path.sep + "db.ts")) continue;

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      for (const line of lines) {
        if (forbiddenPattern.test(line)) {
          violations.push({
            file: path.relative(rootDir, filePath),
            line: line.trim(),
          });
        }
      }
    }

    expect(
      violations,
      `Found unscoped prisma imports in production code: ${JSON.stringify(violations, null, 2)}`
    ).toHaveLength(0);
  });
});
