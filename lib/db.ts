/**
 * BizFlow Pilot V2 — Physical Database Separation & Scoped Access
 * 
 * Physical data separation between Arc Mainnet and Arc Testnet:
 * - Mainnet uses DATABASE_URL_MAINNET / DIRECT_URL_MAINNET (schema=v2_mainnet)
 * - Testnet uses DATABASE_URL_TESTNET / DIRECT_URL_TESTNET (schema=v2_testnet)
 * 
 * Exposes ONLY getDb(network). The old unscoped 'prisma' export is removed
 * so that any unscoped database access fails at compile time.
 */

import { PrismaClient } from "@prisma/client";
import { NetworkMode } from "./networks";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

if (typeof window === "undefined") {
  try {
    const v2Path = path.resolve(process.cwd(), ".env.v2.local");
    if (fs.existsSync(v2Path)) {
      dotenv.config({ path: v2Path, override: false });
    }
  } catch {
    // Non-fatal if fs not accessible
  }
}

const globalForDb = globalThis as unknown as {
  prismaMainnet?: PrismaClient;
  prismaTestnet?: PrismaClient;
};

/**
 * Startup guard verifying that both datasource URLs enforce strict schema separation:
 * - DATABASE_URL_MAINNET / DIRECT_URL_MAINNET must contain schema=v2_mainnet
 * - DATABASE_URL_TESTNET / DIRECT_URL_TESTNET must contain schema=v2_testnet
 * - Both URLs must not be identical
 */
export function assertValidDatabaseUrls(
  overrideMainnetUrl?: string,
  overrideTestnetUrl?: string
): void {
  // Test safety guard: ensure tests never run against a mainnet database
  assertTestDatabaseSafety();

  const isProduction = process.env.NODE_ENV === "production";
  const mainnetUrl =
    overrideMainnetUrl !== undefined
      ? overrideMainnetUrl
      : process.env.DIRECT_URL_MAINNET || process.env.DATABASE_URL_MAINNET || "";
  const testnetUrl =
    overrideTestnetUrl !== undefined
      ? overrideTestnetUrl
      : process.env.DIRECT_URL_TESTNET || process.env.DATABASE_URL_TESTNET || "";

  // In production or when explicit overrides/split variables are provided:
  if (isProduction || (mainnetUrl && testnetUrl)) {
    if (mainnetUrl && testnetUrl && mainnetUrl === testnetUrl) {
      throw new Error(
        "CRITICAL DATABASE CONFIGURATION ERROR: DATABASE_URL_MAINNET and DATABASE_URL_TESTNET cannot point to the exact same URL. They must target separate schemas (v2_mainnet vs v2_testnet). Refusing startup."
      );
    }
    if (mainnetUrl && !mainnetUrl.includes("schema=v2_mainnet")) {
      throw new Error(
        "CRITICAL DATABASE CONFIGURATION ERROR: DATABASE_URL_MAINNET must specify 'schema=v2_mainnet' to guarantee schema isolation. Refusing startup."
      );
    }
    if (testnetUrl && !testnetUrl.includes("schema=v2_testnet")) {
      throw new Error(
        "CRITICAL DATABASE CONFIGURATION ERROR: DATABASE_URL_TESTNET must specify 'schema=v2_testnet' to guarantee schema isolation. Refusing startup."
      );
    }
  }
}

/**
 * Backward compatibility alias for single-network schema validation.
 */
export function assertValidDatabaseSchema(
  overrideMode?: NetworkMode,
  overrideDbUrl?: string,
  overrideDirectUrl?: string
): void {
  const mode = overrideMode || "mainnet";
  const url = overrideDbUrl || (mode === "mainnet" ? process.env.DATABASE_URL_MAINNET : process.env.DATABASE_URL_TESTNET) || "";
  const expectedSchema = mode === "mainnet" ? "schema=v2_mainnet" : "schema=v2_testnet";
  if (!url.includes(expectedSchema)) {
    throw new Error(
      `CRITICAL DATABASE CONFIGURATION ERROR: DATABASE_URL_${mode.toUpperCase()} must specify '${expectedSchema}' to guarantee schema isolation. Refusing startup.`
    );
  }
}

/**
 * Test environment safety guard: ensures unit/integration tests never run against mainnet.
 * Immediately aborts execution if DATABASE_URL, DIRECT_URL, or any active test connection targets mainnet.
 */
export function assertTestDatabaseSafety(overrideUrl?: string): void {
  const isVitest = process.env.VITEST === "true" || process.env.NODE_ENV === "test";
  if (!isVitest && overrideUrl === undefined) return;

  // Enforce that tests run strictly against testnet through TEST_NETWORK
  if (isVitest && process.env.TEST_NETWORK && process.env.TEST_NETWORK !== "testnet") {
    throw new Error(
      `FATAL TEST SAFETY VIOLATION: TEST_NETWORK must be 'testnet', detected '${process.env.TEST_NETWORK}'. Tests must never target mainnet!`
    );
  }

  const urlsToCheck = [
    overrideUrl,
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    process.env.DATABASE_URL_TESTNET,
    process.env.DIRECT_URL_TESTNET,
  ].filter(Boolean) as string[];

  for (const rawUrl of urlsToCheck) {
    const url = rawUrl.toLowerCase();
    if (url.includes("schema=v2_mainnet") || url.includes("v2_mainnet") || url.includes("mainnet")) {
      throw new Error(
        "FATAL TEST SAFETY VIOLATION: Tests must run ONLY against testnet or dev databases, never mainnet! Detected mainnet database connection string."
      );
    }
  }
}

function optimizeDatasourceUrl(rawUrl: string): string {
  let url = rawUrl;
  if (!url.includes("sslmode=")) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}sslmode=require`;
  }
  if (!url.includes("connection_limit=")) {
    const separator = url.includes("?") ? "&" : "?";
    const timeoutSec = Math.max(30, Math.floor(getDbTimeoutMs() / 1000));
    url = `${url}${separator}connection_limit=1&pool_timeout=30&connect_timeout=${timeoutSec}`;
  }
  return url;
}

/**
 * Resolves the datasource URL for a specific network.
 */
export function getDatasourceUrl(network: NetworkMode): string {
  assertValidDatabaseUrls();

  if (network === "mainnet") {
    const url = process.env.DIRECT_URL_MAINNET || process.env.DATABASE_URL_MAINNET;
    if (url) return optimizeDatasourceUrl(url);

    // Development/fallback: if single DATABASE_URL has schema=v2_mainnet
    const fallback = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (fallback && fallback.includes("schema=v2_mainnet")) {
      return optimizeDatasourceUrl(fallback);
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL_MAINNET is required in production environment.");
    }
    return optimizeDatasourceUrl(fallback || "");
  }

  // testnet
  const url = process.env.DIRECT_URL_TESTNET || process.env.DATABASE_URL_TESTNET;
  if (url) return optimizeDatasourceUrl(url);

  // Development/fallback for local dev or tests
  const fallback = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (fallback) {
    return optimizeDatasourceUrl(fallback);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL_TESTNET is required in production environment.");
  }
  return "";
}

/**
 * Expose ONLY getDb(network).
 * Guarantees that callers explicitly declare the target network and target
 * the isolated database client (v2_mainnet vs v2_testnet).
 */
export function getDb(network: NetworkMode): PrismaClient {
  if (network === "mainnet") {
    if (!globalForDb.prismaMainnet) {
      const url = getDatasourceUrl("mainnet");
      globalForDb.prismaMainnet = new PrismaClient({
        datasources: { db: { url: url || undefined } },
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      });
    }
    return globalForDb.prismaMainnet;
  }

  if (network === "testnet") {
    if (!globalForDb.prismaTestnet) {
      const url = getDatasourceUrl("testnet");
      globalForDb.prismaTestnet = new PrismaClient({
        datasources: { db: { url: url || undefined } },
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      });
    }
    return globalForDb.prismaTestnet;
  }

  throw new Error(`Invalid network '${network}' passed to getDb. Expected 'mainnet' or 'testnet'.`);
}

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
 * longer than timeoutMs, falls back gracefully (on testnet only) or rejects with a clean error.
 * On mainnet, fallbackVal is strictly ignored to prevent displaying mock data.
 */
export async function withDbTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs = getDbTimeoutMs(),
  fallbackVal?: T,
  network?: NetworkMode
): Promise<T> {
  const isMainnet = network === "mainnet";
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
