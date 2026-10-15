"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bot,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  SlidersHorizontal,
  HelpCircle,
  FileText,
  Lock,
} from "lucide-react";
import { StatusChip, HashView } from "@/components/ui/StatusChip";
import { AgentRecommendation } from "@/lib/agent/types";
import { EmptyState } from "@/components/ui/EmptyState";

interface InvoiceAgentView {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  amountFormatted: string;
  matchStatus: string;
  duplicateScore: number;
  isInjectionSuspect: boolean;
  dueDate?: string | null;
  recommendation: AgentRecommendation;
}

export function AgentDashboardClient({
  invoices,
  treasuryFormatted,
  reserveFormatted,
  freeCashFormatted,
}: {
  invoices: InvoiceAgentView[];
  treasuryFormatted: string;
  reserveFormatted: string;
  freeCashFormatted: string;
}) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(invoices[0]?.id || "");
  const [isRunning, setIsRunning] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [isExecutingRun, setIsExecutingRun] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<any | null>(null);

  const selected = invoices.find((i) => i.id === selectedInvoiceId) || invoices[0];
  const rec = selected?.recommendation;

  const handleRerun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
    }, 600);
  };

  const handleRunAgentNow = async () => {
    setIsExecutingRun(true);
    setRunError(null);
    setRunResult(null);

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passcode: passcode.trim() || undefined,
          dryRun,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRunError(data.error || "Agent execution failed.");
      } else {
        setRunResult(data.result);
      }
    } catch (err: any) {
      setRunError(err.message || "Network error contacting agent run endpoint.");
    } finally {
      setIsExecutingRun(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <span>AI Finance Agent</span>
            <span className="text-xs font-mono font-medium bg-brand-light text-brand-teal px-2 py-0.5 rounded-full border border-brand-teal/20">
              Autonomous Loop
            </span>
          </h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Analyzes cash-flow commitments, ranks payables, and executes policy-compliant settlements within budget limits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Run Agent Now Button */}
          <button
            onClick={() => {
              setShowRunModal(true);
              setRunError(null);
              setRunResult(null);
            }}
            className="px-3.5 py-1.5 rounded-md bg-brand-teal text-white text-xs font-semibold hover:bg-brand-teal/90 transition-all shadow-xs flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Run agent now</span>
          </button>

          <Link
            href="/agent/decisions"
            className="px-3.5 py-1.5 rounded-md bg-white border border-border text-navy text-xs font-semibold hover:bg-canvas transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal" />
            <span>Agent Decisions</span>
          </Link>

          <Link
            href="/simulator"
            className="px-3.5 py-1.5 rounded-md bg-white border border-border text-navy text-xs font-semibold hover:bg-canvas transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-brand-teal" />
            <span>Policy Simulator</span>
          </Link>
          <Link
            href="/payments"
            className="px-3.5 py-1.5 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-xs flex items-center gap-1.5"
          >
            <span>Payment Desk</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Run Agent Modal */}
      {showRunModal && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-brand-teal" />
                <h3 className="font-bold text-sm text-ink">Run Autonomous Agent Loop</h3>
              </div>
              <button
                onClick={() => setShowRunModal(false)}
                className="text-ink-muted hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              Triggers the autonomous agent loop across all open invoices. Invoices meeting deterministic policy, 3-way match, and autonomous budget caps will be evaluated and settled automatically.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-ink block">Owner Passcode</label>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter OWNER_PASSCODE"
                  className="w-full px-3 py-1.5 text-xs rounded border border-border bg-canvas font-mono text-ink focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
                <span className="text-[10px] text-ink-muted">Required on Arc Mainnet. Optional if CRON_SECRET is set.</span>
              </div>

              <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="rounded border-border text-brand-teal focus:ring-brand-teal"
                />
                <span>Simulation / DRY_RUN mode (Estimate gas, do not broadcast)</span>
              </label>

              {runError && (
                <div className="p-2.5 rounded bg-danger/10 border border-danger/20 text-danger text-xs">
                  {runError}
                </div>
              )}

              {runResult && (
                <div className="p-3 rounded bg-success/10 border border-success/30 text-ink text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-success">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Run Completed Successfully ({runResult.mode} mode)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>Invoices Evaluated: <strong>{runResult.invoicesEvaluated}</strong></div>
                    <div>Auto-Executed: <strong>{runResult.autoExecutedCount}</strong></div>
                    <div>Scheduled: <strong>{runResult.scheduledCount}</strong></div>
                    <div>Escalated: <strong>{runResult.escalatedCount}</strong></div>
                    <div className="col-span-2 text-navy font-mono font-bold">
                      Settled: {runResult.totalVolumeExecutedUsdc} USDC
                    </div>
                  </div>
                  <Link
                    href="/agent/decisions"
                    className="mt-2 block text-center px-3 py-1.5 rounded bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors"
                  >
                    View Decisions Log →
                  </Link>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowRunModal(false)}
                className="px-3 py-1.5 text-xs text-ink-muted hover:text-ink font-medium"
              >
                Close
              </button>
              {!runResult && (
                <button
                  onClick={handleRunAgentNow}
                  disabled={isExecutingRun}
                  className="px-4 py-1.5 rounded bg-brand-teal text-white text-xs font-semibold hover:bg-brand-teal/90 transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isExecutingRun ? "Running Loop..." : "Execute Run"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trust & Boundary Guardrail Callout */}
      <div className="p-4 rounded-xl border border-navy/20 bg-surface shadow-xs flex items-center gap-3">
        <div className="p-2 rounded-lg bg-navy text-brand-teal">
          <Lock className="w-5 h-5" />
        </div>
        <div className="text-xs text-ink-muted leading-relaxed">
          <strong className="text-ink font-semibold">Architectural Isolation: </strong>
          The AI model can only call <code className="bg-canvas px-1 py-0.5 rounded text-navy font-mono">propose_payment</code>.
          It never receives private keys, cannot trigger the Arc settlement adapter, and cannot override the deterministic policy engine.
        </div>
      </div>

      {/* Cash Flow Context Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-surface shadow-card">
          <span className="text-xs text-ink-muted font-medium">Available Treasury</span>
          <div className="text-xl font-mono font-bold text-ink mt-1">{treasuryFormatted}</div>
          <span className="text-[11px] text-success mt-0.5 block">Live Arc Network Balance</span>
        </div>
        <div className="p-4 rounded-xl border border-border bg-surface shadow-card">
          <span className="text-xs text-ink-muted font-medium">Policy Reserve Buffer</span>
          <div className="text-xl font-mono font-bold text-ink mt-1">{reserveFormatted}</div>
          <span className="text-[11px] text-ink-muted mt-0.5 block">Guaranteed minimum liquidity</span>
        </div>
        <div className="p-4 rounded-xl border border-border bg-surface shadow-card">
          <span className="text-xs text-ink-muted font-medium">Unrestricted Free Liquidity</span>
          <div className="text-xl font-mono font-bold text-brand-teal mt-1">{freeCashFormatted}</div>
          <span className="text-[11px] text-brand-teal mt-0.5 block">Available for autonomous settlement</span>
        </div>
      </div>

      {/* Main Analysis View */}
      {invoices.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No Invoices for AI Advisory"
          description="When you enter invoices from your suppliers, the AI finance agent analyzes payment obligations, detects early-payment discount opportunities, and formulates policy-compliant recommendations."
          action={{
            label: "Enter Your First Invoice",
            href: "/invoices",
          }}
          secondaryAction={{
            label: "View Decision History",
            href: "/agent/decisions",
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Obligations Queue */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="px-4 py-3 bg-canvas border-b border-border text-xs font-semibold text-ink-muted uppercase tracking-wider flex items-center justify-between">
            <span>Payable Obligations</span>
            <span>{invoices.length} Queued</span>
          </div>
          <div className="divide-y divide-border">
            {invoices.map((inv) => {
              const isSelected = inv.id === selectedInvoiceId;
              const action = inv.recommendation.action;

              let actionBadge = "bg-success-light text-success border-success-border";
              let actionText = "Pay Now";
              if (action === "hold") {
                actionBadge = "bg-danger-light text-danger border-danger-border";
                actionText = "Hold";
              } else if (action === "request_review") {
                actionBadge = "bg-warning-light text-warning border-warning-border";
                actionText = "Review";
              }

              return (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoiceId(inv.id)}
                  className={`p-4 cursor-pointer transition-all ${
                    isSelected ? "bg-brand-light/40 border-l-4 border-l-brand-teal" : "hover:bg-canvas/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-ink">{inv.invoiceNumber}</span>
                    <span className="font-mono text-xs font-bold text-ink">{inv.amountFormatted}</span>
                  </div>

                  <div className="mt-1 text-xs text-ink-muted">{inv.vendorName}</div>

                  <div className="mt-2.5 flex items-center justify-between">
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${actionBadge}`}>
                      {actionText}
                    </span>
                    <span className="text-[11px] text-ink-muted font-mono">
                      Conf: {(inv.recommendation.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Agent Recommendation Card */}
        <div className="lg:col-span-7 space-y-4">
          {selected && rec ? (
            <div className="rounded-xl border border-border bg-surface shadow-card p-6 space-y-5">
              {/* Proposal Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-navy text-white">
                    <Bot className="w-5 h-5 text-brand-teal" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ink flex items-center gap-2">
                      <span>Proposal for {selected.invoiceNumber}</span>
                    </h2>
                    <span className="text-xs text-ink-muted">
                      Vendor: <strong className="text-ink">{selected.vendorName}</strong> ({selected.amountFormatted})
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleRerun}
                  disabled={isRunning}
                  className="px-3 py-1.5 rounded-md bg-canvas hover:bg-canvas-subtle border border-border text-xs font-medium text-ink transition-colors flex items-center gap-1.5 self-start sm:self-center"
                >
                  <RotateCcw className={`w-3.5 h-3.5 text-navy ${isRunning ? "animate-spin" : ""}`} />
                  <span>Re-evaluate</span>
                </button>
              </div>

              {/* Action Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  rec.action === "pay_now"
                    ? "bg-emerald-50 border-emerald-200"
                    : rec.action === "hold"
                    ? "bg-red-50 border-red-200"
                    : "bg-amber-50 border-amber-200"
                }`}
              >
                <div>
                  <div className="text-xs font-medium text-ink-muted uppercase tracking-wider">
                    Agent Action Recommendation
                  </div>
                  <div className="text-lg font-bold font-mono text-ink uppercase mt-0.5 flex items-center gap-2">
                    {rec.action === "pay_now" && <CheckCircle2 className="w-5 h-5 text-success" />}
                    {rec.action === "hold" && <ShieldAlert className="w-5 h-5 text-danger" />}
                    {rec.action === "request_review" && <AlertTriangle className="w-5 h-5 text-warning" />}
                    <span>{rec.action.replace("_", " ")}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-ink-muted font-medium">Confidence Score</span>
                  <div className="text-lg font-mono font-bold text-ink">
                    {(rec.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Reasoning Chain */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-teal" />
                  <span>Autonomous Reasoning Chain</span>
                </h3>
                <ul className="space-y-2">
                  {rec.reasoning.map((step, idx) => (
                    <li
                      key={idx}
                      className="p-3 rounded-lg bg-canvas border border-border text-xs text-ink flex items-start gap-2.5 leading-relaxed"
                    >
                      <span className="w-5 h-5 rounded-full bg-navy/10 text-navy font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Identified Risks */}
              {rec.risks.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-danger uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Identified Risk Flags</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {rec.risks.map((risk, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-danger-light text-danger border border-danger-border text-xs font-medium"
                      >
                        {risk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Policy Anticipation & Next Step */}
              <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-ink-muted">
                  Deterministic Policy Status:{" "}
                  <strong className={rec.policyAnticipation.likelyPassed ? "text-success" : "text-danger"}>
                    {rec.policyAnticipation.likelyPassed ? "Pre-cleared" : "Anticipating Policy Rejection"}
                  </strong>
                </div>

                <Link
                  href="/payments"
                  className="px-4 py-2 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span>Submit to Policy Gate</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-ink-muted border rounded-xl bg-surface">
              Select an invoice from the obligations queue.
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
