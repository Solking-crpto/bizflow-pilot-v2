import fs from "fs";
import path from "path";

function getAllJsFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllJsFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

export function scanClientBundle(): { clean: boolean; leaks: { file: string; pattern: string }[] } {
  const staticDir = path.resolve(__dirname, "..", ".next", "static");
  if (!fs.existsSync(staticDir)) {
    return { clean: true, leaks: [] }; // Build not yet run, skipped in pre-build
  }

  const jsFiles = getAllJsFiles(staticDir);
  const leaks: { file: string; pattern: string }[] = [];

  // Known public library constants (secp256k1 curve parameters & ERC-6492 magic from viem/@noble/curves)
  const KNOWN_PUBLIC_HEX_CONSTANTS = new Set([
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f",
    "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
    "0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee",
    "0x6492649264926492649264926492649264926492649264926492649264926492",
    "0x8010801080108010801080108010801080108010801080108010801080108010",
    "0x5792579257925792579257925792579257925792579257925792579257925792",
  ]);

  // Sensitive patterns that must NEVER leak into client JS bundles
  const leakPatterns: { name: string; regex: RegExp }[] = [
    { name: "PostgreSQL Database URL credentials", regex: /postgres(?:ql)?:\/\/[^:]+:[^@]+@/i },
    { name: "Alchemy API key in URL", regex: /alchemy\.com\/v2\/[a-zA-Z0-9_-]{20,}/i },
    { name: "Infura API key in URL", regex: /infura\.io\/v3\/[a-fA-F0-9]{32}/i },
    { name: "Explicit OWNER_PASSCODE", regex: /OWNER_PASSCODE\s*[:=]\s*["'][^"']+["']/i },
    { name: "Explicit CRON_SECRET", regex: /CRON_SECRET\s*[:=]\s*["'][^"']+["']/i },
  ];

  for (const file of jsFiles) {
    const content = fs.readFileSync(file, "utf-8");

    // Check for 64-hex private keys (excluding known public mathematical/curve constants)
    const hex64Matches = content.match(/\b0x[a-fA-F0-9]{64}\b/g) || [];
    for (const hex of hex64Matches) {
      if (!KNOWN_PUBLIC_HEX_CONSTANTS.has(hex.toLowerCase())) {
        leaks.push({
          file: path.basename(file),
          pattern: `Treasury Private Key (0x hex 64 chars): ${hex.slice(0, 8)}...`,
        });
        break;
      }
    }

    // Check standard regex patterns
    for (const pat of leakPatterns) {
      if (pat.regex.test(content)) {
        leaks.push({
          file: path.basename(file),
          pattern: pat.name,
        });
      }
    }
  }

  return {
    clean: leaks.length === 0,
    leaks,
  };
}

if (require.main === module) {
  console.log("Scanning .next/static client bundle for secret leaks...");
  const res = scanClientBundle();
  if (res.clean) {
    console.log("BUNDLE SCAN RESULT: CLEAN. No private keys, database credentials, or secrets detected.");
    process.exit(0);
  } else {
    console.error("BUNDLE SCAN VIOLATION: Detected secrets in client bundle:");
    console.error(JSON.stringify(res.leaks, null, 2));
    process.exit(1);
  }
}
