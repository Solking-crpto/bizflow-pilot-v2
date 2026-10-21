import { NextRequest, NextResponse } from "next/server";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { safeDbErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(
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

    const deliveryRequest = await withDbTimeout(() =>
      db.deliveryRequest.findFirst({
        where: { id: params.id, orgId: org.id },
      })
    );

    if (!deliveryRequest) {
      return NextResponse.json({ error: "Delivery request not found" }, { status: 404 });
    }

    const updated = await withDbTimeout(() =>
      db.deliveryRequest.update({
        where: { id: params.id },
        data: {
          status: "revoked",
          revokedAt: new Date(),
        },
      })
    );

    return NextResponse.json({
      success: true,
      requestId: updated.id,
      status: "revoked",
      revokedAt: updated.revokedAt,
    });
  } catch (err: any) {
    return safeDbErrorResponse(err, `POST /api/delivery-proof/${params.id}/revoke`);
  }
}
