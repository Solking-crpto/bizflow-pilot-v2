import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { safeDbErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

const CreateGRLineSchema = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  quantity: z.number().int().positive("Received quantity must be positive"),
});

const CreateGRSchema = z.object({
  grNumber: z.string().min(3, "Goods Receipt number required"),
  purchaseOrderId: z.string().min(1, "Purchase Order reference is required"),
  receivedDate: z.string().optional(),
  receivedBy: z.string().optional().default("Warehouse Agent"),
  notes: z.string().optional(),
  lines: z.array(CreateGRLineSchema).min(1, "At least one received item line is required"),
});

export async function GET(req: NextRequest) {
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
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const grs = await withDbTimeout(() =>
      db.goodsReceipt.findMany({
        where: { orgId: org.id },
        include: {
          purchaseOrder: true,
          lines: {
            include: { item: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    );

    return NextResponse.json({
      success: true,
      network,
      goodsReceipts: grs.map((gr) => ({
        id: gr.id,
        grNumber: gr.grNumber,
        poNumber: gr.purchaseOrder.poNumber,
        purchaseOrderId: gr.purchaseOrderId,
        receivedDate: gr.receivedDate.toISOString(),
        receivedBy: gr.receivedBy,
        notes: gr.notes,
        lines: gr.lines.map((l) => ({
          itemId: l.itemId,
          itemName: l.item.name,
          sku: l.item.sku,
          quantity: l.quantity,
        })),
      })),
    });
  } catch (error: any) {
    return safeDbErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
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
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = CreateGRSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { grNumber, purchaseOrderId, receivedDate, receivedBy, notes, lines } = parsed.data;

    // Verify PO belongs to this organization (IDOR check) and include lines with items
    const po = await withDbTimeout(() =>
      db.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: {
          lines: {
            include: { item: true },
          },
        },
      })
    );

    if (!po || po.orgId !== org.id) {
      return NextResponse.json(
        { error: "Referenced Purchase Order not found or access forbidden" },
        { status: 403 }
      );
    }

    // Check duplicate GR number
    const existingGR = await withDbTimeout(() =>
      db.goodsReceipt.findFirst({
        where: { orgId: org.id, grNumber: grNumber.trim().toUpperCase() },
      })
    );

    if (existingGR) {
      return NextResponse.json(
        { error: `Goods Receipt ${grNumber} already exists in your organization.` },
        { status: 400 }
      );
    }

    // Validate that each GR line matches a PO line of the same org before writing
    const poLineByItemId = new Map(po.lines.map((pl) => [pl.itemId, pl]));
    const poLineById = new Map(po.lines.map((pl) => [pl.id, pl]));

    const verifiedLines: Array<{ itemId: string; quantity: number }> = [];

    for (const submittedLine of lines) {
      // Find matching PO line either by itemId or by poLine.id
      const matchedPoLine =
        poLineByItemId.get(submittedLine.itemId) || poLineById.get(submittedLine.itemId);

      if (!matchedPoLine) {
        return NextResponse.json(
          {
            error: `Could not save: line item '${submittedLine.itemId}' does not match any line item on Purchase Order ${po.poNumber}.`,
          },
          { status: 400 }
        );
      }

      // Ensure the referenced item exists and belongs strictly to this organization
      const realItem = await withDbTimeout(() =>
        db.item.findFirst({
          where: { id: matchedPoLine.itemId, orgId: org.id },
        })
      );

      if (!realItem) {
        return NextResponse.json(
          {
            error: `Could not save: the item record for '${matchedPoLine.item?.name || matchedPoLine.itemId}' was not found in your organization.`,
          },
          { status: 400 }
        );
      }

      verifiedLines.push({
        itemId: realItem.id,
        quantity: submittedLine.quantity,
      });
    }

    // Create Goods Receipt with verified real Item IDs
    const gr = await withDbTimeout(() =>
      db.goodsReceipt.create({
        data: {
          orgId: org.id,
          grNumber: grNumber.trim().toUpperCase(),
          purchaseOrderId: po.id,
          receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
          receivedBy: receivedBy.trim(),
          notes: notes ? notes.trim() : null,
          lines: {
            create: verifiedLines.map((vl) => ({
              itemId: vl.itemId,
              quantity: vl.quantity,
            })),
          },
        },
        include: {
          lines: { include: { item: true } },
        },
      })
    );

    // Update stock counts and record physical stock movements
    for (const vl of verifiedLines) {
      await withDbTimeout(() =>
        db.item.update({
          where: { id: vl.itemId },
          data: {
            currentStock: { increment: vl.quantity },
          },
        })
      );

      await withDbTimeout(() =>
        db.stockMovement.create({
          data: {
            itemId: vl.itemId,
            quantity: vl.quantity,
            type: "in",
            reference: gr.grNumber,
          },
        })
      );
    }

    return NextResponse.json({
      success: true,
      network,
      goodsReceipt: {
        id: gr.id,
        grNumber: gr.grNumber,
        poNumber: po.poNumber,
        receivedBy: gr.receivedBy,
        linesCount: gr.lines.length,
        lines: gr.lines.map((l) => ({
          id: l.id,
          itemId: l.itemId,
          itemName: l.item.name,
          sku: l.item.sku,
          quantity: l.quantity,
        })),
      },
    });
  } catch (error: any) {
    return safeDbErrorResponse(error);
  }
}
