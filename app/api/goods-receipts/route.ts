import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbTimeout } from "@/lib/db";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";

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
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getSessionOrg(session);
    if (!org) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const grs = await withDbTimeout(() =>
      prisma.goodsReceipt.findMany({
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getSessionOrg(session);
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

    // Verify PO belongs to this organization (IDOR check)
    const po = await withDbTimeout(() =>
      prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { lines: true },
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
      prisma.goodsReceipt.findFirst({
        where: { orgId: org.id, grNumber: grNumber.trim().toUpperCase() },
      })
    );

    if (existingGR) {
      return NextResponse.json(
        { error: `Goods Receipt ${grNumber} already exists in your organization.` },
        { status: 400 }
      );
    }

    // Create Goods Receipt
    const gr = await withDbTimeout(() =>
      prisma.goodsReceipt.create({
        data: {
          orgId: org.id,
          grNumber: grNumber.trim().toUpperCase(),
          purchaseOrderId: po.id,
          receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
          receivedBy: receivedBy.trim(),
          notes: notes ? notes.trim() : null,
          lines: {
            create: lines.map((l) => ({
              itemId: l.itemId,
              quantity: l.quantity,
            })),
          },
        },
        include: {
          lines: { include: { item: true } },
        },
      })
    );

    // Update stock counts
    for (const line of lines) {
      await withDbTimeout(() =>
        prisma.item.update({
          where: { id: line.itemId },
          data: {
            currentStock: { increment: line.quantity },
          },
        })
      );

      await withDbTimeout(() =>
        prisma.stockMovement.create({
          data: {
            itemId: line.itemId,
            quantity: line.quantity,
            type: "in",
            reference: gr.grNumber,
          },
        })
      );
    }

    return NextResponse.json({
      success: true,
      goodsReceipt: {
        id: gr.id,
        grNumber: gr.grNumber,
        poNumber: po.poNumber,
        receivedBy: gr.receivedBy,
        linesCount: gr.lines.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
