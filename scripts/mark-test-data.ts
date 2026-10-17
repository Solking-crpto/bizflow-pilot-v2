/**
 * BizFlow Pilot V2 — Mark Test Data Script
 * 
 * Flags existing testnet organizations created by integration tests or builder wallets
 * with isTest = true so public metrics cleanly separate external usage from test activity.
 * 
 * SAFETY GUARDS:
 * - Testnet ONLY: Strictly verifies connection string contains 'schema=v2_testnet'.
 * - Aborts immediately if 'v2_mainnet' is detected anywhere.
 * - Prints all counts and target organizations first.
 * - Requires explicit '--yes' flag to write changes.
 * - DELETES NOTHING.
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { getBuilderWallets, isTestOrganization } from "../lib/builder-wallets";

// Load environment variables
if (fs.existsSync(".env.v2.local")) {
  dotenv.config({ path: ".env.v2.local", override: false });
}
if (fs.existsSync(".env")) {
  dotenv.config({ path: ".env", override: false });
}

async function main() {
  console.log("=== BizFlow Pilot V2 — Mark Test Data in Testnet ===");

  const args = process.argv.slice(2);
  const hasConfirmed = args.includes("--yes");

  // Safety Check 1: Enforce testnet URL
  const testnetUrl = process.env.DIRECT_URL_TESTNET || process.env.DATABASE_URL_TESTNET || process.env.DATABASE_URL || "";
  if (!testnetUrl) {
    console.error("FATAL ERROR: Testnet database connection string is not configured.");
    process.exit(1);
  }

  // Safety Check 2: Strict schema guard
  if (!testnetUrl.includes("schema=v2_testnet")) {
    console.error(
      "FATAL SAFETY VIOLATION: Target URL does NOT contain 'schema=v2_testnet'. Aborting to protect database integrity."
    );
    process.exit(1);
  }

  // Safety Check 3: Absolute refusal if mainnet reference is detected
  if (
    testnetUrl.toLowerCase().includes("v2_mainnet") ||
    testnetUrl.toLowerCase().includes("schema=v2_mainnet")
  ) {
    console.error(
      "FATAL CRITICAL VIOLATION: Detected 'v2_mainnet' in connection string! Refusing to run."
    );
    process.exit(1);
  }

  const separator = testnetUrl.includes("?") ? "&" : "?";
  const connUrl = testnetUrl.includes("connection_limit=")
    ? testnetUrl
    : `${testnetUrl}${separator}connection_limit=1`;

  const prisma = new PrismaClient({
    datasources: { db: { url: connUrl } },
  });

  try {
    console.log("Connected to database schema: v2_testnet (Verified)");

    const builderWallets = getBuilderWallets();
    console.log(`Configured builder wallets count: ${builderWallets.size}`);
    if (builderWallets.size > 0) {
      console.log(`Builder wallets: ${Array.from(builderWallets).join(", ")}`);
    }

    // Retrieve all organizations in v2_testnet
    const allOrgs = await prisma.organization.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        walletAddress: true,
        isTest: true,
        createdAt: true,
      },
    });

    console.log(`\nTotal organizations in v2_testnet: ${allOrgs.length}`);

    const orgsToFlag: typeof allOrgs = [];
    const alreadyFlagged: typeof allOrgs = [];
    const externalOrgs: typeof allOrgs = [];

    for (const org of allOrgs) {
      const nameUpper = org.name.toUpperCase();
      const isTestName =
        nameUpper.startsWith("TEST-") ||
        nameUpper.startsWith("TEST ") ||
        nameUpper.includes("INTEGRATION TEST") ||
        nameUpper.includes("E2E") ||
        nameUpper.includes("PLAYWRIGHT") ||
        nameUpper.includes("VITEST");

      const isBuilderWallet = org.walletAddress
        ? builderWallets.has(org.walletAddress.toLowerCase())
        : false;

      if (org.isTest) {
        alreadyFlagged.push(org);
      } else if (isTestName || isBuilderWallet) {
        orgsToFlag.push(org);
      } else {
        externalOrgs.push(org);
      }
    }

    console.log(`\n--- Organization Breakdown ---`);
    console.log(`  Already flagged as isTest: ${alreadyFlagged.length}`);
    console.log(`  Identified to flag as isTest: ${orgsToFlag.length}`);
    console.log(`  External (real community / pilot) organizations: ${externalOrgs.length}`);

    if (orgsToFlag.length > 0) {
      console.log(`\nOrganizations to be marked as test data:`);
      for (const org of orgsToFlag) {
        console.log(`  - [${org.id}] "${org.name}" (wallet: ${org.walletAddress || "none"})`);
      }
    }

    if (!hasConfirmed) {
      console.log("\n[DRY RUN]: No changes written to the database.");
      console.log("To apply changes, re-run with '--yes':");
      console.log("  npx tsx scripts/mark-test-data.ts --yes");
      process.exit(0);
    }

    if (orgsToFlag.length === 0) {
      console.log("\nNo new organizations need to be flagged. All test organizations are already marked.");
      process.exit(0);
    }

    // Update organizations in v2_testnet with isTest = true
    const targetIds = orgsToFlag.map((o) => o.id);
    const updateResult = await prisma.organization.updateMany({
      where: { id: { in: targetIds } },
      data: { isTest: true },
    });

    console.log(`\n✔ Successfully flagged ${updateResult.count} organizations as isTest = true in v2_testnet.`);
    console.log("✔ Zero rows deleted. Database integrity fully preserved.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FATAL SCRIPT ERROR:", err);
  process.exit(1);
});
