"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ReceiptText,
  Filter,
  Eye,
  FileCode2,
  ShieldAlert,
  ArrowRight,
  Bot,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  Calendar,
  Percent,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { StatusChip, HashView } from "@/components/ui/StatusChip";
import { ThreeWayDiffViewer } from "./ThreeWayDiffViewer";

export interface SerializedInvoice {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName: string;
  vendorWallet: string;
  poNumber: string;
  poQty: number;
  poUnitPrice: string;
  poTotal: string;
  grNumber: string;
  grQty: number;
  receivedBy: string;
  amountFormatted: string;
  amountAtomic: string;
  status: string;
  matchStatus: string;
  duplicateScore: number;
  isInjectionSuspect: boolean;
  suspicionNotes?: string | null;
  dueDate?: string | null;
  earlyPayDiscountPct?: number | null;
  earlyPayDays?: number | null;
  isDemo?: boolean;
  fileHash: string;
  rawContent?: string | null;
  createdAt: string;
}

export function InvoiceDeskClient({ invoices }: { invoices: SerializedInvoice[] }) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(invoices[0]?.id || "");
  const [filter, setFilter] = useState<string>("all");

  const filteredInvoices = invoices.filter((inv) => {
    if (filter === "verified") return inv.status === "verified";
    if (filter === "review") return inv.status === "review_required";
    if (filter === "blocked") return inv.status === "blocked";
    return true;
  });

  const selectedInvoice = invoices.find((inv) => inv.id === selectedInvoiceId) || invoices[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Invoice Desk</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Automated invoice intake, 3-way matching, duplicate screening, and injection defenses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/agent"
            className="px-3.5 py-1.5 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Bot className="w-3.5 h-3.5 text-brand-teal" />
            <span>Consult AI Agent</span>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 text-xs font-medium">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            filter === "all" ? "bg-navy text-white font-semibold" : "text-ink-muted hover:bg-canvas"
          }`}
        >
          All Invoices ({invoices.length})
        </button>
        <button
          onClick={() => setFilter("verified")}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            filter === "verified" ? "bg-navy text-white font-semibold" : "text-ink-muted hover:bg-canvas"
          }`}
        >
          Verified ({invoices.filter((i) => i.status === "verified").length})
        </button>
        <button
          onClick={() => setFilter("review")}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            filter === "review" ? "bg-navy text-white font-semibold" : "text-ink-muted hover:bg-canvas"
          }`}
        >
          Needs Review ({invoices.filter((i) => i.status === "review_required").length})
        </button>
        <button
          onClick={() => setFilter("blocked")}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            filter === "blocked" ? "bg-navy text-white font-semibold" : "text-ink-muted hover:bg-canvas"
          }`}
        >
          Blocked / Threats ({invoices.filter((i) => i.status === "blocked").length})
        </button>
      </div>

      {/* Main Layout: List on Left, Active Diff Viewer on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Invoices List */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="px-4 py-3 bg-canvas border-b border-border text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Inbound Payables
          </div>
          <div className="divide-y divide-border max-h-[680px] overflow-y-auto">
            {filteredInvoices.map((inv) => {
              const isSelected = inv.id === selectedInvoiceId;
              return (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoiceId(inv.id)}
                  className={`p-4 cursor-pointer transition-all ${
                    isSelected ? "bg-brand-light/40 border-l-4 border-l-brand-teal" : "hover:bg-canvas/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-xs font-bold text-ink truncate">{inv.invoiceNumber}</span>
                      {inv.isDemo && (
                        <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-1 rounded">
                          DEMO
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs font-bold text-ink tabular-nums">{inv.amountFormatted}</span>
                  </div>

                  <div className="mt-1 text-xs text-ink-muted truncate">{inv.vendorName}</div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusChip status={inv.status} size="sm" />
                      {inv.isInjectionSuspect && (
                        <span className="text-[10px] bg-danger-light text-danger border border-danger-border px-1.5 py-0.5 rounded font-mono font-bold">
                          Injection
                        </span>
                      )}
                      {inv.duplicateScore > 0 && (
                        <span className="text-[10px] bg-warning-light text-warning border border-warning-border px-1.5 py-0.5 rounded font-mono">
                          Dup {inv.duplicateScore}%
                        </span>
                      )}
                      {inv.earlyPayDiscountPct ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-0.5">
                          <Percent className="w-2.5 h-2.5" />
                          {inv.earlyPayDiscountPct}% ({inv.earlyPayDays}d)
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[11px] text-ink-muted font-mono">{inv.poNumber}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Invoice Details & 3-Way Diff Viewer */}
        <div className="lg:col-span-7 space-y-4">
          {selectedInvoice ? (
            <>
              {/* 3-Way Diff Component */}
              <ThreeWayDiffViewer
                poNumber={selectedInvoice.poNumber}
                poQty={selectedInvoice.poQty}
                poUnitPrice={selectedInvoice.poUnitPrice}
                poTotal={selectedInvoice.poTotal}
                grNumber={selectedInvoice.grNumber}
                grQty={selectedInvoice.grQty}
                receivedBy={selectedInvoice.receivedBy}
                invoiceNumber={selectedInvoice.invoiceNumber}
                invoiceQty={selectedInvoice.poQty}
                invoiceUnitPrice={selectedInvoice.poUnitPrice}
                invoiceTotal={selectedInvoice.amountFormatted}
                matchStatus={selectedInvoice.matchStatus}
                isInjectionSuspect={selectedInvoice.isInjectionSuspect}
                suspicionNotes={selectedInvoice.suspicionNotes}
              />

              {/* Payment Timing Intelligence */}
              {(selectedInvoice.dueDate || selectedInvoice.earlyPayDiscountPct) && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                    <span className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span>Payment Timing Intelligence</span>
                    </span>
                    <span className="text-[11px] font-mono text-emerald-800">
                      {selectedInvoice.dueDate
                        ? `Due ${new Date(selectedInvoice.dueDate).toLocaleDateString()}`
                        : "No due date specified"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-emerald-900/70 font-medium block">Early-Payment Discount:</span>
                      <span className="font-semibold text-emerald-900">
                        {selectedInvoice.earlyPayDiscountPct
                          ? `${selectedInvoice.earlyPayDiscountPct}% discount if paid within ${selectedInvoice.earlyPayDays} days`
                          : "Standard terms (No early discount)"}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-900/70 font-medium block">Autonomous Strategy:</span>
                      <span className="font-semibold text-emerald-900">
                        {selectedInvoice.earlyPayDiscountPct
                          ? "Pay now to capture discount (yield > reserve opportunity cost)"
                          : "Schedule payment closer to due date"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Cryptographic Hash & Untrusted Payload Inspection */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <span className="text-xs font-semibold text-navy flex items-center gap-1.5">
                    <FileCode2 className="w-4 h-4 text-brand-teal" />
                    <span>Cryptographic Audit Proof</span>
                  </span>
                  <span className="text-[11px] font-mono text-ink-muted">SHA-256 Digest</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-ink-muted font-medium">Document File Hash:</span>
                    <HashView hash={selectedInvoice.fileHash} truncate={false} />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-ink-muted font-medium">Remittance Wallet:</span>
                    <HashView hash={selectedInvoice.vendorWallet} truncate={false} />
                  </div>
                </div>

                {/* Vendor Address Screening Status (Honest Disclaimer) */}
                <div className="p-2.5 rounded-lg bg-canvas border border-border text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
                      <span>Address Screening:</span>
                    </span>
                    <span className="font-mono text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">
                      Sanctions list not loaded
                    </span>
                  </div>
                  <p className="text-ink-muted leading-relaxed">
                    Official sanctions feed is NOT loaded. Screening is restricted to local public test-wallet blocklists (Hardhat/Anvil default accounts). Regulatory sanctions screening is not currently performed.
                  </p>
                </div>

                {/* Raw Untrusted Payload Preview */}
                <div className="pt-2">
                  <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Raw Ingested Text (Treated as Untrusted Data)</span>
                    {selectedInvoice.isInjectionSuspect && (
                      <span className="text-danger flex items-center gap-1 font-sans lowercase text-[11px]">
                        <ShieldAlert className="w-3.5 h-3.5" /> hostile instructions neutralized
                      </span>
                    )}
                  </div>
                  <pre className="p-3 rounded-lg bg-canvas border border-border font-mono text-[11px] text-ink overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-40">
                    {selectedInvoice.rawContent || "No raw text available"}
                  </pre>
                </div>

                {/* Direct Action Footer */}
                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-ink-muted">Next step in pipeline:</span>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/agent"
                      className="px-3 py-1.5 rounded-md bg-canvas hover:bg-canvas-subtle border border-border text-xs font-semibold text-ink transition-colors flex items-center gap-1"
                    >
                      <Bot className="w-3.5 h-3.5 text-brand-teal" />
                      <span>Ask AI Agent</span>
                    </Link>
                    <Link
                      href="/payments"
                      className="px-3 py-1.5 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors flex items-center gap-1"
                    >
                      <span>Go to Payment Desk</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-ink-muted border rounded-xl bg-surface">
              Select an invoice to review its reconciliation diff.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
