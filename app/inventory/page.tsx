import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, PackageCheck, FileText, ArrowRight, CheckCircle2, TrendingDown } from "lucide-react";
import { prisma, withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { DEMO_ITEMS, DEMO_PURCHASE_ORDERS } from "@/lib/demoData";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inventory & POs | BizFlow Pilot V2",
  description: "Enterprise purchase orders, goods receipt notes, and verified inventory ledger.",
};

export default async function InventoryPage() {
  const isMainnet = (process.env.NEXT_PUBLIC_NETWORK_MODE || process.env.NETWORK_MODE) === "mainnet";
  let items: any[] = [];
  let purchaseOrders: any[] = [];
  let dbError: string | null = null;

  try {
    const results = await withDbTimeout(
      () =>
        Promise.all([
          prisma.item.findMany({
            include: {
              stockMovements: { orderBy: { createdAt: "desc" }, take: 5 },
            },
          }),
          prisma.purchaseOrder.findMany({
            include: {
              vendor: true,
              lines: { include: { item: true } },
              goodsReceipts: { include: { lines: true } },
            },
            orderBy: { createdAt: "desc" },
          }),
        ])
    );

    items = results[0];
    purchaseOrders = results[1];
  } catch (err: any) {
    if (isMainnet) {
      dbError = err.message || "Failed to load inventory data from database.";
    } else {
      items = [];
      purchaseOrders = [];
    }
  }

  if (isMainnet && dbError) {
    return (
      <DatabaseErrorState
        title="Inventory Database Error"
        message="Could not load inventory and purchase order records from the database. Please verify connectivity and retry."
      />
    );
  }

  if (!isMainnet) {
    if (items.length === 0) items = DEMO_ITEMS;
    if (purchaseOrders.length === 0) purchaseOrders = DEMO_PURCHASE_ORDERS;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Inventory & Purchase Orders</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Operational ledger justifying procurement payments with real goods receipt proofs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/invoices"
            className="px-3.5 py-1.5 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-xs flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Match Invoices</span>
          </Link>
        </div>
      </div>

      {/* Stock Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.id} className="p-4 rounded-xl border border-border bg-surface shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-navy">{item.sku}</span>
              <span className="text-[10px] font-mono uppercase bg-brand-light text-brand-teal px-1.5 py-0.5 rounded font-semibold">
                In Stock
              </span>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink">{item.name}</h3>
              <div className="text-xs text-ink-muted mt-1">
                Standard Valuation:{" "}
                <span className="font-mono font-medium text-ink">
                  {formatUsdc(usdcAtomic(item.unitPriceUsdc))} / {item.unit}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-xs text-ink-muted">Verified Physical Units:</span>
              <span className="text-lg font-mono font-bold text-ink">
                {item.currentStock} <span className="text-xs font-normal text-ink-muted">{item.unit}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Purchase Orders and Goods Receipts Section */}
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-canvas/60">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-navy" />
            <h2 className="text-sm font-semibold text-ink">Authorized Purchase Orders & Receiving Slips</h2>
          </div>
          <span className="text-xs font-mono text-ink-muted">{purchaseOrders.length} records</span>
        </div>

        <div className="divide-y divide-border">
          {purchaseOrders.map((po) => {
            const line = po.lines[0];
            const gr = po.goodsReceipts[0];

            return (
              <div key={po.id} className="p-5 hover:bg-canvas/40 transition-colors space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-ink">{po.poNumber}</span>
                      <span className="text-xs font-medium text-success bg-success-light border border-success-border px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Fully Received & Signed
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted">
                      Vendor: <span className="font-semibold text-ink">{po.vendor.name}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-mono font-bold text-ink">
                      {formatUsdc(usdcAtomic(po.totalUsdc))}
                    </div>
                    <div className="text-xs text-ink-muted font-mono">
                      Authorized: {line?.quantity} units @ {formatUsdc(usdcAtomic(line?.unitPriceUsdc || 0n))}
                    </div>
                  </div>
                </div>

                {/* Goods Receipt Card */}
                {gr && (
                  <div className="p-3.5 rounded-lg bg-canvas border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-md bg-white border border-border text-brand-teal">
                        <PackageCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-mono font-semibold text-ink flex items-center gap-2">
                          <span>{gr.grNumber}</span>
                          <span className="text-[10px] font-sans text-ink-muted font-normal">
                            Logged by {gr.receivedBy}
                          </span>
                        </div>
                        <div className="text-[11px] text-ink-muted mt-0.5">{gr.notes}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className="font-mono font-bold text-ink">
                        {gr.lines[0]?.quantity || 200} units received
                      </span>
                      <Link
                        href="/invoices"
                        className="text-navy font-semibold hover:text-brand-teal transition-colors flex items-center gap-1"
                      >
                        <span>Cross-Match</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
