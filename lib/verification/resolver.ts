import { getDb, withDbTimeout } from "@/lib/db";
import { NetworkMode, getServerActiveNetwork } from "@/lib/networks";
import { PrismaClient } from "@prisma/client";

/**
 * Resolves the database and network for a verifier request by token hash.
 * A mobile verifier has no initial cookie, so this searches testnet then mainnet
 * to locate the target delivery request without needing cross-network configuration.
 */
export async function resolveVerifierDb(
  tokenHash: string,
  cookieNetwork?: string | null
): Promise<{ network: NetworkMode; db: PrismaClient } | null> {
  const preferred = cookieNetwork ? getServerActiveNetwork(cookieNetwork) : null;
  const searchOrder: NetworkMode[] =
    preferred === "mainnet"
      ? ["mainnet", "testnet"]
      : preferred === "testnet"
      ? ["testnet", "mainnet"]
      : process.env.NODE_ENV === "test" || process.env.VITEST
      ? ["testnet", "mainnet"]
      : ["testnet", "mainnet"];

  for (const net of searchOrder) {
    try {
      const db = getDb(net);
      const found = await withDbTimeout(
        () => db.deliveryRequest.findUnique({ where: { tokenHash }, select: { id: true } }),
        8000
      );
      if (found) {
        return { network: net, db };
      }
    } catch {
      // Continue to next network candidate
    }
  }

  // Fallback to preferred or testnet
  const fallbackNet = preferred || (process.env.NODE_ENV === "test" || process.env.VITEST ? "testnet" : "testnet");
  return { network: fallbackNet, db: getDb(fallbackNet) };
}
