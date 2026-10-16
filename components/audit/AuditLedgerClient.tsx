"use client";

import React, { useState } from "react";
import {
  FileCheck2,
  ShieldCheck,
  Download,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Layers,
  FileCode,
  ExternalLink,
} from "lucide-react";
import { HashView } from "@/components/ui/StatusChip";
import { truncateHash } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiFetch } from "@/lib/apiFetch";

export interface SerializedAuditEvent {
  id: string;
  eventType: string;
  referenceId?: string | null;
  eventData: string;
  prevHash: string;
  eventHash: string;
  timestamp: string;
}

export function AuditLedgerClient({
  events,
  orgName,
}: {
  events: SerializedAuditEvent[];
  orgName: string;
}) {
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    totalEvents: number;
    error?: string;
  } | null>(null);

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await apiFetch("/api/audit/verify");
      const data = await res.json();
      setVerificationResult(data);
    } catch (err) {
      setVerificationResult({ valid: false, totalEvents: events.length, error: "Network error" });
    } finally {
      setVerifying(false);
    }
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `bizflow_audit_chain_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <span>Trust & Audit Ledger</span>
            <span className="text-xs font-mono font-medium bg-brand-light text-brand-teal px-2 py-0.5 rounded-full border border-brand-teal/20">
              Append-Only Hash Chain
            </span>
          </h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Tamper-evident activity log cryptographically linked via SHA-256 parent hashes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJson}
            className="px-3.5 py-1.5 rounded-md bg-white border border-border text-xs font-semibold text-ink hover:bg-canvas transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-navy" />
            <span>Export Ledger JSON</span>
          </button>
          <button
            onClick={handleVerifyChain}
            disabled={verifying}
            className="px-3.5 py-1.5 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-xs flex items-center gap-1.5"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-brand-teal ${verifying ? "animate-spin" : ""}`} />
            <span>{verifying ? "Verifying..." : "Verify Chain Integrity"}</span>
          </button>
        </div>
      </div>

      {/* Verification Status Banner if tested */}
      {verificationResult && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs shadow-xs ${
            verificationResult.valid
              ? "bg-emerald-50 border-emerald-300 text-ink"
              : "bg-red-50 border-red-300 text-danger"
          }`}
        >
          <div className="flex items-center gap-3">
            {verificationResult.valid ? (
              <CheckCircle2 className="w-5 h-5 text-success" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-danger" />
            )}
            <div>
              <div className="font-bold text-sm">
                {verificationResult.valid
                  ? "Cryptographic Chain Verified: 100% Intact"
                  : "Tamper Alert: Cryptographic Hash Mismatch Detected"}
              </div>
              <div className="text-ink-muted mt-0.5">
                {verificationResult.valid
                  ? `All ${verificationResult.totalEvents} sequential SHA-256 hash pointers verified back to Genesis block.`
                  : verificationResult.error}
              </div>
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-navy">SHA-256 Validated</span>
        </div>
      )}

      {/* Hash Chain Timeline */}
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="px-5 py-3.5 bg-canvas border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-ink uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-teal" />
            <span>Cryptographic Event Sequence ({events.length} Blocks)</span>
          </span>
          <span className="text-xs font-mono text-ink-muted">Org: {orgName}</span>
        </div>

        {events.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={FileCheck2}
              title="Audit Ledger Initialized"
              description="Cryptographic SHA-256 hash-chained events will be appended here as procurement, policy evaluations, and Arc on-chain settlements occur."
              action={{
                label: "Review Invoices",
                href: "/invoices",
              }}
              secondaryAction={{
                label: "Command Center",
                href: "/",
              }}
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {events.map((ev, index) => {
            let parsedData: any = {};
            try {
              parsedData = JSON.parse(ev.eventData);
            } catch (err) {}

            return (
              <div key={ev.id} className="p-5 hover:bg-canvas/40 transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-navy text-white text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <span className="font-mono text-xs font-bold text-ink uppercase">
                      {ev.eventType.replace("_", " ")}
                    </span>
                    {ev.eventType === "GENESIS" && (
                      <span className="text-[10px] bg-brand-light text-brand-teal px-1.5 py-0.2 rounded font-mono font-bold">
                        Genesis
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-mono text-ink-muted">
                    {new Date(ev.timestamp).toLocaleString()}
                  </span>
                </div>

                {/* Hashes: Prev Hash & Event Hash */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-canvas p-3 rounded-lg border border-border">
                  <div>
                    <span className="text-ink-muted block text-[11px] font-medium mb-1">
                      Parent Hash (<code className="font-mono text-navy font-bold">prev_hash</code>):
                    </span>
                    <HashView hash={ev.prevHash} truncate={false} />
                  </div>
                  <div>
                    <span className="text-ink-muted block text-[11px] font-medium mb-1">
                      Event Hash (<code className="font-mono text-brand-teal font-bold">event_hash</code>):
                    </span>
                    <HashView hash={ev.eventHash} truncate={false} />
                  </div>
                </div>

                {/* Canonical Data Payload */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-ink-muted hover:text-navy font-medium select-none text-[11px] flex items-center gap-1">
                    <span>Inspect Canonical Event Payload</span>
                  </summary>
                  <pre className="mt-2 p-3 rounded-lg bg-surface border border-border font-mono text-[11px] text-ink overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(parsedData, null, 2)}
                  </pre>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
}
