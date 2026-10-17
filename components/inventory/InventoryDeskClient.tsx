"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  PackageCheck,
  Plus,
  FileText,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  ChevronRight,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreatePOModal } from "./CreatePOModal";
import { CreateGRModal } from "./CreateGRModal";

export interface SerializedStockMovement {
  id: string;
  quantity: number;
  type: string;
  reference?: string | null;
  createdAt: string;
}

export interface SerializedItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentStock: number;
  unitPriceUsdc: string;
  stockMovements?: SerializedStockMovement[];
}

export interface SerializedPOLine {
  id: string;
  quantity: number;
  unitPriceUsdc: string;
  totalUsdc: string;
  item?: {
    id: string;
    name: string;
    sku: string;
    unit?: string;
  };
}

export interface SerializedGRLine {
  id: string;
  quantity: number;
  item?: {
    id: string;
    name: string;
    sku: string;
  };
}

export interface SerializedGoodsReceipt {
  id: string;
  grNumber: string;
  receivedDate: string;
  receivedBy: string;
  notes?: string | null;
  lines: SerializedGRLine[];
}

export interface SerializedPO {
  id: string;
  poNumber: string;
  status: string;
  totalUsdc: string;
  orderDate: string;
  vendor: {
    id: string;
    name: string;
    walletAddress?: string;
  };
  lines: SerializedPOLine[];
  goodsReceipts: SerializedGoodsReceipt[];
}

interface InventoryDeskClientProps {
  items: SerializedItem[];
  purchaseOrders: SerializedPO[];
}

export function InventoryDeskClient({ items, purchaseOrders }: InventoryDeskClientProps) {
  const router = useRouter();
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isGrModalOpen, setIsGrModalOpen] = useState(false);
  const [selectedPoForGr, setSelectedPoForGr] = useState<string | undefined>(undefined);

  const handleOpenGrForPo = (poId: string) => {
    setSelectedPoForGr(poId);
    setIsGrModalOpen(true);
  };

  const handleOpenGeneralGr = () => {
    setSelectedPoForGr(undefined);
    setIsGrModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Inventory & Purchase Orders</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Operational ledger justifying procurement payments with verifiable goods receipt proofs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPoModalOpen(true)}
            className="px-3.5 py-1.5 rounded-md bg-brand-teal text-white text-xs font-semibold hover:bg-brand-hover transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Purchase Order</span>
          </button>
          <button
            onClick={handleOpenGeneralGr}
            disabled={purchaseOrders.length === 0}
            className="px-3.5 py-1.5 rounded-md bg-white border border-border text-ink text-xs font-semibold hover:bg-canvas disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs flex items-center gap-1.5"
          >
            <PackageCheck className="w-3.5 h-3.5 text-brand-teal" />
            <span>Record Goods Receipt</span>
          </button>
          <Link
            href="/invoices"
            className="px-3.5 py-1.5 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-xs flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Invoices</span>
          </Link>
        </div>
      </div>

      <CreatePOModal
        isOpen={isPoModalOpen}
        onClose={() => setIsPoModalOpen(false)}
        onSuccess={() => {
          setIsPoModalOpen(false);
          router.refresh();
        }}
      />

      <CreateGRModal
        isOpen={isGrModalOpen}
        defaultPoId={selectedPoForGr}
        onClose={() => setIsGrModalOpen(false)}
        onSuccess={() => {
          setIsGrModalOpen(false);
          router.refresh();
        }}
      />

      {items.length === 0 && purchaseOrders.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No Inventory Items or Purchase Orders"
          description="Purchase orders record agreed supplier quantities and atomic USDC unit prices, which are cross-referenced against warehouse receiving notes to enable automated 3-way matching."
          action={{
            label: "Create Purchase Order",
            onClick: () => setIsPoModalOpen(true),
          }}
          secondaryAction={{
            label: "Add Supplier First",
            href: "/suppliers",
          }}
        />
      ) : (
        <>
          {/* Stock Items Grid */}
          {items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-navy" />
                  <h2 className="text-sm font-semibold text-ink">Physical Stock Valuation Ledger</h2>
                </div>
                <span className="text-xs font-mono text-ink-muted">{items.length} tracked items</span>
              </div>
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
                        Valuation:{" "}
                        <span className="font-mono font-medium text-ink">
                          {item.unitPriceUsdc} / {item.unit}
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
            </div>
          )}

          {/* Purchase Orders and Goods Receipts Section */}
          <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-canvas/60">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-navy" />
                <h2 className="text-sm font-semibold text-ink">Authorized Purchase Orders & Receiving Slips</h2>
              </div>
              <span className="text-xs font-mono text-ink-muted">{purchaseOrders.length} orders</span>
            </div>

            <div className="divide-y divide-border">
              {purchaseOrders.map((po) => {
                const totalLinesQty = po.lines.reduce((acc, l) => acc + (l.quantity || 0), 0);
                const totalReceivedQty = po.goodsReceipts.reduce((acc, gr) => {
                  return acc + gr.lines.reduce((lAcc, l) => lAcc + (l.quantity || 0), 0);
                }, 0);
                const isFullyReceived = po.goodsReceipts.length > 0 && totalReceivedQty >= totalLinesQty;

                return (
                  <div key={po.id} className="p-5 hover:bg-canvas/40 transition-colors space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-ink">{po.poNumber}</span>
                          {isFullyReceived ? (
                            <span className="text-xs font-medium text-success bg-success-light border border-success-border px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Fully Received & Signed
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-warning bg-warning-light border border-warning-border px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Awaiting Delivery ({totalReceivedQty}/{totalLinesQty} units)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-ink-muted">
                          Supplier: <span className="font-semibold text-ink">{po.vendor?.name || "Unknown"}</span>
                          {po.vendor?.walletAddress && (
                            <span className="ml-2 font-mono text-[11px] text-ink-muted">
                              ({po.vendor.walletAddress.slice(0, 6)}...{po.vendor.walletAddress.slice(-4)})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-base font-mono font-bold text-ink">
                            {po.totalUsdc}
                          </div>
                          <div className="text-xs text-ink-muted font-mono">
                            {po.lines.length} {po.lines.length === 1 ? "line item" : "line items"}
                          </div>
                        </div>

                        {!isFullyReceived && (
                          <button
                            onClick={() => handleOpenGrForPo(po.id)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-canvas border border-border text-navy hover:bg-white hover:text-brand-teal transition-colors flex items-center gap-1 shadow-xs"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Log Receipt</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Line Items Details */}
                    {po.lines.length > 0 && (
                      <div className="bg-canvas/50 rounded-lg p-3 text-xs border border-border/60">
                        <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-2">
                          Authorized Line Items
                        </div>
                        <div className="space-y-1.5 font-mono">
                          {po.lines.map((line) => (
                            <div key={line.id} className="flex items-center justify-between text-ink">
                              <span>
                                {line.item?.name || "Item"} ({line.quantity} {line.item?.unit || "units"} @ {line.unitPriceUsdc})
                              </span>
                              <span className="font-semibold">{line.totalUsdc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Goods Receipt Slips */}
                    {po.goodsReceipts.length > 0 && (
                      <div className="space-y-2">
                        {po.goodsReceipts.map((gr) => (
                          <div
                            key={gr.id}
                            className="p-3 rounded-lg bg-canvas border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
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
                                {gr.notes && <div className="text-[11px] text-ink-muted mt-0.5">{gr.notes}</div>}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center">
                              <span className="font-mono font-bold text-ink">
                                {gr.lines.reduce((sum, l) => sum + (l.quantity || 0), 0)} units received
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
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
