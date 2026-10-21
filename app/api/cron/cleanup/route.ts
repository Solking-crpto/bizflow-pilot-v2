import { NextRequest, NextResponse } from "next/server";
import { getDb, withDbTimeout } from "@/lib/db";
import { getStorageProvider, getEvidenceBucket } from "@/lib/storage";
import { NetworkMode } from "@/lib/networks";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * Validates CRON_SECRET using constant-time comparison.
 * Requires an exact match against process.env.CRON_SECRET.
 */
function verifyCronAuth(req: NextRequest): { authorized: boolean; error?: string } {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return { authorized: false, error: "Unauthorized: CRON_SECRET is not configured on the server." };
  }

  const authHeader = req.headers.get("authorization") || req.headers.get("x-cron-secret") || "";
  let token = "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else {
    token = authHeader.trim();
  }

  if (!token) {
    return { authorized: false, error: "Unauthorized: Missing authorization header." };
  }

  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(cronSecret);

  if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
    return { authorized: false, error: "Unauthorized: Invalid CRON_SECRET bearer token." };
  }

  return { authorized: true };
}

async function runCleanup(req: NextRequest) {
  const auth = verifyCronAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const retentionDays = parseInt(process.env.EVIDENCE_RETENTION_DAYS || "90", 10);
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Allow targeting specific network via query param ?network=testnet|mainnet, else clean both
  const url = new URL(req.url);
  const targetNetParam = url.searchParams.get("network") as NetworkMode | null;
  const networksToClean: NetworkMode[] = targetNetParam
    ? [targetNetParam]
    : ["testnet", "mainnet"];

  const storage = getStorageProvider();
  let totalPruned = 0;
  const details: Record<string, number> = {};

  for (const network of networksToClean) {
    const db = getDb(network);
    const bucket = getEvidenceBucket(network);

    try {
      // Find files eligible for deletion (past deleteAfter date OR created older than retention period)
      const expiredFiles = await withDbTimeout(
        () =>
          db.evidenceFile.findMany({
            where: {
              OR: [
                { deleteAfter: { lte: now } },
                { createdAt: { lte: cutoffDate } },
              ],
            },
            take: 500, // Batch limit
          }),
        30000
      );

      let networkPruned = 0;

      for (const file of expiredFiles) {
        try {
          // 1. Delete physical object from storage
          await storage.deleteObject(bucket, file.storagePath);
        } catch (storageErr) {
          // Non-fatal if file was already removed from bucket
          console.warn(`[CLEANUP] Could not remove storage file '${file.storagePath}':`, storageErr);
        }

        // 2. Remove EvidenceFile row from database while preserving DeliveryRequest, Submission & Reports
        await withDbTimeout(
          () =>
            db.evidenceFile.delete({
              where: { id: file.id },
            }),
          15000
        );

        networkPruned++;
      }

      totalPruned += networkPruned;
      details[network] = networkPruned;
    } catch (err: any) {
      console.error(`[CLEANUP] Error during cleanup on network ${network}:`, err);
      details[network] = 0;
    }
  }

  return NextResponse.json({
    success: true,
    totalPruned,
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
    details,
  });
}

export async function GET(req: NextRequest) {
  return runCleanup(req);
}

export async function POST(req: NextRequest) {
  return runCleanup(req);
}
