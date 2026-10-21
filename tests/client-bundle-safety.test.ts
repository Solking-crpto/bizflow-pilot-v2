import { describe, it, expect, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { scanClientBundle } from "../scripts/scan-client-bundle";

describe("Client Bundle Safety Verification & Negative Test", () => {
  const tempDir = path.join(os.tmpdir(), `bizflow-scanner-test-${Date.now()}`);

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("verifies production client bundle contains zero secrets or private credentials", () => {
    const res = scanClientBundle();
    expect(res.clean, `Secrets detected in client bundle: ${JSON.stringify(res.leaks)}`).toBe(true);
    expect(res.leaks).toHaveLength(0);
  });

  it("proves scan:bundle FAILS when fake private key, DB URL, and fake secret are planted", () => {
    fs.mkdirSync(tempDir, { recursive: true });

    // Find an actual built chunk to use as base, or use realistic JS chunk
    const staticDir = path.resolve(__dirname, "..", ".next", "static", "chunks");
    let baseChunk = "function _app() { console.log('BizFlow Pilot'); }";
    if (fs.existsSync(staticDir)) {
      const files = fs.readdirSync(staticDir).filter((f) => f.endsWith(".js"));
      if (files.length > 0) {
        baseChunk = fs.readFileSync(path.join(staticDir, files[0]), "utf-8").slice(0, 500);
      }
    }

    // Plant 3 forbidden leaks into a simulated client bundle chunk:
    // 1. Fake 64-hex private key (Hardhat standard test key)
    const fakePrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    // 2. PostgreSQL database credentials URL
    const fakeDbUrl = "postgresql://postgres:mysecretpassword123@ep-sample.aws.neon.tech/bizflow?schema=v2_testnet";
    // 3. Sensitive secret declaration
    const fakeCronSecret = 'const CRON_SECRET = "fake-secret-token-xyz-12345";';
    // 4. Supabase service role secret key
    const fakeSupabaseKey = 'const SUPABASE_SERVICE_ROLE_KEY = "sb_secret_fake_service_role_key_9876543210";';

    const taintedContent = `
      ${baseChunk}
      // Injected malicious/leaked variables
      const treasuryKey = "${fakePrivateKey}";
      const connectionString = "${fakeDbUrl}";
      ${fakeCronSecret}
      ${fakeSupabaseKey}
    `;

    const taintedFile = path.join(tempDir, "tainted-chunk.js");
    fs.writeFileSync(taintedFile, taintedContent, "utf-8");

    // 1. Verify via scanClientBundle function
    const scanResult = scanClientBundle(tempDir);
    expect(scanResult.clean).toBe(false);
    expect(scanResult.leaks.length).toBeGreaterThanOrEqual(4);

    const patterns = scanResult.leaks.map((l) => l.pattern);
    expect(patterns.some((p) => p.includes("Treasury Private Key"))).toBe(true);
    expect(patterns.some((p) => p.includes("PostgreSQL Database URL credentials"))).toBe(true);
    expect(patterns.some((p) => p.includes("Explicit CRON_SECRET"))).toBe(true);
    expect(patterns.some((p) => p.includes("Supabase service_role"))).toBe(true);

    // 2. Verify via CLI execution (npx tsx scripts/scan-client-bundle.ts) that process exits with code 1
    let cliExitedWithCode1 = false;
    try {
      execSync("npx tsx scripts/scan-client-bundle.ts", {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, SCAN_DIR: tempDir },
        stdio: "pipe",
      });
    } catch (err: any) {
      if (err.status === 1) {
        cliExitedWithCode1 = true;
        const stderr = err.stderr ? err.stderr.toString() : "";
        expect(stderr).toContain("BUNDLE SCAN VIOLATION");
      }
    }
    expect(cliExitedWithCode1, "CLI script did not exit with code 1 on planted leak").toBe(true);
  });

  it("verifies known public cryptographic curve parameters and ERC-6492 constants are allowed", () => {
    const benignDir = path.join(os.tmpdir(), `bizflow-benign-test-${Date.now()}`);
    fs.mkdirSync(benignDir, { recursive: true });

    try {
      const benignChunk = `
        // Standard secp256k1 curve prime and order parameters from @noble/curves
        const p = "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f";
        const n = "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141";
        const beta = "0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee";
        // ERC-6492 magic bytes suffix from viem
        const erc6492 = "0x6492649264926492649264926492649264926492649264926492649264926492";
        // Zero hash
        const zero = "0x0000000000000000000000000000000000000000000000000000000000000000";
      `;
      fs.writeFileSync(path.join(benignDir, "curve-chunk.js"), benignChunk, "utf-8");

      const result = scanClientBundle(benignDir);
      expect(result.clean).toBe(true);
      expect(result.leaks).toHaveLength(0);
    } finally {
      if (fs.existsSync(benignDir)) {
        fs.rmSync(benignDir, { recursive: true, force: true });
      }
    }
  });
});
