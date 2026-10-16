"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  Upload,
  Clipboard,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

interface InvoiceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InvoiceUploadModal({ isOpen, onClose, onSuccess }: InvoiceUploadModalProps) {
  const [tab, setTab] = useState<"form" | "paste" | "upload">("form");
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [pos, setPos] = useState<Array<{ id: string; poNumber: string; vendorId: string }>>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);

  const [vendorId, setVendorId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [totalUsdc, setTotalUsdc] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultNotice, setResultNotice] = useState<string | null>(null);

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
    setLoadingLookups(true);
    setError(null);
    setResultNotice(null);

    Promise.all([
      apiFetch("/api/suppliers").then((r) => (r.ok ? r.json() : { suppliers: [] })),
      apiFetch("/api/purchase-orders").then((r) => (r.ok ? r.json() : { purchaseOrders: [] })),
    ])
      .then(([supData, poData]) => {
        setSuppliers(supData.suppliers || []);
        setPos(poData.purchaseOrders || []);
        if (supData.suppliers?.length > 0 && !vendorId) {
          setVendorId(supData.suppliers[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingLookups(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePasteParse = () => {
    if (!rawText.trim()) return;

    // Fast regex extraction from pasted text
    const invMatch = rawText.match(/(?:Invoice\s*(?:#|No|Number)?|INV\s*#?)[:.\s]*([A-Z0-9-_]+)/i);
    if (invMatch) setInvoiceNumber(invMatch[1].trim());

    const totalMatch = rawText.match(/(?:Total\s*Due|Total|Amount\s*Due|Subtotal)[:.\s]*\$?([0-9,]+(?:\.[0-9]{2})?)/i);
    if (totalMatch) setTotalUsdc(totalMatch[1].replace(/,/g, "").trim());

    const poMatch = rawText.match(/(?:PO\s*(?:#|Ref|Reference)?|Purchase\s*Order)[:.\s]*([A-Z0-9-_]+)/i);
    if (poMatch) {
      const foundPo = pos.find((p) => p.poNumber.toUpperCase() === poMatch[1].trim().toUpperCase());
      if (foundPo) {
        setPurchaseOrderId(foundPo.id);
        setVendorId(foundPo.vendorId);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      if (!invoiceNumber) {
        setInvoiceNumber(file.name.replace(/\.[^/.]+$/, "").toUpperCase());
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResultNotice(null);

    try {
      const payload: any = {
        vendorId,
        purchaseOrderId: purchaseOrderId || undefined,
        invoiceNumber,
        totalUsdc,
        dueDate: dueDate || undefined,
      };

      if (rawText) {
        payload.rawText = rawText;
      }

      const res = await apiFetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit invoice");
      }

      if (data.invoice?.isInjectionSuspect) {
        setResultNotice("Prompt injection detected and quarantined! Invoice marked as BLOCKED.");
      } else if (data.invoice?.duplicateScore >= 90) {
        setResultNotice(`Duplicate detected (Score: ${data.invoice.duplicateScore}%). Invoice marked as BLOCKED.`);
      } else if (data.invoice?.status === "review_required") {
        setResultNotice("3-Way match discrepancy detected. Invoice marked for REVIEW.");
      } else {
        setResultNotice("Invoice verified successfully! Ready for agent analysis.");
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to submit invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-navy text-white">
              <FileText className="w-4 h-4 text-brand-teal" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Enter Invoice</h3>
              <p className="text-[11px] text-ink-muted">Intake invoice for 3-way match, duplicate & threat screen</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Intake Mode Tabs */}
        <div className="flex border-b border-border text-xs">
          <button
            onClick={() => setTab("form")}
            className={`flex-1 py-2 font-semibold text-center border-b-2 transition-colors ${
              tab === "form" ? "border-brand-teal text-navy" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            Manual Form
          </button>
          <button
            onClick={() => setTab("paste")}
            className={`flex-1 py-2 font-semibold text-center border-b-2 transition-colors ${
              tab === "paste" ? "border-brand-teal text-navy" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            Paste Text
          </button>
          <button
            onClick={() => setTab("upload")}
            className={`flex-1 py-2 font-semibold text-center border-b-2 transition-colors ${
              tab === "upload" ? "border-brand-teal text-navy" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            File Upload
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {tab === "paste" && (
            <div className="space-y-2">
              <label className="font-semibold text-ink">Paste Raw Invoice Text</label>
              <textarea
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste entire text from supplier invoice here..."
                className="w-full p-2.5 rounded-lg border border-border bg-canvas font-mono text-[11px] focus:bg-white focus:outline-none focus:border-navy"
              />
              <button
                type="button"
                onClick={handlePasteParse}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-canvas border border-border text-navy font-semibold hover:bg-white text-[11px]"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-teal" />
                <span>Auto-Extract Fields</span>
              </button>
            </div>
          )}

          {tab === "upload" && (
            <div className="space-y-2">
              <label className="font-semibold text-ink">Upload Invoice Document</label>
              <div className="p-4 border-2 border-dashed border-border rounded-xl text-center space-y-2 bg-canvas">
                <Upload className="w-6 h-6 text-ink-muted mx-auto" />
                <div className="text-xs text-ink-muted">
                  <label className="text-brand-teal font-semibold cursor-pointer hover:underline">
                    Choose a file
                    <input type="file" onChange={handleFileUpload} className="hidden" />
                  </label>{" "}
                  or drag and drop
                </div>
                {fileName && (
                  <span className="text-[11px] font-mono font-bold text-navy block">{fileName}</span>
                )}
              </div>
            </div>
          )}

          {/* Core Fields */}
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
                  <option value="">No suppliers added yet</option>
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
              <label className="font-semibold text-ink">Invoice Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. INV-2026-001"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-ink">Purchase Order Ref</label>
              <select
                value={purchaseOrderId}
                onChange={(e) => setPurchaseOrderId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy font-mono text-[11px]"
              >
                <option value="">None (Non-PO Invoice)</option>
                {pos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.poNumber}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-ink">Total Due (USDC) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={totalUsdc}
                onChange={(e) => setTotalUsdc(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy font-mono"
              />
            </div>
          </div>

          {resultNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{resultNotice}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-danger-light border border-danger-border text-danger flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
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
              <span>Verify & Save Invoice</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
