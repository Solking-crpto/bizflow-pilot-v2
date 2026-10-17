/**
 * BizFlow Pilot V2 — Builder Wallets & Test Activity Isolation
 * 
 * Separates external production/community activity from builder testing & integration runs:
 * - Reads BUILDER_WALLETS environment variable (comma-separated EVM addresses; defaults to ADMIN_WALLET_ADDRESS).
 * - Identifies test organizations by:
 *   1. isTest = true flag
 *   2. Organization name prefix "TEST-" (case-insensitive)
 *   3. Organization walletAddress matching any builder wallet
 */

export function getBuilderWallets(): Set<string> {
  const raw = process.env.BUILDER_WALLETS || process.env.ADMIN_WALLET_ADDRESS || "";
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim().toLowerCase();
    if (trimmed && /^0x[a-f0-9]{40}$/i.test(trimmed)) {
      set.add(trimmed);
    }
  }
  return set;
}

export function isTestOrganization(org: {
  isTest?: boolean | null;
  name?: string | null;
  walletAddress?: string | null;
}): boolean {
  if (org.isTest) return true;
  if (org.name) {
    const nameUpper = org.name.trim().toUpperCase();
    if (
      nameUpper.startsWith("TEST-") ||
      nameUpper.startsWith("TEST ") ||
      nameUpper.includes("INTEGRATION TEST") ||
      nameUpper.includes("E2E") ||
      nameUpper.includes("PLAYWRIGHT") ||
      nameUpper.includes("VITEST")
    ) {
      return true;
    }
  }
  if (org.walletAddress) {
    const normalized = org.walletAddress.trim().toLowerCase();
    if (getBuilderWallets().has(normalized)) return true;
  }
  return false;
}

export function getTestOrgWhereClause() {
  const builderWallets = Array.from(getBuilderWallets());
  return {
    OR: [
      { isTest: true },
      { name: { startsWith: "TEST-", mode: "insensitive" as const } },
      ...(builderWallets.length > 0
        ? [{ walletAddress: { in: builderWallets, mode: "insensitive" as const } }]
        : []),
    ],
  };
}

export function getExternalOrgWhereClause() {
  const builderWallets = Array.from(getBuilderWallets());
  return {
    AND: [
      { isTest: false },
      { NOT: { name: { startsWith: "TEST-", mode: "insensitive" as const } } },
      ...(builderWallets.length > 0
        ? [{ NOT: { walletAddress: { in: builderWallets, mode: "insensitive" as const } } }]
        : []),
    ],
  };
}
