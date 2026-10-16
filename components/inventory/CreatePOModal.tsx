"use client";

import React, { useState, useEffect } from "react";
import { X, Boxes, Plus, Trash2, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreatePOModal({ isOpen, onClose, onSuccess }: CreatePOModalProps) {
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [vendorId, setVendorId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [lines, setLines] = useState<Array<{ description: string; quantity: number; unitPriceUsdc: string }>>([
    { description: "Portland Cement (50kg Bag)", quantity: 10, unitPriceUsdc: "0.05" },
  ]);

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
    apiFetch("/api/suppliers")
      .then((r) => (r.ok ? r.json() : { suppliers: [] }))
      .then((data) => {
        setSuppliers(data.suppliers || []);
        if (data.suppliers?.length > 0 && !vendorId) {
          setVendorId(data.suppliers[0].id);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddLine = () => {
    setLines([...lines, { description: "", quantity: 1, unitPriceUsdc: "1.00" }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: string, val: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: val };
    setLines(updated);
  };

  const computedTotal = lines.reduce((sum, l) => {
    const q = Number(l.quantity) || 0;
    const p = parseFloat(l.unitPriceUsdc) || 0;
    return sum + q * p;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await apiFetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poNumber: poNumber.trim(),
          vendorId,
          lines: lines.map((l) => ({
            description: l.description.trim(),
            quantity: Number(l.quantity),
            unitPriceUsdc: l.unitPriceUsdc.trim(),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create purchase order");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create purchase order");
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
              <Boxes className="w-4 h-4 text-brand-teal" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Create Purchase Order</h3>
              <p className="text-[11px] text-ink-muted">Issue authorized PO to enable automated 3-way reconciliation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-ink">Supplier *</label>
              <select
                required
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy"
              >
                {suppliers.length === 0 ? (
                  <option value="">No suppliers added</option>
                ) : (
                  suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-ink">PO Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. PO-2026-0001"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy font-mono"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-ink">Line Items</label>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-[11px] font-semibold text-brand-teal hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {lines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-canvas p-2 rounded-lg border border-border">
                  <input
                    type="text"
                    required
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                    className="flex-1 px-2 py-1 text-xs rounded border border-border bg-white focus:outline-none"
                  />
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                    className="w-16 px-2 py-1 text-xs rounded border border-border bg-white focus:outline-none font-mono"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Price"
                      value={line.unitPriceUsdc}
                      onChange={(e) => handleLineChange(idx, "unitPriceUsdc", e.target.value)}
                      className="w-20 px-2 py-1 text-xs rounded border border-border bg-white focus:outline-none font-mono"
                    />
                    <span className="text-[10px] text-ink-muted">USDC</span>
                  </div>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="text-danger hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center p-2.5 bg-surface rounded-lg border border-border font-medium">
              <span className="text-ink-muted">Calculated Total (USDC):</span>
              <span className="font-mono font-bold text-navy text-sm">
                {computedTotal.toFixed(2)} USDC
              </span>
            </div>
          </div>

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
              disabled={isSubmitting || suppliers.length === 0}
              className="px-4 py-1.5 rounded-lg bg-navy hover:bg-navy-light text-white font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
              )}
              <span>Issue Purchase Order</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
