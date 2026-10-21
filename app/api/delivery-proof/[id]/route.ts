import { NextRequest, NextResponse } from "next/server";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { safeDbErrorResponse } from "@/lib/errors";
import { getStorageProvider, getEvidenceBucket } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const netCtx = validateApiNetwork(req);
    if (!netCtx.success) return netCtx.response;
    const { network, db } = netCtx;

    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getSessionOrg(session, network);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const deliveryRequest = await withDbTimeout(
      () =>
        db.deliveryRequest.findFirst({
          where: { id: params.id, orgId: org.id },
          include: {
            purchaseOrder: {
              include: {
                vendor: true,
                lines: { include: { item: true } },
              },
            },
            invoice: {
              include: {
                vendor: true,
              },
            },
            submission: true,
            evidenceFiles: true,
            reports: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        }),
      30000
    );

    if (!deliveryRequest) {
      return NextResponse.json({ error: "Delivery request not found" }, { status: 404 });
    }

    // Attach signed download URLs to evidence files
    const storage = getStorageProvider();
    const bucket = getEvidenceBucket(network);

    const enrichedFiles = await Promise.all(
      deliveryRequest.evidenceFiles.map(async (file) => {
        try {
          const download = await storage.createSignedDownloadUrl(bucket, file.storagePath, 3600);
          return {
            ...file,
            downloadUrl: download.downloadUrl,
          };
        } catch {
          return {
            ...file,
            downloadUrl: null,
          };
        }
      })
    );

    const safeDeliveryRequest = JSON.parse(
      JSON.stringify(
        {
          ...deliveryRequest,
          evidenceFiles: enrichedFiles,
        },
        (_, v) => (typeof v === "bigint" ? v.toString() : v)
      )
    );

    return NextResponse.json({
      success: true,
      deliveryRequest: safeDeliveryRequest,
    });
  } catch (err: any) {
    return safeDbErrorResponse(err, `GET /api/delivery-proof/${params.id}`);
  }
}
