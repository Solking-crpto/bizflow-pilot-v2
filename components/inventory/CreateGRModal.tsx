"use client";

import React, { useState, useEffect } from "react";
import { X, PackageCheck, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

interface CreateGRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultPoId?: string;
}

export function CreateGRModal({ isOpen, onClose, onSuccess, defaultPoId }: CreateGRModalProps) {
  const [pos, setPos] = useState<Array<{ id: string; poNumber: string; lines: Array<{ id: string; itemId: string; itemName: string; quantity: number }> }>>([]);
  const [selectedPoId, setSelectedPoId] = useState(defaultPoId || "");
  const [grNumber, setGrNumber] = useState("");
  const [receivedBy, setReceivedBy] = useState("Warehouse Receiving Officer");
  const [notes, setNotes] = useState("");
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    apiFetch("/api/purchase-orders")
      .then((r) => (r.ok ? r.json() : { purchaseOrders: [] }))
      .then((data) => {
        setPos(data.purchaseOrders || []);
        if (data.purchaseOrders?.length > 0 && !selectedPoId) {
          const first = data.purchaseOrders[0];
          setSelectedPoId(first.id);
          const initialQtys: Record<string, number> = {};
          first.lines?.forEach((l: any) => {
            initialQtys[l.itemId || l.id] = l.quantity;
          });
          setReceivedQuantities(initialQtys);
        }
      })
      .catch(() => {});
  }, [isOpen, selectedPoId]);

  if (!isOpen) return null;

  const currentPo = pos.find((p) => p.id === selectedPoId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPo) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const lines = (currentPo.lines || []).map((l: any) => {
        const rawVal = receivedQuantities[l.itemId || l.id];
        const parsedQty = rawVal !== undefined ? parseInt(String(rawVal), 10) : l.quantity;
        return {
          itemId: l.itemId || l.id,
          quantity: isNaN(parsedQty) || parsedQty < 0 ? 0 : parsedQty,
        };
      });

      if (lines.length === 0 || lines.every((l) => l.quantity <= 0)) {
        setError("Please specify a received quantity greater than 0 for at least one item line.");
        setIsSubmitting(false);
        return;
      }

      const res = await apiFetch("/api/goods-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grNumber: grNumber.trim(),
          purchaseOrderId: currentPo.id,
          receivedBy: receivedBy.trim(),
          notes: notes.trim() || undefined,
          lines,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record goods receipt");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to record goods receipt");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-navy text-white">
              <PackageCheck className="w-4 h-4 text-brand-teal" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Record Goods Receipt</h3>
              <p className="text-[11px] text-ink-muted">Confirm physical inventory arrival for 3-way match validation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-ink">Purchase Order Ref *</label>
              <select
                required
                value={selectedPoId}
                onChange={(e) => {
                  setSelectedPoId(e.target.value);
                  const p = pos.find((item) => item.id === e.target.value);
                  const qtys: Record<string, number> = {};
                  p?.lines?.forEach((l: any) => {
                    qtys[l.itemId || l.id] = l.quantity;
                  });
                  setReceivedQuantities(qtys);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy font-mono"
              >
                {pos.length === 0 ? (
                  <option value="">No POs found</option>
                ) : (
                  pos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.poNumber}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-ink">Goods Receipt # *</label>
              <input
                type="text"
                required
                placeholder="e.g. GR-2026-0001"
                value={grNumber}
                onChange={(e) => setGrNumber(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-ink">Received By *</label>
            <input
              type="text"
              required
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>

          {currentPo && currentPo.lines && currentPo.lines.length > 0 && (
            <div className="space-y-2">
              <label className="font-semibold text-ink">Delivered Quantities</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {currentPo.lines.map((l: any) => {
                  const lineKey = l.itemId || l.id;
                  return (
                    <div key={lineKey} className="flex items-center justify-between bg-canvas p-2.5 rounded-lg border border-border">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-semibold text-ink truncate">{l.itemName || "Item"}</span>
                        {l.sku && <span className="font-mono text-[10px] text-ink-muted">{l.sku}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-ink-muted text-[11px]">Ordered: {l.quantity}</span>
                        <input
                          type="number"
                          min="0"
                          value={receivedQuantities[lineKey] ?? l.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setReceivedQuantities({
                              ...receivedQuantities,
                              [lineKey]: isNaN(val) ? 0 : Math.max(0, val),
                            });
                          }}
                          className="w-20 px-2 py-1 text-xs rounded border border-border bg-white text-right font-mono focus:outline-none focus:border-navy"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-danger-light border border-danger-border text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-border text-ink-muted hover:text-ink transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || pos.length === 0}
              className="px-4 py-1.5 rounded-lg bg-navy hover:bg-navy-light text-white font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
              )}
              <span>Record Goods Receipt</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
