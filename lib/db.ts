import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prefer DIRECT_URL (port 5432 direct connection) over pooled DATABASE_URL if provided,
// particularly for environments where port 6543 is firewalled.
function getOptimizedDatasourceUrl(): string | undefined {
  let url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return undefined;
  if (!url.includes("connection_limit=")) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}connection_limit=3&pool_timeout=20&connect_timeout=15`;
  }
  return url;
}

const datasourceUrl = getOptimizedDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: datasourceUrl ? datasourceUrl : undefined,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Retrieves the configured database query timeout in milliseconds.
 * Defaults to 15,000ms (configurable via DB_TIMEOUT_MS).
 */
export function getDbTimeoutMs(): number {
  const envVal = process.env.DB_TIMEOUT_MS;
  if (!envVal) return 15000;
  const parsed = parseInt(envVal, 10);
  return isNaN(parsed) || parsed <= 0 ? 15000 : parsed;
}

/**
 * Executes a database query with a timeout. If the database connection is hung or takes
 * longer than timeoutMs, falls back gracefully (on non-mainnet only) or rejects with a clean error.
 * On mainnet, fallbackVal is strictly ignored to prevent displaying mock data.
 */
export async function withDbTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs = getDbTimeoutMs(),
  fallbackVal?: T
): Promise<T> {
  const isMainnet = (process.env.NEXT_PUBLIC_NETWORK_MODE || process.env.NETWORK_MODE) === "mainnet";
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Database query timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([queryFn(), timeoutPromise]);
    if (timer) clearTimeout(timer);
    return result;
  } catch (err) {
    if (timer) clearTimeout(timer);
    // On mainnet mode, NEVER use fallbackVal!
    if (fallbackVal !== undefined && !isMainnet) {
      return fallbackVal;
    }
    throw err;
  }
}

