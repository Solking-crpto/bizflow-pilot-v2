import { createPublicClient, http, parseAbi } from "viem";
import { getDb, withDbTimeout } from "../lib/db";
import { NETWORKS } from "../lib/networks";

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

interface CheckResult {
  title: string;
  passed: boolean;
  details: string;
}

async function runTestnetPreflight(): Promise<void> {
  console.log("================================================================");
  console.log("       BizFlow Pilot — Arc Testnet Read-Only Preflight Audit     ");
  console.log("================================================================");
  console.log("Safety Note: This script performs read-only checks only.");
  console.log("Zero transactions are broadcast. Secrets are never printed.\n");

  const results: CheckResult[] = [];
  const network = NETWORKS.testnet;

  // Check 1: RPC Reachability and Chain ID == 5042002
  const rpcUrl = network.rpcUrl;
  let chainId = 0;
  let rpcReachable = false;
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      chainId = parseInt(data.result, 16);
      rpcReachable = chainId === 5042002;
    }
  } catch {
    rpcReachable = false;
  }
  results.push({
    title: "Arc Testnet RPC & Chain ID",
    passed: rpcReachable,
    details: rpcReachable
      ? `Connected to ${rpcUrl} (Chain ID: ${chainId})`
      : `Failed to connect or Chain ID mismatch (expected 5042002, got ${chainId})`,
  });

  // Check 2: USDC Token Bytecode
  let contractExists = false;
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getCode",
        params: [network.usdcAddress, "latest"],
        id: 2,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const code = data.result || "0x";
      contractExists = code !== "0x" && code !== "0x0" && code.length > 2;
    }
  } catch {
    contractExists = false;
  }
  results.push({
    title: "Testnet USDC Token Contract",
    passed: contractExists,
    details: contractExists
      ? `Verified contract bytecode at ${network.usdcAddress}`
      : `No bytecode found or unreachable at ${network.usdcAddress}`,
  });

  // Check 3: Database Connection to v2_testnet schema
  let dbConnected = false;
  let dbDetails = "";
  try {
    const org = await withDbTimeout(() =>
      getDb("testnet").organization.findFirst({
        include: { invoices: true, settings: true },
      }),
      5000
    );
    dbConnected = true;
    dbDetails = org ? `Testnet database accessible; found org '${org.name}'.` : "Testnet database accessible (empty or pending seed).";
  } catch (err: any) {
    dbDetails = `Database query error: ${err.message}`;
  }
  results.push({
    title: "Testnet Database Schema (v2_testnet)",
    passed: dbConnected,
    details: dbDetails,
  });

  // Check 4: Supabase Private Evidence Storage Bucket (Read-Only)
  let storagePassed = false;
  let storageDetails = "";
  try {
    const bucketName = process.env.EVIDENCE_BUCKET_TESTNET || "delivery-evidence-testnet";
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      storageDetails = "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in environment.";
    } else {
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.storage.getBucket(bucketName);
      if (error) {
        storageDetails = `Bucket '${bucketName}' missing or error: ${error.message}`;
      } else if (data.public) {
        storageDetails = `SECURITY VIOLATION: Bucket '${bucketName}' is public. Must be private.`;
      } else {
        storagePassed = true;
        storageDetails = `Bucket '${bucketName}' verified present and private (public=false).`;
      }
    }
  } catch (err: any) {
    storageDetails = `Storage check error: ${err.message}`;
  }
  results.push({
    title: "Supabase Evidence Bucket (Read-Only)",
    passed: storagePassed,
    details: storageDetails,
  });

  // Summary Table
  console.log("----------------------------------------------------------------");
  let allPassed = true;
  for (const r of results) {
    const status = r.passed ? "[PASS]" : "[FAIL]";
    if (!r.passed) allPassed = false;
    console.log(`${status.padEnd(8)} ${r.title.padEnd(36)} -> ${r.details}`);
  }
  console.log("----------------------------------------------------------------\n");

  if (allPassed) {
    console.log("PREFLIGHT STATUS: ALL CHECKS PASSED. TESTNET READY.\n");
    process.exit(0);
  } else {
    console.warn("PREFLIGHT STATUS: ONE OR MORE CHECKS FAILED. PLEASE REVIEW ABOVE.\n");
    process.exit(1);
  }
}

runTestnetPreflight().catch((err) => {
  console.error("Fatal preflight error:", err);
  process.exit(1);
});
