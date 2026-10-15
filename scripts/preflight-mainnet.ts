import { createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getDb, withDbTimeout } from "../lib/db";
import { isBlocklistedWallet } from "../lib/security/walletBlocklist";
import { parseUsdc, formatUsdc, usdcAtomic } from "../lib/money";

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

interface CheckResult {
  title: string;
  passed: boolean;
  details: string;
}

async function runPreflight(): Promise<void> {
  console.log("================================================================");
  console.log("       BizFlow Pilot — Arc Mainnet Read-Only Preflight Audit     ");
  console.log("================================================================");
  console.log("Safety Note: This script performs read-only checks only.");
  console.log("Zero transactions are broadcast. Secrets are never printed.\n");

  const results: CheckResult[] = [];

  // Check 1: Environment Variables Presence
  const requiredEnvVars = [
    "ARC_MAINNET_RPC_URL",
    "ARC_MAINNET_USDC_ADDRESS",
    "TREASURY_PRIVATE_KEY",
    "VENDOR_WALLET_ADDRESS",
  ];
  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
  results.push({
    title: "Required Environment Variables",
    passed: missingVars.length === 0,
    details:
      missingVars.length === 0
        ? `All required variables present (${requiredEnvVars.join(", ")})`
        : `Missing: ${missingVars.join(", ")}`,
  });

  // Check 2: RPC Reachability and Chain ID == 5042
  const rpcUrl = process.env.ARC_MAINNET_RPC_URL || "https://rpc.mainnet.arc.io";
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
      rpcReachable = chainId === 5042;
    }
  } catch (err: any) {
    rpcReachable = false;
  }
  results.push({
    title: "RPC Reachability & Chain ID 5042",
    passed: rpcReachable,
    details: rpcReachable
      ? `Connected to Arc Mainnet (Chain ID ${chainId})`
      : `Failed to confirm Chain ID 5042 via ${rpcUrl}`,
  });

  // Check 3: USDC Contract Code Exists
  const usdcAddress = (process.env.ARC_MAINNET_USDC_ADDRESS || "0x3600000000000000000000000000000000000000") as `0x${string}`;
  let contractExists = false;
  try {
    const client = createPublicClient({ transport: http(rpcUrl, { timeout: 5000 }) });
    const code = await client.getBytecode({ address: usdcAddress });
    contractExists = !!code && code.length > 2;
  } catch {
    contractExists = false;
  }
  results.push({
    title: "USDC Token Contract Verification",
    passed: contractExists,
    details: contractExists
      ? `ERC-20 contract bytecode verified at ${usdcAddress}`
      : `No bytecode found or unreachable at ${usdcAddress}`,
  });

  // Check 4: Treasury Wallet Balances
  let treasuryGasBalance = 0n;
  let treasuryUsdcBalance = 0n;
  let treasuryAddress: `0x${string}` = "0x0000000000000000000000000000000000000000";
  let treasuryDerivationPassed = false;

  const rawKey = process.env.TREASURY_PRIVATE_KEY;
  if (rawKey && rawKey.startsWith("0x") && rawKey.length === 66) {
    try {
      const account = privateKeyToAccount(rawKey as `0x${string}`);
      treasuryAddress = account.address;
      treasuryDerivationPassed = true;

      const client = createPublicClient({ transport: http(rpcUrl, { timeout: 5000 }) });
      treasuryGasBalance = await client.getBalance({ address: treasuryAddress });
      treasuryUsdcBalance = (await client.readContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [treasuryAddress],
      })) as bigint;
    } catch {
      // Keep defaults
    }
  }

  const maxPaymentUsdc = parseFloat(process.env.MAX_MAINNET_PAYMENT_USDC || "1.00");
  const minRequiredAtomic = parseUsdc(process.env.AUTO_APPROVE_LIMIT_USDC || "0.50");
  const hasGas = treasuryGasBalance > 0n;
  const hasUsdc = treasuryUsdcBalance >= minRequiredAtomic;

  results.push({
    title: "Treasury Account Balances",
    passed: treasuryDerivationPassed && hasGas && hasUsdc,
    details: !treasuryDerivationPassed
      ? "Could not derive treasury account from TREASURY_PRIVATE_KEY"
      : `Address: ${treasuryAddress.slice(0, 6)}...${treasuryAddress.slice(-4)} | Gas: ${hasGas ? "Funded (>0)" : "0 (Needs Arc gas-USDC)"} | USDC: ${formatUsdc(usdcAtomic(treasuryUsdcBalance))} (>= ${formatUsdc(usdcAtomic(minRequiredAtomic))} auto-limit)`,
  });

  // Check 5: Vendor Wallet Isolation & Blocklist
  const vendorWallet = (process.env.VENDOR_WALLET_ADDRESS || "").trim();
  const isVendorValid =
    !!vendorWallet &&
    /^0x[0-9a-fA-F]{40}$/.test(vendorWallet) &&
    vendorWallet.toLowerCase() !== treasuryAddress.toLowerCase() &&
    !isBlocklistedWallet(vendorWallet);

  results.push({
    title: "Vendor Wallet Safety & Isolation",
    passed: isVendorValid,
    details: !vendorWallet
      ? "VENDOR_WALLET_ADDRESS not configured"
      : isBlocklistedWallet(vendorWallet)
      ? "VENDOR_WALLET_ADDRESS is in Hardhat/Anvil public blocklist!"
      : vendorWallet.toLowerCase() === treasuryAddress.toLowerCase()
      ? "VENDOR_WALLET_ADDRESS cannot match treasury wallet"
      : `Verified: ${vendorWallet.slice(0, 6)}...${vendorWallet.slice(-4)} (distinct from treasury & not blocklisted)`,
  });

  // Check 6: Database Organization & Invoices
  let dbOrgPassed = false;
  let dbDetails = "";
  try {
    const dbTimeoutMs = parseInt(process.env.DB_TIMEOUT_MS || "15000", 10);
    const org = await withDbTimeout(
      () =>
        getDb("mainnet").organization.findFirst({
          include: { invoices: true, settings: true },
        }),
      dbTimeoutMs
    );

    if (org && org.invoices.length > 0) {
      dbOrgPassed = true;
      dbDetails = `Org '${org.name}' has ${org.invoices.length} mainnet demo-scale invoices.`;
    } else {
      dbDetails = "No organization with mainnet invoices found. Run: npm run seed:mainnet";
    }
  } catch (err: any) {
    dbDetails = `Database query error: ${err.message}`;
  }

  results.push({
    title: "Database State & Mainnet Seed",
    passed: dbOrgPassed,
    details: dbDetails,
  });

  // Check 7: Guardrails and Spending Limits
  const capPassed = maxPaymentUsdc <= 1.0;
  results.push({
    title: "Spending Guardrails & Safety Caps",
    passed: capPassed,
    details: capPassed
      ? `MAX_MAINNET_PAYMENT_USDC = ${maxPaymentUsdc.toFixed(2)} USDC (<= 1.00 USDC cap)`
      : `Cap violation: MAX_MAINNET_PAYMENT_USDC (${maxPaymentUsdc}) exceeds hackathon limit of 1.00 USDC`,
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
    console.log("PREFLIGHT STATUS: ALL CHECKS PASSED. SYSTEM READY FOR MAINNET.\n");
    process.exit(0);
  } else {
    console.warn("PREFLIGHT STATUS: ONE OR MORE CHECKS FAILED. PLEASE REVIEW ABOVE.\n");
    process.exit(1);
  }
}

runPreflight().catch((err) => {
  console.error("Fatal preflight error:", err);
  process.exit(1);
});
