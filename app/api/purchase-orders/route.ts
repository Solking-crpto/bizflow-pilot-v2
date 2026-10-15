import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbTimeout } from "@/lib/db";
import { parseUsdc, formatUsdc, usdcAtomic } from "@/lib/money";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const CreatePOLineSchema = z.object({
  description: z.string().min(1, "Item description required"),
  quantity: z.number().int().positive("Quantity must be greater than 0"),
  unitPriceUsdc: z.string().min(1, "Unit price in USDC is required"),
});

const CreatePOSchema = z.object({
  poNumber: z.string().min(3, "PO Number must be at least 3 characters"),
  vendorId: z.string().min(1, "Vendor selection is required"),
  orderDate: z.string().optional(),
  lines: z.array(CreatePOLineSchema).min(1, "At least one line item is required"),
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

    const pos = await withDbTimeout(() =>
      prisma.purchaseOrder.findMany({
        where: { orgId: org.id },
        include: {
          vendor: true,
          lines: {
            include: { item: true },
          },
          goodsReceipts: {
            include: {
              lines: { include: { item: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    );

    return NextResponse.json({
      success: true,
      purchaseOrders: pos.map((po) => ({
        id: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendor.name,
        vendorId: po.vendorId,
        status: po.status,
        totalUsdc: formatUsdc(usdcAtomic(po.totalUsdc)),
        orderDate: po.orderDate.toISOString(),
        lines: po.lines.map((l) => ({
          id: l.id,
          itemName: l.item.name,
          sku: l.item.sku,
          quantity: l.quantity,
          unitPriceUsdc: formatUsdc(usdcAtomic(l.unitPriceUsdc)),
          totalUsdc: formatUsdc(usdcAtomic(l.totalUsdc)),
        })),
        goodsReceiptsCount: po.goodsReceipts.length,
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
    const parsed = CreatePOSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { poNumber, vendorId, orderDate, lines } = parsed.data;

    // Validate vendor belongs to org (IDOR check)
    const vendor = await withDbTimeout(() =>
      prisma.vendor.findUnique({
        where: { id: vendorId },
      })
    );

    if (!vendor || vendor.orgId !== org.id) {
      return NextResponse.json(
        { error: "Selected supplier not found or access forbidden" },
        { status: 403 }
      );
    }

    // Check duplicate PO number in org
    const existingPO = await withDbTimeout(() =>
      prisma.purchaseOrder.findFirst({
        where: { orgId: org.id, poNumber: poNumber.trim().toUpperCase() },
      })
    );

    if (existingPO) {
      return NextResponse.json(
        { error: `Purchase Order ${poNumber} already exists in your organization.` },
        { status: 400 }
      );
    }

    // Process line items and compute total
    let totalPoAtomic = 0n;
    const poLinesToCreate: Array<{
      itemId: string;
      quantity: number;
      unitPriceUsdc: bigint;
      totalUsdc: bigint;
    }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const unitPriceAtomic = parseUsdc(line.unitPriceUsdc);
      const lineTotalAtomic = unitPriceAtomic * BigInt(line.quantity);
      totalPoAtomic += lineTotalAtomic;

      const cleanSku = `SKU-${org.id.slice(0, 4)}-${poNumber.replace(/[^A-Za-z0-9]/g, "")}-${i + 1}`;

      // Find or create item
      const item = await withDbTimeout(() =>
        prisma.item.upsert({
          where: { sku: cleanSku },
          update: { name: line.description, unitPriceUsdc: unitPriceAtomic },
          create: {
            orgId: org.id,
            sku: cleanSku,
            name: line.description,
            unitPriceUsdc: unitPriceAtomic,
            currentStock: 0,
          },
        })
      );

      poLinesToCreate.push({
        itemId: item.id,
        quantity: line.quantity,
        unitPriceUsdc: unitPriceAtomic,
        totalUsdc: lineTotalAtomic,
      });
    }

    const po = await withDbTimeout(() =>
      prisma.purchaseOrder.create({
        data: {
          orgId: org.id,
          poNumber: poNumber.trim().toUpperCase(),
          vendorId: vendor.id,
          totalUsdc: totalPoAtomic,
          orderDate: orderDate ? new Date(orderDate) : new Date(),
          status: "approved",
          lines: {
            create: poLinesToCreate,
          },
        },
        include: {
          vendor: true,
          lines: { include: { item: true } },
        },
      })
    );

    return NextResponse.json({
      success: true,
      purchaseOrder: {
        id: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendor.name,
        totalUsdc: formatUsdc(usdcAtomic(po.totalUsdc)),
        orderDate: po.orderDate.toISOString(),
        status: po.status,
        linesCount: po.lines.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
