"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Bot,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Filter,
  Check,
  X,
  Lock,
  ArrowRight,
  TrendingUp,
  FileText,
  DollarSign,
  ShieldCheck,
  Award,
  Sparkles,
} from "lucide-react";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { HashView } from "@/components/ui/StatusChip";
import { truncateHash } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

export interface DecisionRecord {
  id: string;
  orgId: string;
  invoiceId: string;
  timestamp: string;
  observationHash: string;
  cashPosition: string;
  choice: "pay_now" | "schedule" | "hold" | "escalate";
  reasoning: string;
  source: string;
  model: string;
  promptVersion: string;
  escalated: boolean;
  outcome: string;
  humanResponse: string | null;
  txHash: string | null;
  conflictWithPolicy: boolean;
  policyConflictReason: string | null;
  scheduledFor: string | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
    totalUsdc: string;
    status: string;
    vendor?: {
      name: string;
      walletAddress: string;
    };
  };
}

export interface DecisionMetrics {
  invoicesProcessed: string;
  paymentVolumeUsdc: string;
  duplicatesCaught: string;
  injectionAttemptsBlocked: string;
  decisionsMade: string;
  autoExecuted: string;
  escalated: string;
  humanAgreementRate: string;
}

export function AgentDecisionsClient({
  initialDecisions,
  initialMetrics,
  explorerBaseUrl = "https://explorer.arc.io",
}: {
  initialDecisions: DecisionRecord[];
  initialMetrics: DecisionMetrics;
  explorerBaseUrl?: string;
}) {
  const [decisions, setDecisions] = useState<DecisionRecord[]>(initialDecisions);
  const [metrics, setMetrics] = useState<DecisionMetrics>(initialMetrics);
  const [activeTab, setActiveTab] = useState<"all" | "proposed" | "escalations" | "executed" | "scheduled" | "held">("all");
  
  // Escalation action state
  const [actingDecisionId, setActingDecisionId] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredDecisions = decisions.filter((d) => {
    if (activeTab === "proposed") return d.outcome === "proposed";
    if (activeTab === "escalations") return d.escalated;
    if (activeTab === "executed") return d.outcome === "executed";
    if (activeTab === "scheduled") return d.outcome === "scheduled";
    if (activeTab === "held") return d.outcome === "held" || d.choice === "hold";
    return true;
  });

  const handleEscalationAction = async (decisionId: string, action: "approve" | "reject") => {
    setIsSubmitting(true);
    setActionError(null);

    try {
      const res = await fetch("/api/agent/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisionId,
          action,
          passcode: passcode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Action failed.");
      } else {
        // Refresh decisions list and metrics
        const refRes = await fetch("/api/agent/decisions");
        if (refRes.ok) {
          const refData = await refRes.json();
          setDecisions(refData.decisions);
          setMetrics(refData.metrics);
        }
        setActingDecisionId(null);
        setPasscode("");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to submit escalation review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Agent Decisions & Escalation Queue
            </h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-brand-light text-brand-teal font-semibold">
              Tameion V2
            </span>
          </div>
          <p className="text-sm text-ink-muted mt-0.5">
            Immutable log of autonomous treasury decisions, model prompts, and human escalation sign-offs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/agent"
            className="px-3 py-1.5 rounded-md border border-border bg-surface text-xs font-semibold text-ink hover:bg-canvas transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <Bot className="w-3.5 h-3.5 text-brand-teal" />
            <span>Agent Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Real Metrics Header (No synthetic data, 'n/a' when empty) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="p-3 rounded-lg border border-border bg-surface shadow-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">Invoices Processed</span>
          <span className="text-lg font-bold font-mono text-ink block mt-1">{metrics.invoicesProcessed}</span>
        </div>
        <div className="p-3 rounded-lg border border-border bg-surface shadow-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">Settled Volume</span>
          <span className="text-lg font-bold font-mono text-navy block mt-1">{metrics.paymentVolumeUsdc}</span>
        </div>
        <div className="p-3 rounded-lg border border-border bg-surface shadow-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">Duplicates Caught</span>
          <span className="text-lg font-bold font-mono text-amber-700 block mt-1">{metrics.duplicatesCaught}</span>
        </div>
        <div className="p-3 rounded-lg border border-border bg-surface shadow-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">Injections Blocked</span>
          <span className="text-lg font-bold font-mono text-danger block mt-1">{metrics.injectionAttemptsBlocked}</span>
        </div>
        <div className="p-3 rounded-lg border border-border bg-surface shadow-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">Decisions Made</span>
          <span className="text-lg font-bold font-mono text-ink block mt-1">{metrics.decisionsMade}</span>
        </div>
        <div className="p-3 rounded-lg border border-border bg-surface shadow-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">Auto-Executed</span>
          <span className="text-lg font-bold font-mono text-success block mt-1">{metrics.autoExecuted}</span>
        </div>
        <div className="p-3 rounded-lg border border-border bg-surface shadow-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">Escalated</span>
          <span className="text-lg font-bold font-mono text-brand-teal block mt-1">{metrics.escalated}</span>
        </div>
        <div className="p-3 rounded-lg border border-border bg-surface shadow-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">Agreement Rate</span>
          <span className="text-lg font-bold font-mono text-purple-700 block mt-1">{metrics.humanAgreementRate}</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 text-xs">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
            activeTab === "all" ? "bg-navy text-white" : "text-ink-muted hover:text-ink hover:bg-canvas"
          }`}
        >
          All Decisions ({decisions.length})
        </button>
        <button
          onClick={() => setActiveTab("proposed")}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === "proposed" ? "bg-sky-700 text-white" : "text-sky-700 hover:bg-sky-50"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Proposed ({decisions.filter((d) => d.outcome === "proposed").length})</span>
        </button>
        <button
          onClick={() => setActiveTab("escalations")}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === "escalations" ? "bg-amber-600 text-white" : "text-amber-700 hover:bg-amber-50"
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Escalation Queue ({decisions.filter((d) => d.escalated).length})</span>
        </button>
        <button
          onClick={() => setActiveTab("executed")}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
            activeTab === "executed" ? "bg-success text-white" : "text-ink-muted hover:text-ink hover:bg-canvas"
          }`}
        >
          Auto-Executed ({decisions.filter((d) => d.outcome === "executed").length})
        </button>
        <button
          onClick={() => setActiveTab("scheduled")}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
            activeTab === "scheduled" ? "bg-brand-teal text-white" : "text-ink-muted hover:text-ink hover:bg-canvas"
          }`}
        >
          Scheduled ({decisions.filter((d) => d.outcome === "scheduled").length})
        </button>
        <button
          onClick={() => setActiveTab("held")}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
            activeTab === "held" ? "bg-danger text-white" : "text-ink-muted hover:text-ink hover:bg-canvas"
          }`}
        >
          Held ({decisions.filter((d) => d.outcome === "held" || d.choice === "hold").length})
        </button>
      </div>

      {/* Decisions Table */}
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        {filteredDecisions.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Bot}
              title="No Agent Decisions Recorded"
              description="When the AI agent evaluates open invoices, observation hashes, policy evaluations, and reasoning trails will appear here."
              action={{
                label: "Run Agent Advisory",
                href: "/agent",
              }}
              secondaryAction={{
                label: "View Invoices",
                href: "/invoices",
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-border text-ink-muted uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">Invoice & Vendor</th>
                  <th className="py-2.5 px-4 font-semibold">Amount</th>
                  <th className="py-2.5 px-4 font-semibold">Agent Choice</th>
                  <th className="py-2.5 px-4 font-semibold">Source & Model</th>
                  <th className="py-2.5 px-4 font-semibold">Reasoning</th>
                  <th className="py-2.5 px-4 font-semibold">Outcome & Human Sign-off</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDecisions.map((d) => {
                  const isActing = actingDecisionId === d.id;
                  const invoice = d.invoice;
                  const amount = invoice ? formatUsdc(usdcAtomic(BigInt(invoice.totalUsdc))) : "n/a";

                  return (
                    <tr key={d.id} className="hover:bg-canvas/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-ink-muted whitespace-nowrap">
                        {new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        <span className="block text-[10px] text-ink-muted/70">
                          {new Date(d.timestamp).toISOString().slice(0, 10)}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-ink block">
                          {invoice?.invoiceNumber || d.invoiceId}
                        </span>
                        <span className="text-[11px] text-ink-muted block truncate max-w-[140px]">
                          {invoice?.vendor?.name || "Unknown"}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-ink whitespace-nowrap">
                        {amount} USDC
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                            d.choice === "pay_now"
                              ? "bg-success-light text-success border border-success-border"
                              : d.choice === "schedule"
                              ? "bg-brand-light text-brand-teal border border-brand-teal/20"
                              : d.choice === "escalate"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-danger-light text-danger border border-danger-border"
                          }`}
                        >
                          {d.choice}
                        </span>
                        {d.conflictWithPolicy && (
                          <span className="block text-[9px] text-danger font-semibold mt-0.5">
                            Policy Overrode LLM
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-[10px] text-ink-muted block font-semibold uppercase">
                          {d.source}
                        </span>
                        <span className="text-[10px] text-ink-muted/80 block font-mono truncate max-w-[120px]" title={d.model}>
                          {d.model} ({d.promptVersion})
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-ink leading-snug line-clamp-2" title={d.reasoning}>
                          {d.reasoning}
                        </p>
                        {d.scheduledFor && (
                          <span className="text-[10px] font-mono text-brand-teal block mt-0.5">
                            Target Date: {new Date(d.scheduledFor).toISOString().slice(0, 10)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {d.outcome === "proposed" ? (
                              <div className="flex flex-col gap-1 items-start">
                                <span className="bg-sky-50 text-sky-800 border border-sky-300 px-2 py-0.5 rounded font-medium text-[10px] inline-flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-sky-600" />
                                  Proposed by agent — awaiting user signature
                                </span>
                                {d.choice === "pay_now" && (
                                  <Link
                                    href="/payments"
                                    className="text-[10px] font-semibold text-brand-teal hover:underline inline-flex items-center gap-0.5"
                                  >
                                    <span>Sign in Payment Desk</span>
                                    <ArrowRight className="w-2.5 h-2.5" />
                                  </Link>
                                )}
                              </div>
                            ) : (
                              <span
                                className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                                  d.outcome === "executed"
                                    ? "bg-success/10 text-success"
                                    : d.outcome === "escalated"
                                    ? "bg-amber-100 text-amber-800"
                                    : d.outcome === "rejected"
                                    ? "bg-danger/10 text-danger"
                                    : "bg-canvas text-ink-muted border border-border"
                                }`}
                              >
                                {d.outcome}
                              </span>
                            )}

                            {d.txHash && (
                              <a
                                href={`${explorerBaseUrl}/tx/${d.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 font-mono text-[10px] text-brand-teal hover:underline"
                              >
                                <span>{truncateHash(d.txHash, 4, 3)}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>

                          {/* Escalation Action Button */}
                          {d.escalated && !d.humanResponse && (
                            <div>
                              {!isActing ? (
                                <button
                                  onClick={() => {
                                    setActingDecisionId(d.id);
                                    setActionError(null);
                                  }}
                                  className="px-2 py-1 rounded bg-navy text-white text-[11px] font-semibold hover:bg-navy-light transition-colors shadow-2xs"
                                >
                                  Review Escalation
                                </button>
                              ) : (
                                <div className="p-2 rounded border border-border bg-canvas space-y-2 mt-1">
                                  <input
                                    type="password"
                                    value={passcode}
                                    onChange={(e) => setPasscode(e.target.value)}
                                    placeholder="Enter OWNER_PASSCODE"
                                    className="w-full px-2 py-1 text-[11px] rounded border border-border bg-surface font-mono"
                                  />
                                  {actionError && (
                                    <span className="text-[10px] text-danger block">{actionError}</span>
                                  )}
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => handleEscalationAction(d.id, "approve")}
                                      disabled={isSubmitting}
                                      className="px-2 py-0.5 rounded bg-success text-white text-[10px] font-semibold hover:bg-success/90"
                                    >
                                      Approve & Settle
                                    </button>
                                    <button
                                      onClick={() => handleEscalationAction(d.id, "reject")}
                                      disabled={isSubmitting}
                                      className="px-2 py-0.5 rounded bg-danger text-white text-[10px] font-semibold hover:bg-danger/90"
                                    >
                                      Reject
                                    </button>
                                    <button
                                      onClick={() => setActingDecisionId(null)}
                                      className="px-1.5 py-0.5 text-[10px] text-ink-muted hover:text-ink"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {d.humanResponse && (
                            <span className="text-[10px] text-ink-muted block">
                              Sign-off: <strong className="uppercase">{d.humanResponse}</strong>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
