import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { safeDbErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

const DecisionSchema = z.object({
  action: z.enum(["approve", "reject", "request_more_evidence"]),
  notes: z.string().optional(),
});

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

    const json = await req.json();
    const parsed = DecisionSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid action", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { action, notes } = parsed.data;

    const deliveryRequest = await withDbTimeout(() =>
      db.deliveryRequest.findFirst({
        where: { id: params.id, orgId: org.id },
      })
    );

    if (!deliveryRequest) {
      return NextResponse.json({ error: "Delivery request not found" }, { status: 404 });
    }

    let newStatus = "pending";
    if (action === "approve") newStatus = "approved";
    else if (action === "reject") newStatus = "rejected";
    else if (action === "request_more_evidence") newStatus = "more_evidence_required";

    const updated = await withDbTimeout(() =>
      db.deliveryRequest.update({
        where: { id: params.id },
        data: {
          status: newStatus,
        },
      })
    );

    // If approved and linked to invoice, update invoice status if appropriate
    if (action === "approve" && deliveryRequest.invoiceId) {
      const invoice = await db.invoice.findUnique({
        where: { id: deliveryRequest.invoiceId },
      });
      if (invoice && invoice.status === "pending_verification") {
        await db.invoice.update({
          where: { id: invoice.id },
          data: { status: "verified" },
        });
      }
    }

    return NextResponse.json({
      success: true,
      requestId: updated.id,
      status: updated.status,
      notes: notes || null,
    });
  } catch (err: any) {
    return safeDbErrorResponse(err, `POST /api/delivery-proof/${params.id}/decision`);
  }
}
