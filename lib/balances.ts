import { createPublicClient, http, parseAbi } from "viem";
import { formatUsdc, usdcAtomic } from "./money";
import { getTreasuryPublicAddress } from "./treasury";
import { NETWORKS, NetworkMode } from "./networks";

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

export interface TreasuryBalanceResult {
  usdcFormatted: string;
  usdcAtomicValue: bigint;
  gasFormatted: string;
  gasAtomicValue: bigint;
  isLive: boolean;
  error?: string;
}

/**
 * Fetches real on-chain balances for the treasury wallet on Arc,
 * preventing hardcoded or fake balances.
 */
export async function getTreasuryBalances(networkMode: NetworkMode = "mainnet"): Promise<TreasuryBalanceResult> {
  const network = NETWORKS[networkMode];

  const treasuryAddress = getTreasuryPublicAddress();
  if (!treasuryAddress || treasuryAddress === "0x0000000000000000000000000000000000000000") {
    return {
      usdcFormatted: "0.00",
      usdcAtomicValue: 0n,
      gasFormatted: "0.0000",
      gasAtomicValue: 0n,
      isLive: true,
      error: "Treasury address not derived",
    };
  }

  try {
    const client = createPublicClient({
      chain: network.chain,
      transport: http(network.rpcUrl, { timeout: 4000 }),
    });

    const [gasBalance, usdcBalance] = await Promise.all([
      client.getBalance({ address: treasuryAddress as `0x${string}` }),
      client.readContract({
        address: network.usdcAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [treasuryAddress as `0x${string}`],
      }) as Promise<bigint>,
    ]);

    return {
      usdcFormatted: formatUsdc(usdcAtomic(usdcBalance)),
      usdcAtomicValue: usdcBalance,
      gasFormatted: (Number(gasBalance) / 1e18).toFixed(4),
      gasAtomicValue: gasBalance,
      isLive: true,
    };
  } catch (err: any) {
    return {
      usdcFormatted: "0.00",
      usdcAtomicValue: 0n,
      gasFormatted: "0.0000",
      gasAtomicValue: 0n,
      isLive: true,
      error: err.message || "Failed to fetch on-chain balances",
    };
  }
}
