import React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork } from "@/lib/networks";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { getServerSession, getSessionOrg } from "@/lib/auth/session";
import {
  InventoryDeskClient,
  SerializedItem,
  SerializedPO,
} from "@/components/inventory/InventoryDeskClient";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Inventory & POs | BizFlow Pilot V2",
  description: "Enterprise purchase orders, goods receipt notes, and verified inventory ledger.",
};

export default async function InventoryPage() {
  const cookieStore = cookies();
  const networkMode = getServerActiveNetwork(cookieStore.get("bizflow_network")?.value);
  const db = getDb(networkMode);
  const session = await getServerSession();
  let items: SerializedItem[] = [];
  let purchaseOrders: SerializedPO[] = [];
  let dbError: string | null = null;

  if (session) {
    try {
      const org = await getSessionOrg(session, networkMode);
      if (org) {
        const [rawItems, rawPOs] = await withDbTimeout(() =>
          Promise.all([
            db.item.findMany({
              where: { orgId: org.id },
              include: {
                stockMovements: { orderBy: { createdAt: "desc" }, take: 5 },
              },
              orderBy: { createdAt: "desc" },
            }),
            db.purchaseOrder.findMany({
              where: { orgId: org.id },
              include: {
                vendor: true,
                lines: { include: { item: true } },
                goodsReceipts: { include: { lines: { include: { item: true } } } },
              },
              orderBy: { createdAt: "desc" },
            }),
          ])
        );

        items = rawItems.map((item) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          currentStock: item.currentStock,
          unitPriceUsdc: formatUsdc(usdcAtomic(item.unitPriceUsdc)),
          stockMovements: item.stockMovements.map((sm) => ({
            id: sm.id,
            quantity: sm.quantity,
            type: sm.type,
            reference: sm.reference,
            createdAt: sm.createdAt.toISOString(),
          })),
        }));

        purchaseOrders = rawPOs.map((po) => ({
          id: po.id,
          poNumber: po.poNumber,
          status: po.status,
          totalUsdc: formatUsdc(usdcAtomic(po.totalUsdc)),
          orderDate: po.orderDate.toISOString(),
          vendor: {
            id: po.vendor.id,
            name: po.vendor.name,
            walletAddress: po.vendor.walletAddress,
          },
          lines: po.lines.map((l) => ({
            id: l.id,
            quantity: l.quantity,
            unitPriceUsdc: formatUsdc(usdcAtomic(l.unitPriceUsdc)),
            totalUsdc: formatUsdc(usdcAtomic(l.totalUsdc)),
            item: {
              id: l.item.id,
              name: l.item.name,
              sku: l.item.sku,
              unit: l.item.unit,
            },
          })),
          goodsReceipts: po.goodsReceipts.map((gr) => ({
            id: gr.id,
            grNumber: gr.grNumber,
            receivedDate: gr.receivedDate.toISOString(),
            receivedBy: gr.receivedBy,
            notes: gr.notes,
            lines: gr.lines.map((gl) => ({
              id: gl.id,
              quantity: gl.quantity,
              item: gl.item
                ? {
                    id: gl.item.id,
                    name: gl.item.name,
                    sku: gl.item.sku,
                  }
                : undefined,
            })),
          })),
        }));
      }
    } catch (err: any) {
      dbError = err.message || "Failed to load inventory data from database.";
    }
  }

  if (dbError) {
    return (
      <DatabaseErrorState
        title="Inventory Database Error"
        message="Could not load inventory and purchase order records from the database. Please verify connectivity and retry."
      />
    );
  }

  return <InventoryDeskClient items={items} purchaseOrders={purchaseOrders} />;
}
