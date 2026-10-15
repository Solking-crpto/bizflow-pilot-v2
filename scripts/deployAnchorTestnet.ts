import fs from "fs";
import path from "path";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnetChain } from "../lib/networks";

async function main() {
  console.log("================================================================");
  console.log("      BizFlow Pilot — Deploy AuditAnchor.sol to Arc Testnet     ");
  console.log("================================================================");

  const rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
  if (!rawKey || !rawKey.startsWith("0x")) {
    console.error("[ERROR]: TREASURY_PRIVATE_KEY or TESTNET_PRIVATE_KEY is missing or invalid in environment.");
    process.exit(1);
  }

  const rpcUrl = process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.io";
  const account = privateKeyToAccount(rawKey as `0x${string}`);

  console.log(`Deployer Public EOA: ${account.address}`);
  console.log(`Target RPC Endpoint: ${rpcUrl}`);
  console.log(`Target Chain: Arc Testnet (ID 5042002)`);

  const publicClient = createPublicClient({
    chain: arcTestnetChain,
    transport: http(rpcUrl, { timeout: 10000 }),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnetChain,
    transport: http(rpcUrl, { timeout: 15000 }),
  });

  // 1. Gas Balance Check
  console.log("\nChecking deployer native gas balance on Arc Testnet...");
  let gasBalance = 0n;
  try {
    gasBalance = await publicClient.getBalance({ address: account.address });
  } catch (err: any) {
    console.error(`[ERROR]: Failed to query gas balance: ${err.message}`);
    process.exit(1);
  }

  console.log(`Native Gas Balance: ${gasBalance.toString()} wei`);

  if (gasBalance === 0n) {
    console.error("\n[ERROR]: Deployer account has 0 Arc testnet native gas.");
    console.error("Get free test funds from the Circle Arc Testnet faucet: https://faucet.circle.com");
    process.exit(1);
  }

  // 2. Load compiled artifact
  const artifactPath = path.join(__dirname, "..", "contracts", "AuditAnchor.json");
  if (!fs.existsSync(artifactPath)) {
    console.error(`[ERROR]: Contract artifact not found at ${artifactPath}. Run 'npm run compile:contracts' first.`);
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode?.object || artifact.bytecode;

  if (!bytecode || bytecode === "0x") {
    console.error("[ERROR]: Contract bytecode is empty in artifact.");
    process.exit(1);
  }

  console.log("\nBroadcasting AuditAnchor deployment transaction to Arc Testnet...");
  const hash = await walletClient.deployContract({
    abi,
    bytecode: bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`,
    args: [],
  });

  console.log(`Deployment Transaction Submitted: ${hash}`);
  console.log("Waiting for confirmation on Arc Testnet...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Contract Deployed Successfully at: ${receipt.contractAddress}`);
  console.log(`Block Number: ${receipt.blockNumber}`);

  // Save deployment artifact
  const outPath = path.join(__dirname, "..", "docs", "TESTNET_DEPLOYMENT.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        network: "testnet",
        chainId: 5042002,
        address: receipt.contractAddress,
        deployer: account.address,
        txHash: hash,
        blockNumber: Number(receipt.blockNumber),
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`Saved deployment record to ${outPath}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
