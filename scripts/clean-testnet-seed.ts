/**
 * BizFlow Pilot V2 — Clean Testnet Seed Script
 * 
 * Safe cleanup utility to purge leftover seeded demo organizations from schema v2_testnet.
 * 
 * SAFETY GUARDS:
 * - Refuses execution unless target network is strictly 'testnet'.
 * - Refuses execution unless database connection string strictly contains 'schema=v2_testnet'.
 * - Immediately aborts if any connection string mentions 'v2_mainnet'.
 * - Requires explicit '--yes' flag to perform any deletion; otherwise performs dry-run count.
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Load testnet environment variables
if (fs.existsSync(".env.v2.local")) {
  dotenv.config({ path: ".env.v2.local", override: false });
}

async function main() {
  console.log("=== BizFlow Pilot V2 — Testnet Seed Cleanup ===");

  const args = process.argv.slice(2);
  const hasConfirmed = args.includes("--yes");

  // Safety Check 1: Enforce testnet URL
  const testnetUrl = process.env.DIRECT_URL_TESTNET || process.env.DATABASE_URL_TESTNET || "";
  if (!testnetUrl) {
    console.error("FATAL ERROR: DATABASE_URL_TESTNET is not configured.");
    process.exit(1);
  }

  // Safety Check 2: Strict schema guard
  if (!testnetUrl.includes("schema=v2_testnet")) {
    console.error(
      "FATAL SAFETY VIOLATION: Target URL does NOT contain 'schema=v2_testnet'. Aborting to protect database integrity."
    );
    process.exit(1);
  }

  // Safety Check 3: Absolute refusal if any mainnet reference is detected
  if (
    testnetUrl.toLowerCase().includes("v2_mainnet") ||
    testnetUrl.toLowerCase().includes("schema=v2_mainnet")
  ) {
    console.error(
      "FATAL CRITICAL VIOLATION: Detected 'v2_mainnet' in connection string! Refusing to run."
    );
    process.exit(1);
  }

  // Optimize connection for script
  const separator = testnetUrl.includes("?") ? "&" : "?";
  const connUrl = testnetUrl.includes("connection_limit=")
    ? testnetUrl
    : `${testnetUrl}${separator}connection_limit=1`;

  const prisma = new PrismaClient({
    datasources: { db: { url: connUrl } },
  });

  try {
    console.log("Connected to database schema: v2_testnet (Verified)");

    // Target seeded organizations by known demo names or demo slugs
    const seededNames = [
      "BuildPro",
      "BuildPro Infrastructure Ltd",
      "Public Beta Org",
      "Default Org",
      "Dangote",
      "Northgate",
    ];

    const seededOrgs = await prisma.organization.findMany({
      where: {
        OR: [
          { name: { in: seededNames } },
          { name: { contains: "BuildPro", mode: "insensitive" } },
          { name: { contains: "Default Org", mode: "insensitive" } },
          { name: { contains: "Public Beta", mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, createdAt: true },
    });

    console.log(`Found ${seededOrgs.length} seeded organizations in v2_testnet:`);
    seededOrgs.forEach((o) => {
      console.log(`  - [${o.id}] "${o.name}" (created: ${o.createdAt.toISOString()})`);
    });

    if (seededOrgs.length === 0) {
      console.log("\nNo leftover seeded organizations found in v2_testnet. Schema is clean!");
      return;
    }

    const orgIds = seededOrgs.map((o) => o.id);

    // Count cascade entities
    const [
      poCount,
      grCount,
      invCount,
      pmtCount,
      vendorCount,
      auditCount,
      decisionCount,
      settingCount,
    ] = await Promise.all([
      prisma.purchaseOrder.count({ where: { orgId: { in: orgIds } } }),
      prisma.goodsReceipt.count({ where: { orgId: { in: orgIds } } }),
      prisma.invoice.count({ where: { orgId: { in: orgIds } } }),
      prisma.payment.count({ where: { orgId: { in: orgIds } } }),
      prisma.vendor.count({ where: { orgId: { in: orgIds } } }),
      prisma.auditEvent.count({ where: { orgId: { in: orgIds } } }),
      prisma.agentDecision.count({ where: { orgId: { in: orgIds } } }),
      prisma.setting.count({ where: { orgId: { in: orgIds } } }),
    ]);

    console.log("\nAssociated records to be purged:");
    console.log(`  - Purchase Orders: ${poCount}`);
    console.log(`  - Goods Receipts:  ${grCount}`);
    console.log(`  - Invoices:        ${invCount}`);
    console.log(`  - Payments:        ${pmtCount}`);
    console.log(`  - Vendors:         ${vendorCount}`);
    console.log(`  - Audit Events:    ${auditCount}`);
    console.log(`  - Agent Decisions: ${decisionCount}`);
    console.log(`  - Settings:        ${settingCount}`);

    if (!hasConfirmed) {
      console.log("\n[DRY RUN COMPLETE] No records were deleted.");
      console.log("To execute the deletion, re-run this command with the --yes flag:");
      console.log("  npx tsx scripts/clean-testnet-seed.ts --yes");
      return;
    }

    console.log("\nExecuting deletion with --yes...");

    // Delete in cascade order
    await prisma.gRLine.deleteMany({
      where: { goodsReceipt: { orgId: { in: orgIds } } },
    });
    await prisma.goodsReceipt.deleteMany({
      where: { orgId: { in: orgIds } },
    });
    await prisma.pOLine.deleteMany({
      where: { purchaseOrder: { orgId: { in: orgIds } } },
    });
    await prisma.purchaseOrder.deleteMany({
      where: { orgId: { in: orgIds } },
    });
    await prisma.paymentIntent.deleteMany({
      where: { orgId: { in: orgIds } },
    });
    await prisma.payment.deleteMany({
      where: { orgId: { in: orgIds } },
    });
    await prisma.agentDecision.deleteMany({
      where: { orgId: { in: orgIds } },
    });
    await prisma.invoice.deleteMany({
      where: { orgId: { in: orgIds } },
    });
    await prisma.stockMovement.deleteMany({
      where: { item: { orgId: { in: orgIds } } },
    });
    await prisma.item.deleteMany({
      where: { orgId: { in: orgIds } },
    });
    await prisma.vendor.deleteMany({
      where: { orgId: { in: orgIds } },
    });
    await prisma.auditEvent.deleteMany({
      where: { orgId: { in: orgIds } },
    });
    await prisma.setting.deleteMany({
      where: { orgId: { in: orgIds } },
    });
    await prisma.member.deleteMany({
      where: { orgId: { in: orgIds } },
    });

    const deletedOrgs = await prisma.organization.deleteMany({
      where: { id: { in: orgIds } },
    });

    console.log(`\nSuccessfully deleted ${deletedOrgs.count} seeded organizations and all associated records.`);
  } catch (err: any) {
    console.error("Cleanup error:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
