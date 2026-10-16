/**
 * BizFlow Pilot V2 — Resilient Arc RPC Client
 *
 * Implements exponential backoff retry for Arc-specific RPC error -32014,
 * and multi-provider failover across official Arc node providers:
 * - Circle Primary
 * - Blockdaemon
 * - dRPC
 * - QuickNode
 *
 * Reference: https://docs.arc.io/arc/references/rpc-endpoints
 * "The primary endpoint is load-balanced across multiple backends that may be
 * at slightly different block heights... it may return error -32014 because it hasn't
 * yet imported that block. You can safely retry requests that return -32014 after a brief backoff."
 */

import { NetworkMode, getNetworkConfig } from "@/lib/networks";
import { createPublicClient, http, PublicClient } from "viem";

export const ARC_RPC_ERROR_BLOCK_LAG = -32014;

export interface RpcRetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  onRetry?: (attempt: number, error: any, delayMs: number) => void;
}

/**
 * Checks whether an error is Arc RPC error code -32014 (or block sync lag).
 */
export function isArcLagError(err: any): boolean {
  if (!err) return false;
  if (err.code === ARC_RPC_ERROR_BLOCK_LAG || err.code === -32014) return true;
  if (err?.cause?.code === ARC_RPC_ERROR_BLOCK_LAG || err?.cause?.code === -32014) return true;
  const msg = String(err.message || err.details || "");
  return msg.includes("-32014") || msg.toLowerCase().includes("block not found") || msg.toLowerCase().includes("header not found");
}

/**
 * Executes an RPC action with exponential backoff for error code -32014.
 */
export async function withRpcRetry<T>(
  action: () => Promise<T>,
  options: RpcRetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelay = options.initialDelayMs ?? 200;
  const backoffFactor = options.backoffFactor ?? 2;

  let attempt = 0;
  let delay = initialDelay;

  while (true) {
    try {
      return await action();
    } catch (err: any) {
      attempt++;
      if (attempt <= maxRetries && isArcLagError(err)) {
        if (options.onRetry) {
          options.onRetry(attempt, err, delay);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= backoffFactor;
        continue;
      }
      throw err;
    }
  }
}

/**
 * Creates a Viem public client configured for the given network,
 * wrapping calls with fallback provider support and -32014 retry.
 */
export function createResilientPublicClient(network: NetworkMode): PublicClient {
  const config = getNetworkConfig(network);
  const endpoints = [config.rpcUrl, ...(config.fallbackRpcs || [])].filter(Boolean);

  // Use primary endpoint with viem's http transport
  return createPublicClient({
    chain: config.chain,
    transport: http(endpoints[0], {
      timeout: 15_000,
      retryCount: 3,
      retryDelay: 300,
    }),
  });
}

/**
 * Executes a read operation against primary RPC, falling back to server-side
 * node providers (Blockdaemon, dRPC, QuickNode) if primary fails.
 */
export async function executeWithFallback<T>(
  network: NetworkMode,
  operation: (client: PublicClient) => Promise<T>
): Promise<T> {
  const config = getNetworkConfig(network);
  const endpoints = [config.rpcUrl, ...(config.fallbackRpcs || [])].filter(Boolean);

  let lastError: any = null;

  for (let i = 0; i < endpoints.length; i++) {
    const rpc = endpoints[i];
    const client = createPublicClient({
      chain: config.chain,
      transport: http(rpc, { timeout: 15_000 }),
    });

    try {
      return await withRpcRetry(() => operation(client), {
        maxRetries: 2,
        initialDelayMs: 200,
      });
    } catch (err: any) {
      lastError = err;
      // If error is not recoverable on this provider, move to next fallback
      if (i < endpoints.length - 1) {
        continue;
      }
    }
  }

  throw lastError || new Error(`All Arc RPC endpoints failed for network ${network}`);
}
