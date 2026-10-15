import fs from "fs";
import path from "path";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getActiveNetwork } from "../lib/networks";
import { getTreasuryPrivateKey } from "../lib/treasury";

async function main() {
  console.log("==================================================");
  console.log("      BizFlow Pilot V2 — PolicyVault Deployer     ");
  console.log("==================================================");

  const hasYesFlag = process.argv.includes("--yes");
  const network = getActiveNetwork();
  const isMainnet = network.mode === "mainnet";

  if (!hasYesFlag) {
    console.error("SAFETY REFUSAL: Missing required --yes flag.");
    console.error("To deploy PolicyVault to", network.name, "run with: --yes");
    process.exit(1);
  }

  if (isMainnet) {
    console.warn("==================================================");
    console.warn("  WARNING: DEPLOYING TO ARC MAINNET (5042)        ");
    console.warn("==================================================");
  }

  const artifactPath = path.join(__dirname, "../artifacts/contracts/PolicyVault.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error("Missing compiled PolicyVault artifact. Run 'npm run compile:contracts' first.");
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const privateKey = getTreasuryPrivateKey();
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: network.chain,
    transport: http(network.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: network.chain,
    transport: http(network.rpcUrl),
  });

  const perTxLimit = 1000000n; // 1.00 USDC default limit
  const dailyLimit = 2000000n; // 2.00 USDC default daily cap

  console.log(`Deploying PolicyVault from: ${account.address}`);
  console.log(`Target Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Parameters: Per-Tx Limit: 1.00 USDC, Daily Limit: 2.00 USDC, Operator: ${account.address}`);

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [account.address, perTxLimit, dailyLimit],
  });

  console.log(`Deployment transaction submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  console.log("==================================================");
  console.log(`PolicyVault deployed successfully!`);
  console.log(`Contract Address: ${receipt.contractAddress}`);
  console.log(`Explorer: ${network.explorerUrl}/address/${receipt.contractAddress}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
