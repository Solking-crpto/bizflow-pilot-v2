/**
 * BizFlow Pilot — Network Configuration and Arc Chain Guardrails
 * 
 * Centralized network definition ensuring safe, isolated execution for
 * Arc Testnet (5042002) and Arc Mainnet (5042).
 */

import { defineChain, Chain } from "viem";

export type NetworkMode = "testnet" | "mainnet";

export interface NetworkConfig {
  mode: NetworkMode;
  name: string;
  chainId: number;
  rpcUrl: string;
  fallbackRpcs: string[];
  explorerUrl: string;
  usdcAddress: `0x${string}`;
  anchorAddress?: `0x${string}`;
  faucetUrl?: string;
  maxPaymentUsdc: string;
  chain: Chain;
}

const DEFAULT_TESTNET_RPC = "https://rpc.testnet.arc.network";
const DEFAULT_MAINNET_RPC = "https://rpc.mainnet.arc.io";
const DEFAULT_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as `0x${string}`;

export const arcTestnetChain = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_TESTNET_RPC_URL || DEFAULT_TESTNET_RPC] } },
  blockExplorers: { default: { name: "Arcscan", url: "https://testnet.arcscan.app" } },
});

export const arcMainnetChain = defineChain({
  id: 5042,
  name: "Arc Mainnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_MAINNET_RPC_URL || DEFAULT_MAINNET_RPC] } },
  blockExplorers: { default: { name: "Arc Explorer", url: process.env.ARC_MAINNET_EXPLORER_URL || "https://explorer.arc.io" } },
});

export const NETWORKS: Record<NetworkMode, NetworkConfig> = {
  testnet: {
    mode: "testnet",
    name: "Arc Testnet",
    chainId: 5042002,
    rpcUrl: process.env.ARC_TESTNET_RPC_URL || DEFAULT_TESTNET_RPC,
    fallbackRpcs: ["https://rpc.testnet.arc.io"],
    explorerUrl: "https://testnet.arcscan.app",
    usdcAddress: (process.env.ARC_TESTNET_USDC_ADDRESS as `0x${string}`) || DEFAULT_USDC_ADDRESS,
    anchorAddress: (process.env.NEXT_PUBLIC_AUDIT_ANCHOR_ADDRESS || process.env.AUDIT_ANCHOR_ADDRESS) as `0x${string}` | undefined,
    faucetUrl: "https://faucet.circle.com",
    maxPaymentUsdc: "10000.00",
    chain: arcTestnetChain,
  },
  mainnet: {
    mode: "mainnet",
    name: "Arc Mainnet",
    chainId: 5042,
    rpcUrl: process.env.ARC_MAINNET_RPC_URL || DEFAULT_MAINNET_RPC,
    fallbackRpcs: (process.env.ARC_MAINNET_RPC_FALLBACKS || "https://rpc.arc.network")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    explorerUrl: process.env.ARC_MAINNET_EXPLORER_URL || "https://explorer.arc.io",
    usdcAddress: (process.env.ARC_MAINNET_USDC_ADDRESS as `0x${string}`) || DEFAULT_USDC_ADDRESS,
    anchorAddress: (process.env.NEXT_PUBLIC_AUDIT_ANCHOR_ADDRESS || process.env.AUDIT_ANCHOR_ADDRESS) as `0x${string}` | undefined,
    maxPaymentUsdc: process.env.MAX_MAINNET_PAYMENT_USDC || "1.00",
    chain: arcMainnetChain,
  },
};

/**
 * Hard guard refusing startup if PUBLIC_SANDBOX is enabled on Arc Mainnet.
 */
export function assertValidSandboxMode(): void {
  const mode = (process.env.NEXT_PUBLIC_NETWORK_MODE || process.env.NETWORK_MODE || "testnet") as NetworkMode;
  const isPublicSandbox =
    process.env.PUBLIC_SANDBOX === "true" || process.env.NEXT_PUBLIC_PUBLIC_SANDBOX === "true";

  if (mode === "mainnet" && isPublicSandbox) {
    throw new Error(
      "CRITICAL SECURITY VIOLATION: PUBLIC_SANDBOX is strictly prohibited on Arc Mainnet! Refusing startup."
    );
  }
}

/**
 * Returns the currently active network configuration based on NEXT_PUBLIC_NETWORK_MODE
 */
export function getActiveNetwork(): NetworkConfig {
  assertValidSandboxMode();
  const mode = (process.env.NEXT_PUBLIC_NETWORK_MODE || "testnet") as NetworkMode;
  return NETWORKS[mode] || NETWORKS.testnet;
}

/**
 * Verifies that the connected RPC's chain ID matches our expected Arc network chain ID.
 * Refuses execution if there is a mismatch.
 */
export async function validateRpcChainId(rpcUrl?: string): Promise<{ valid: boolean; actualChainId: number; expectedChainId: number; error?: string }> {
  const network = getActiveNetwork();
  const targetRpc = rpcUrl || network.rpcUrl;

  try {
    const res = await fetch(targetRpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return {
        valid: false,
        actualChainId: 0,
        expectedChainId: network.chainId,
        error: `RPC returned HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const hexChainId = data.result;
    const actualChainId = parseInt(hexChainId, 16);

    return {
      valid: actualChainId === network.chainId,
      actualChainId,
      expectedChainId: network.chainId,
      error: actualChainId !== network.chainId ? `Chain ID mismatch: expected ${network.chainId}, got ${actualChainId}` : undefined,
    };
  } catch (err: any) {
    return {
      valid: false,
      actualChainId: 0,
      expectedChainId: network.chainId,
      error: err.message || "Failed to reach RPC endpoint",
    };
  }
}
