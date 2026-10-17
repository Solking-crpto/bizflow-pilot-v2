/**
 * BizFlow Pilot V2 — Wallet Balance & Gas Sufficiency Verification on Arc
 * 
 * Handles reading the connected wallet's USDC and native gas balances on Arc:
 * 1. Reads connected account address on the active network.
 * 2. Uses wallet provider first, then public RPC with retry as fallback.
 * 3. Never treats a failed RPC read as 0.
 * 4. Splits payment check vs gas check (Arc uses USDC for both payment and gas).
 * 5. Handles 6-decimal ERC-20 vs 18-decimal native gas conversion accurately.
 */

import { createPublicClient, custom, http, erc20Abi, formatUnits } from "viem";
import { NetworkConfig, ARC_GAS_CONFIG } from "@/lib/networks";
import { bigintMax } from "@/lib/bigint";

export const SCALE_6_TO_18 = 10n ** 12n; // 1e12
export const DEFAULT_GAS_LIMIT = 65_000n; // Standard Arc ERC-20 transfer

export interface WalletBalanceResult {
  success: boolean;
  tokenBal6: bigint;
  nativeBal18: bigint;
  effectiveBal18: bigint;
  effectiveBalFormatted: string;
  source: "provider" | "public_rpc" | "failed";
  error?: string;
}

export interface GasSufficiencyResult {
  paymentAmount18: bigint;
  estimatedGas18: bigint;
  totalRequired18: bigint;
  hasSufficientPayment: boolean;
  hasSufficientGas: boolean;
  hasSufficientTotal: boolean;
  balanceFormatted: string;
  paymentFormatted: string;
  gasFormatted: string;
  summaryLine: string;
  errorType: "NONE" | "BALANCE_TOO_LOW_FOR_PAYMENT" | "NOT_ENOUGH_FOR_GAS";
  errorMessage: string | null;
}

/**
 * Converts 6-decimal atomic USDC to 18-decimal native units.
 */
export function convert6To18(amount6: bigint): bigint {
  return amount6 * SCALE_6_TO_18;
}

/**
 * Converts 18-decimal native units to 6-decimal atomic USDC (truncating remainder).
 */
export function convert18To6(amount18: bigint): bigint {
  return amount18 / SCALE_6_TO_18;
}

/**
 * Formats 18-decimal atomic units into user-friendly USDC string (e.g. 5.00, 0.10, 0.0013).
 */
export function formatUsdc18(amount18: bigint, maxDecimals: number = 4): string {
  if (amount18 === 0n) return "0.00";
  const raw = formatUnits(amount18, 18);
  const parts = raw.split(".");
  if (parts.length === 1) return `${parts[0]}.00`;

  const intPart = parts[0];
  const decPart = parts[1];

  // For small numbers like gas (0.0013), keep up to maxDecimals significant decimals
  let trimmed = decPart.slice(0, maxDecimals);
  // Ensure at least 2 decimal places (e.g., 5.0 -> 5.00)
  while (trimmed.length < 2) {
    trimmed += "0";
  }
  // Trim trailing zeros after 2 decimal places
  if (trimmed.length > 2) {
    trimmed = trimmed.replace(/0+$/, "");
    if (trimmed.length < 2) trimmed = trimmed.padEnd(2, "0");
  }

  return `${intPart}.${trimmed}`;
}

/**
 * Formats 6-decimal atomic USDC into user-friendly USDC string.
 */
export function formatUsdc6(amount6: bigint): string {
  return formatUsdc18(convert6To18(amount6), 2);
}

/**
 * Reads token and native balances for a wallet address on the target network.
 * Attempts wallet provider first, then falls back to public RPCs with retry.
 */
export async function readWalletBalance(params: {
  address: `0x${string}`;
  activeNetwork: NetworkConfig;
  tokenAddress: `0x${string}`;
  walletProvider?: any;
}): Promise<WalletBalanceResult> {
  const { address, activeNetwork, tokenAddress, walletProvider } = params;

  // 1. Try wallet provider first
  if (walletProvider) {
    try {
      const providerClient = createPublicClient({
        chain: activeNetwork.chain,
        transport: custom(walletProvider),
      });

      const [balResult, gasResult] = await Promise.all([
        providerClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        }),
        providerClient.getBalance({ address }),
      ]);

      const tokenBal6 = balResult as bigint;
      const nativeBal18 = gasResult as bigint;
      const tokenBal18 = convert6To18(tokenBal6);
      const effectiveBal18 = bigintMax(nativeBal18, tokenBal18);

      return {
        success: true,
        tokenBal6,
        nativeBal18,
        effectiveBal18,
        effectiveBalFormatted: formatUsdc18(effectiveBal18, 2),
        source: "provider",
      };
    } catch {
      // Provider read failed, proceed to public RPC fallback
    }
  }

  // 2. Try public RPC with fallback endpoints
  const rpcsToTry = [
    activeNetwork.publicRpcUrl,
    activeNetwork.rpcUrl,
    ...(activeNetwork.fallbackRpcs || []),
  ].filter((url, index, arr) => Boolean(url) && arr.indexOf(url) === index);

  for (const rpcUrl of rpcsToTry) {
    try {
      const publicClient = createPublicClient({
        chain: activeNetwork.chain,
        transport: http(rpcUrl, { timeout: 4000 }),
      });

      const [balResult, gasResult] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        }),
        publicClient.getBalance({ address }),
      ]);

      const tokenBal6 = balResult as bigint;
      const nativeBal18 = gasResult as bigint;
      const tokenBal18 = convert6To18(tokenBal6);
      const effectiveBal18 = bigintMax(nativeBal18, tokenBal18);

      return {
        success: true,
        tokenBal6,
        nativeBal18,
        effectiveBal18,
        effectiveBalFormatted: formatUsdc18(effectiveBal18, 2),
        source: "public_rpc",
      };
    } catch {
      // Try next RPC
    }
  }

  // 3. Never treat a failed read as 0
  return {
    success: false,
    tokenBal6: 0n,
    nativeBal18: 0n,
    effectiveBal18: 0n,
    effectiveBalFormatted: "0.00",
    source: "failed",
    error: "Could not read your balance. Retry",
  };
}

/**
 * Calculates required payment and gas amounts, comparing them against the user balance.
 */
export function checkGasAndBalanceSufficiency(params: {
  effectiveBal18: bigint;
  paymentAmountAtomic6: bigint;
  gasLimit?: bigint;
  maxFeePerGasWei?: bigint;
}): GasSufficiencyResult {
  const {
    effectiveBal18,
    paymentAmountAtomic6,
    gasLimit = DEFAULT_GAS_LIMIT,
    maxFeePerGasWei = ARC_GAS_CONFIG.MIN_MAX_FEE_PER_GAS_WEI,
  } = params;

  // Arc gas floor guard
  const feeFloor = bigintMax(maxFeePerGasWei, ARC_GAS_CONFIG.MIN_MAX_FEE_PER_GAS_WEI);
  const estimatedGas18 = gasLimit * feeFloor;
  const paymentAmount18 = convert6To18(paymentAmountAtomic6);
  const totalRequired18 = paymentAmount18 + estimatedGas18;

  const hasSufficientPayment = effectiveBal18 >= paymentAmount18;
  const hasSufficientGas = effectiveBal18 >= totalRequired18;
  const hasSufficientTotal = hasSufficientPayment && hasSufficientGas;

  const balanceFormatted = formatUsdc18(effectiveBal18, 2);
  const paymentFormatted = formatUsdc18(paymentAmount18, 2);
  const gasFormatted = formatUsdc18(estimatedGas18, 4);

  const summaryLine = `Balance ${balanceFormatted} USDC · Payment ${paymentFormatted} USDC · Estimated gas ${gasFormatted} USDC`;

  let errorType: GasSufficiencyResult["errorType"] = "NONE";
  let errorMessage: string | null = null;

  if (!hasSufficientPayment) {
    errorType = "BALANCE_TOO_LOW_FOR_PAYMENT";
    if (effectiveBal18 === 0n) {
      errorMessage = `Your wallet holds 0 USDC, but this settlement requires ${paymentFormatted} USDC (plus estimated gas).`;
    } else {
      errorMessage = `Your balance of ${balanceFormatted} USDC is too low for this payment of ${paymentFormatted} USDC.`;
    }
  } else if (!hasSufficientGas) {
    errorType = "NOT_ENOUGH_FOR_GAS";
    errorMessage = `Not enough USDC left for gas: your balance covers the ${paymentFormatted} USDC payment, but Arc requires ~${gasFormatted} USDC for gas fees (20 Gwei floor).`;
  }

  return {
    paymentAmount18,
    estimatedGas18,
    totalRequired18,
    hasSufficientPayment,
    hasSufficientGas,
    hasSufficientTotal,
    balanceFormatted,
    paymentFormatted,
    gasFormatted,
    summaryLine,
    errorType,
    errorMessage,
  };
}
