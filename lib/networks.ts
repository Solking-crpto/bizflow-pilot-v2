/**
 * BizFlow Pilot V2 — Network Configuration and Arc Chain Guardrails
 * 
 * Centralized runtime network definition supporting instant switching between
 * Arc Testnet (5042002) and Arc Mainnet (5042).
 * 
 * The build-time variable NEXT_PUBLIC_NETWORK_MODE is NO LONGER the source of truth.
 * The active network is request-scoped via the 'bizflow_network' cookie,
 * falling back to DEFAULT_NETWORK (default "mainnet").
 */

import { defineChain, Chain } from "viem";

export type NetworkMode = "testnet" | "mainnet";

export const NETWORK_COOKIE_NAME = "bizflow_network";
export const NETWORK_HEADER_NAME = "x-bizflow-network";

export const DEFAULT_NETWORK: NetworkMode =
  process.env.DEFAULT_NETWORK === "testnet" ? "testnet" : "mainnet";

export interface NetworkConfig {
  mode: NetworkMode;
  name: string;
  badgeLabel: string;
  chainId: number;
  rpcUrl: string;
  publicRpcUrl: string;
  fallbackRpcs: string[];
  explorerUrl: string;
  usdcAddress: `0x${string}`;
  anchorAddress?: `0x${string}`;
  faucetUrl?: string;
  maxPaymentUsdc: string;
  isTestnet: boolean;
  chain: Chain;
}

export interface AddEthereumChainParameter {
  chainId: `0x${string}`;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

export const ARC_DOCS_URLS = {
  networkInfo: "https://docs.arc.io/arc-chain",
  rpcEndpoints: "https://docs.arc.io/arc/references/rpc-endpoints",
  connectToArc: "https://docs.arc.io/arc/references/connect-to-arc",
  gasAndFees: "https://docs.arc.io/arc/references/gas-and-fees",
  evmDifferences: "https://docs.arc.io/arc/references/evm-differences",
  getUsdcMainnet: "https://docs.arc.io/arc/references/connect-to-arc",
  testnetFaucet: "https://faucet.circle.com",
  addArcWallet: "https://docs.arc.io/arc/references/connect-to-arc",
};

// Official Arc mempool gas floor and fee settings
// Reference: https://docs.arc.io/arc/references/gas-and-fees
export const ARC_GAS_CONFIG = {
  MIN_MAX_FEE_PER_GAS_GWEI: 20n,
  MIN_MAX_FEE_PER_GAS_WEI: 20_000_000_000n, // 20 Gwei floor per Arc mempool rules
  DEFAULT_PRIORITY_FEE_WEI: 1_000_000_000n, // 1 Gwei EIP-1559 tip
};

// Server-side fallback RPCs across official Arc node providers (Blockdaemon, dRPC, QuickNode)
// Reference: https://docs.arc.io/arc/references/rpc-endpoints
export const MAINNET_FALLBACK_RPCS = [
  "https://rpc.blockdaemon.mainnet.arc.io",
  "https://rpc.drpc.mainnet.arc.io",
  "https://rpc.quicknode.mainnet.arc.io",
];

export const TESTNET_FALLBACK_RPCS = [
  "https://rpc.blockdaemon.testnet.arc.io",
  "https://rpc.drpc.testnet.arc.io",
  "https://rpc.quicknode.testnet.arc.io",
];

// Official PUBLIC RPC endpoints suitable for any user's browser wallet
export const PUBLIC_MAINNET_RPCS = [
  process.env.NEXT_PUBLIC_ARC_MAINNET_PUBLIC_RPC || "https://rpc.mainnet.arc.io",
  ...MAINNET_FALLBACK_RPCS,
];

export const PUBLIC_TESTNET_RPCS = [
  process.env.NEXT_PUBLIC_ARC_TESTNET_PUBLIC_RPC || "https://rpc.testnet.arc.io",
  ...TESTNET_FALLBACK_RPCS,
];

const DEFAULT_MAINNET_PUBLIC_RPC = PUBLIC_MAINNET_RPCS[0];
const DEFAULT_TESTNET_PUBLIC_RPC = PUBLIC_TESTNET_RPCS[0];
const DEFAULT_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as `0x${string}`;

export const arcTestnetChain = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.ARC_TESTNET_RPC_URL ||
        process.env.NEXT_PUBLIC_ARC_TESTNET_PUBLIC_RPC ||
        DEFAULT_TESTNET_PUBLIC_RPC,
      ],
    },
    public: {
      http: [
        process.env.NEXT_PUBLIC_ARC_TESTNET_PUBLIC_RPC ||
        DEFAULT_TESTNET_PUBLIC_RPC,
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Testnet Explorer",
      url: process.env.ARC_TESTNET_EXPLORER_URL || "https://explorer.testnet.arc.io",
    },
  },
});

export const arcMainnetChain = defineChain({
  id: 5042,
  name: "Arc Mainnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.ARC_MAINNET_RPC_URL ||
        process.env.NEXT_PUBLIC_ARC_MAINNET_PUBLIC_RPC ||
        DEFAULT_MAINNET_PUBLIC_RPC,
      ],
    },
    public: {
      http: [
        process.env.NEXT_PUBLIC_ARC_MAINNET_PUBLIC_RPC ||
        DEFAULT_MAINNET_PUBLIC_RPC,
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: process.env.ARC_MAINNET_EXPLORER_URL || "https://explorer.arc.io",
    },
  },
});

export const NETWORKS: Record<NetworkMode, NetworkConfig> = {
  mainnet: {
    mode: "mainnet",
    name: "Arc",
    badgeLabel: "ARC MAINNET: real USDC",
    chainId: 5042,
    rpcUrl:
      process.env.ARC_MAINNET_RPC_URL ||
      process.env.NEXT_PUBLIC_ARC_MAINNET_PUBLIC_RPC ||
      DEFAULT_MAINNET_PUBLIC_RPC,
    publicRpcUrl:
      process.env.NEXT_PUBLIC_ARC_MAINNET_PUBLIC_RPC ||
      DEFAULT_MAINNET_PUBLIC_RPC,
    fallbackRpcs: MAINNET_FALLBACK_RPCS,
    explorerUrl: process.env.ARC_MAINNET_EXPLORER_URL || "https://explorer.arc.io",
    usdcAddress:
      (process.env.ARC_MAINNET_USDC_ADDRESS as `0x${string}`) || DEFAULT_USDC_ADDRESS,
    anchorAddress:
      process.env.AUDIT_ANCHOR_ADDRESS_MAINNET && process.env.AUDIT_ANCHOR_ADDRESS_MAINNET.startsWith("0x")
        ? (process.env.AUDIT_ANCHOR_ADDRESS_MAINNET as `0x${string}`)
        : undefined,
    maxPaymentUsdc: process.env.APP_MAX_PAYMENT_USDC || "25.00",
    isTestnet: false,
    chain: arcMainnetChain,
  },
  testnet: {
    mode: "testnet",
    name: "Arc Testnet",
    badgeLabel: "TESTNET: test USDC has no value",
    chainId: 5042002,
    rpcUrl:
      process.env.ARC_TESTNET_RPC_URL ||
      process.env.NEXT_PUBLIC_ARC_TESTNET_PUBLIC_RPC ||
      DEFAULT_TESTNET_PUBLIC_RPC,
    publicRpcUrl:
      process.env.NEXT_PUBLIC_ARC_TESTNET_PUBLIC_RPC ||
      DEFAULT_TESTNET_PUBLIC_RPC,
    fallbackRpcs: TESTNET_FALLBACK_RPCS,
    explorerUrl: process.env.ARC_TESTNET_EXPLORER_URL || "https://explorer.testnet.arc.io",
    usdcAddress:
      (process.env.ARC_TESTNET_USDC_ADDRESS as `0x${string}`) || DEFAULT_USDC_ADDRESS,
    anchorAddress:
      process.env.AUDIT_ANCHOR_ADDRESS_TESTNET && process.env.AUDIT_ANCHOR_ADDRESS_TESTNET.startsWith("0x")
        ? (process.env.AUDIT_ANCHOR_ADDRESS_TESTNET as `0x${string}`)
        : undefined,
    faucetUrl: "https://faucet.circle.com",
    maxPaymentUsdc: process.env.APP_MAX_PAYMENT_USDC_TESTNET || "100.00",
    isTestnet: true,
    chain: arcTestnetChain,
  },
};

/**
 * Validates whether an unknown value is a valid NetworkMode.
 */
export function isValidNetwork(val: unknown): val is NetworkMode {
  return val === "mainnet" || val === "testnet";
}

/**
 * Parses and returns a validated NetworkMode or null.
 */
export function validateNetwork(val: unknown): NetworkMode | null {
  return isValidNetwork(val) ? val : null;
}

/**
 * Returns the NetworkConfig for a given network mode.
 */
export function getNetworkConfig(mode: NetworkMode): NetworkConfig {
  return NETWORKS[mode] || NETWORKS[DEFAULT_NETWORK];
}

/**
 * Request-scoped resolution of the active network mode.
 * Reads the 'bizflow_network' cookie string, validates against whitelist,
 * and falls back to DEFAULT_NETWORK.
 */
export function getServerActiveNetwork(cookieVal?: string | null): NetworkMode {
  if (cookieVal && isValidNetwork(cookieVal)) {
    return cookieVal;
  }
  return DEFAULT_NETWORK;
}

/**
 * Returns the chain parameters for wallet_addEthereumChain read directly
 * from official Arc specifications. The RPC URL provided is guaranteed to be
 * a public, unauthenticated RPC endpoint suitable for any end-user wallet.
 */
export function getWalletAddChainParams(mode: NetworkMode): AddEthereumChainParameter {
  const isMainnet = mode === "mainnet";
  const cfg = NETWORKS[mode];
  return {
    chainId: isMainnet ? "0x13B2" : "0x4CEF52", // 5042 or 5042002
    chainName: cfg.name,
    nativeCurrency: {
      name: "USDC",
      symbol: "USDC",
      decimals: 18,
    },
    rpcUrls: [cfg.publicRpcUrl],
    blockExplorerUrls: [cfg.explorerUrl],
  };
}

/**
 * Hard guard refusing startup if unsafe configurations are detected on Arc Mainnet.
 */
export function assertValidSandboxMode(mode?: NetworkMode): void {
  const activeMode =
    mode ||
    (process.env.DEFAULT_NETWORK === "testnet" || process.env.NEXT_PUBLIC_NETWORK_MODE === "testnet"
      ? "testnet"
      : DEFAULT_NETWORK);
  const isPublicSandbox =
    process.env.PUBLIC_SANDBOX === "true" || process.env.NEXT_PUBLIC_PUBLIC_SANDBOX === "true";
  const isDryRun = process.env.DRY_RUN === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (activeMode === "mainnet") {
    if (isPublicSandbox) {
      throw new Error(
        "CRITICAL SECURITY VIOLATION: PUBLIC_SANDBOX is strictly prohibited on Arc Mainnet! Refusing startup."
      );
    }
    if (isProduction && isDryRun) {
      throw new Error(
        "CRITICAL SECURITY VIOLATION: DRY_RUN cannot be enabled on Arc Mainnet in production! Refusing startup."
      );
    }
  }

  // Startup warning in dev when DRY_RUN is set
  if (isDryRun && !isProduction && typeof window === "undefined") {
    if (!(globalThis as any).__dryRunWarned) {
      console.warn(
        "\x1b[33m[BizFlow Security Warning] DRY_RUN is currently active in the shell environment. Transactions will be simulated without broadcasting to Arc.\x1b[0m"
      );
      (globalThis as any).__dryRunWarned = true;
    }
  }
}

/**
 * Backward-compatible helper that resolves network config.
 * When called with no arguments, resolves based on DEFAULT_NETWORK.
 */
export function getActiveNetwork(mode?: NetworkMode): NetworkConfig {
  assertValidSandboxMode(mode);
  return getNetworkConfig(mode || DEFAULT_NETWORK);
}
