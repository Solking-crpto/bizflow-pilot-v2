"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Wallet,
  Clock,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { createPublicClient, http, erc20Abi, formatUnits } from "viem";
import { StatusChip, HashView } from "@/components/ui/StatusChip";
import { AgentRecommendation } from "@/lib/agent/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { useWallet } from "@/components/auth/WalletContext";
import { NonCustodialPaymentModal } from "@/components/payments/NonCustodialPaymentModal";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { truncateHash } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";

export interface InvoiceAgentView {
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
  initialInvoices,
  initialRunsToday = 0,
  maxDailyRuns = 20,
  orgName,
  isAdmin = false,
}: {
  initialInvoices: InvoiceAgentView[];
  initialRunsToday?: number;
  maxDailyRuns?: number;
  orgName?: string | null;
  isAdmin?: boolean;
}) {
  const {
    address,
    isConnected,
    isAuthenticated,
    isCorrectNetwork,
    activeNetwork,
    connect,
    switchNetwork,
  } = useWallet();

  const [invoices, setInvoices] = useState<InvoiceAgentView[]>(initialInvoices);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(initialInvoices[0]?.id || "");
  const [runsUsed, setRunsUsed] = useState<number>(initialRunsToday);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [budgetNotice, setBudgetNotice] = useState<string | null>(null);

  // Live Wallet balances read from Arc
  const [walletUsdc, setWalletUsdc] = useState<string | null>(null);
  const [walletGas, setWalletGas] = useState<string | null>(null);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  // Non-Custodial Payment Modal state
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  // Admin Autonomous loop runner state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState("");
  const [adminDryRun, setAdminDryRun] = useState(false);
  const [isAdminExecuting, setIsAdminExecuting] = useState(false);
  const [adminRunError, setAdminRunError] = useState<string | null>(null);
  const [adminRunResult, setAdminRunResult] = useState<any | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showAdminModal) {
        setShowAdminModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAdminModal]);

  const selected = invoices.find((i) => i.id === selectedInvoiceId) || invoices[0];
  const rec = selected?.recommendation;

  // Fetch live wallet balances from Arc RPC directly
  const fetchLiveBalances = useCallback(async () => {
    if (!address) return;
    setIsRefreshingBalance(true);
    try {
      const publicClient = createPublicClient({
        chain: activeNetwork.chain,
        transport: http(activeNetwork.rpcUrl, { timeout: 12000 }),
      });

      const [usdcRaw, gasRaw] = await Promise.all([
        publicClient.readContract({
          address: activeNetwork.usdcAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        }),
        publicClient.getBalance({
          address: address as `0x${string}`,
        }),
      ]);

      setWalletUsdc(formatUsdc(usdcAtomic(usdcRaw)));
      setWalletGas(parseFloat(formatUnits(gasRaw, 18)).toFixed(4));
    } catch (err) {
      console.warn("Error reading wallet balances from Arc:", err);
    } finally {
      setIsRefreshingBalance(false);
    }
  }, [address, activeNetwork]);

  useEffect(() => {
    if (address) {
      fetchLiveBalances();
    }
  }, [address, fetchLiveBalances]);

  // Handle Triggering Advisory Agent Run (POST /api/agent/analyze)
  const handleAnalyzeMyInvoices = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setBudgetNotice(null);

    try {
      const res = await apiFetch("/api/agent/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        setAnalysisError(data.error || "Analysis failed.");
        return;
      }

      if (data.wallet?.usdcBalanceFormatted) {
        setWalletUsdc(data.wallet.usdcBalanceFormatted);
      }
      if (data.wallet?.nativeGasFormatted) {
        setWalletGas(parseFloat(data.wallet.nativeGasFormatted).toFixed(4));
      }
      if (data.stats?.orgDailyLlmUsed !== undefined) {
        setRunsUsed(data.stats.orgDailyLlmUsed);
      }
      if (data.budgetNotice) {
        setBudgetNotice(data.budgetNotice);
      }

      // Map recommendations back to open invoices view
      if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        const updatedInvoices: InvoiceAgentView[] = data.recommendations.map((r: any) => ({
          id: r.invoiceId,
          invoiceNumber: r.invoiceNumber,
          vendorName: r.vendorName,
          amountFormatted: r.amountFormatted,
          matchStatus: "verified",
          duplicateScore: 0,
          isInjectionSuspect: false,
          recommendation: {
            action: r.choice,
            confidence: 0.95,
            reasoning: Array.isArray(r.reasoning) ? r.reasoning : [r.reasoning],
            risks: [],
            policyAnticipation: {
              likelyPassed: r.choice === "pay_now",
              reasons: [],
            },
          },
        }));

        setInvoices(updatedInvoices);
        if (updatedInvoices.length > 0) {
          setSelectedInvoiceId(updatedInvoices[0].id);
        }
      }
    } catch (err: any) {
      setAnalysisError(err.message || "Failed to contact advisory agent.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Admin runner for builder-operated treasury loop
  const handleAdminExecuteRun = async () => {
    setIsAdminExecuting(true);
    setAdminRunError(null);
    setAdminRunResult(null);

    try {
      const res = await apiFetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passcode: adminPasscode.trim() || undefined,
          dryRun: adminDryRun,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAdminRunError(data.error || "Agent execution failed.");
      } else {
        setAdminRunResult(data.result);
      }
    } catch (err: any) {
      setAdminRunError(err.message || "Network error contacting agent run endpoint.");
    } finally {
      setIsAdminExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <span>AI Finance Agent</span>
            <span className="text-xs font-mono font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
              Advisory Copilot
            </span>
            {orgName && (
              <span className="text-xs font-normal text-ink-muted">
                — {orgName}
              </span>
            )}
          </h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Advises on payable obligations, discounts, and reserves. Proposes decisions without ever holding your private keys.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Analyze My Invoices Action */}
          <button
            onClick={handleAnalyzeMyInvoices}
            disabled={isAnalyzing || !isConnected}
            className="px-4 py-2 rounded-md bg-brand-teal text-white text-xs font-semibold hover:bg-brand-teal/90 disabled:opacity-50 transition-all shadow-xs flex items-center gap-2"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
            <span>{isAnalyzing ? "Analyzing Invoices..." : "Analyze My Invoices"}</span>
          </button>

          <Link
            href="/agent/decisions"
            className="px-3 py-2 rounded-md bg-white border border-border text-navy text-xs font-semibold hover:bg-canvas transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal" />
            <span>Agent Decisions</span>
          </Link>

          <Link
            href="/payments"
            className="px-3 py-2 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-xs flex items-center gap-1.5"
          >
            <span>Payment Desk</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          {/* Builder Admin Run Toggle */}
          {isAdmin && (
            <button
              onClick={() => {
                setShowAdminModal(true);
                setAdminRunError(null);
                setAdminRunResult(null);
              }}
              className="px-2.5 py-2 rounded-md border border-dashed border-amber-400 bg-amber-50 text-amber-800 text-xs font-mono hover:bg-amber-100 transition-colors flex items-center gap-1"
              title="Builder-Operated Treasury Loop (Admin Only)"
            >
              <Lock className="w-3 h-3 text-amber-700" />
              <span>Admin Runner</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Mandatory Non-Custodial Disclosure Banner */}
      <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/70 shadow-xs flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-sky-600 text-white shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="text-xs text-sky-900 leading-relaxed">
          <strong className="font-semibold text-sky-950">Non-Custodial Architecture: </strong>
          BizFlow never holds your keys or funds. Recommendations are advisory. Every payment requires your wallet signature. The agent cannot spend funds on your behalf.
        </div>
      </div>

      {/* 3. Connected Wallet Balance & AI Budget Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Connected Wallet USDC */}
        <div className="p-4 rounded-xl border border-border bg-surface shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-medium flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-brand-teal" />
              Payer Wallet USDC
            </span>
            <button
              onClick={fetchLiveBalances}
              disabled={isRefreshingBalance || !address}
              className="text-[11px] text-brand-teal hover:underline flex items-center gap-1"
              title="Refresh live on-chain balance"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshingBalance ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
          <div className="text-xl font-mono font-bold text-ink mt-2">
            {address ? (walletUsdc ? `${walletUsdc} USDC` : "Loading...") : "Wallet Disconnected"}
          </div>
          <span className="text-[11px] text-ink-muted mt-1 block truncate">
            {address ? truncateHash(address, 6, 4) : "Connect wallet to inspect balance"}
          </span>
        </div>

        {/* Native Arc Gas */}
        <div className="p-4 rounded-xl border border-border bg-surface shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-medium flex items-center gap-1.5">
              <CoinsIcon className="w-3.5 h-3.5 text-amber-500" />
              Arc Native Gas
            </span>
            <span className="text-[10px] font-mono uppercase text-ink-muted">
              {activeNetwork.name}
            </span>
          </div>
          <div className="text-xl font-mono font-bold text-ink mt-2">
            {address ? (walletGas !== null ? `${walletGas} GAS` : "Loading...") : "—"}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
            {address ? "Required for client-side transfer signing" : "Connect wallet"}
          </span>
        </div>

        {/* Advisory Runs Used Today */}
        <div className="p-4 rounded-xl border border-border bg-surface shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-medium flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-navy" />
              AI Advisory Budget
            </span>
            <span className="text-[10px] font-mono text-ink-muted">Free Beta Tier</span>
          </div>
          <div className="text-xl font-mono font-bold text-navy mt-2">
            {runsUsed} / {maxDailyRuns} runs today
          </div>
          <span className="text-[11px] text-ink-muted mt-1 block">
            {runsUsed >= maxDailyRuns
              ? "Daily limit reached (deterministic fallback active)"
              : `${maxDailyRuns - runsUsed} daily runs remaining`}
          </span>
        </div>
      </div>

      {budgetNotice && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>{budgetNotice}</span>
        </div>
      )}

      {analysisError && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-danger shrink-0" />
          <span>{analysisError}</span>
        </div>
      )}

      {/* 4. Main Analysis View */}
      {!isConnected ? (
        <EmptyState
          icon={Wallet}
          title="Connect Your Wallet"
          description="Connect your Web3 wallet to inspect your organization's open invoices, evaluate early-payment discounts, and review advisory recommendations."
          action={{
            label: "Connect Wallet",
            onClick: () => connect(),
          }}
        />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No Open Invoices Queued"
          description="Your organization has no pending invoices awaiting settlement. Enter a new invoice or upload a bill to receive advisory timing proposals."
          action={{
            label: "Enter An Invoice",
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
              <span>Open Payables Queue</span>
              <span>{invoices.length} Queued</span>
            </div>
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {invoices.map((inv) => {
                const isSelected = inv.id === selectedInvoiceId;
                const action = inv.recommendation.action;

                let actionBadge = "bg-emerald-50 text-emerald-800 border-emerald-300";
                let actionText = "Pay Now";
                if (action === "hold") {
                  actionBadge = "bg-rose-50 text-rose-800 border-rose-300";
                  actionText = "Hold";
                } else if (action === "schedule") {
                  actionBadge = "bg-sky-50 text-sky-800 border-sky-300";
                  actionText = "Schedule";
                } else if (action === "request_review") {
                  actionBadge = "bg-amber-50 text-amber-800 border-amber-300";
                  actionText = "Review";
                }

                return (
                  <div
                    key={inv.id}
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-brand-light/40 border-l-4 border-l-brand-teal"
                        : "hover:bg-canvas/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-ink">
                        {inv.invoiceNumber}
                      </span>
                      <span className="font-mono text-xs font-bold text-ink">
                        {inv.amountFormatted}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-ink-muted">{inv.vendorName}</div>

                    <div className="mt-2.5 flex items-center justify-between">
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${actionBadge}`}
                      >
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
                    <div className="p-2.5 rounded-lg bg-navy text-white">
                      <Bot className="w-5 h-5 text-brand-teal" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-ink flex items-center gap-2">
                        <span>Advisory Proposal: {selected.invoiceNumber}</span>
                      </h2>
                      <span className="text-xs text-ink-muted">
                        Supplier: <strong className="text-ink">{selected.vendorName}</strong> (
                        {selected.amountFormatted})
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleAnalyzeMyInvoices}
                    disabled={isAnalyzing}
                    className="px-3 py-1.5 rounded-md bg-canvas hover:bg-canvas-subtle border border-border text-xs font-medium text-ink transition-colors flex items-center gap-1.5 self-start sm:self-center"
                  >
                    <RotateCcw
                      className={`w-3.5 h-3.5 text-navy ${isAnalyzing ? "animate-spin" : ""}`}
                    />
                    <span>Re-evaluate</span>
                  </button>
                </div>

                {/* Action Banner */}
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    rec.action === "pay_now"
                      ? "bg-emerald-50 border-emerald-200"
                      : rec.action === "hold"
                      ? "bg-rose-50 border-rose-200"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  <div>
                    <div className="text-xs font-medium text-ink-muted uppercase tracking-wider">
                      Agent Recommendation
                    </div>
                    <div className="text-lg font-bold font-mono text-ink uppercase mt-0.5 flex items-center gap-2">
                      {rec.action === "pay_now" && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      )}
                      {rec.action === "hold" && <ShieldAlert className="w-5 h-5 text-rose-600" />}
                      {rec.action === "request_review" && (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      )}
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
                    <span>Advisory Reasoning Trail</span>
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

                {/* Policy Pre-check & Non-Custodial Sign Action */}
                <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-ink-muted">
                    Deterministic Policy:{" "}
                    <strong
                      className={
                        rec.policyAnticipation.likelyPassed ? "text-emerald-600" : "text-danger"
                      }
                    >
                      {rec.policyAnticipation.likelyPassed
                        ? "Pre-cleared for Settlement"
                        : "Anticipating Policy Rejection"}
                    </strong>
                  </div>

                  <div className="flex items-center gap-2">
                    {rec.action === "pay_now" ? (
                      <button
                        onClick={() => setPayingInvoiceId(selected.id)}
                        className="px-4 py-2 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Review & Sign Payment</span>
                      </button>
                    ) : (
                      <Link
                        href={`/payments`}
                        className="px-4 py-2 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        <span>View in Payment Desk</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-ink-muted border rounded-xl bg-surface">
                Select an invoice from the queue to inspect advisory details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Non-Custodial Client-Side Payment Modal */}
      {payingInvoiceId && (
        <NonCustodialPaymentModal
          isOpen={true}
          invoiceId={payingInvoiceId}
          onClose={() => setPayingInvoiceId(null)}
          onSuccess={(payment) => {
            // Remove settled invoice from queue
            setInvoices((prev) => prev.filter((i) => i.id !== payingInvoiceId));
            setPayingInvoiceId(null);
            fetchLiveBalances();
          }}
        />
      )}

      {/* Admin Autonomous Loop Runner Modal (Builder Only) */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm text-ink">Builder Treasury Autonomous Loop</h3>
              </div>
              <button
                onClick={() => setShowAdminModal(false)}
                className="text-ink-muted hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              Triggers the server treasury runner for the builder admin org. Strictly forbidden for public non-custodial businesses.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-ink block">Owner Passcode</label>
                <input
                  type="password"
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  placeholder="Enter OWNER_PASSCODE"
                  className="w-full px-3 py-1.5 text-xs rounded border border-border bg-canvas font-mono text-ink focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={adminDryRun}
                  onChange={(e) => setAdminDryRun(e.target.checked)}
                  className="rounded border-border text-brand-teal focus:ring-brand-teal"
                />
                <span>DRY_RUN mode (Estimate gas, do not broadcast)</span>
              </label>

              {adminRunError && (
                <div className="p-2.5 rounded bg-danger/10 border border-danger/20 text-danger text-xs">
                  {adminRunError}
                </div>
              )}

              {adminRunResult && (
                <div className="p-3 rounded bg-success/10 border border-success/30 text-ink text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-success">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Run Completed ({adminRunResult.mode} mode)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>Evaluated: <strong>{adminRunResult.invoicesEvaluated}</strong></div>
                    <div>Auto-Executed: <strong>{adminRunResult.autoExecutedCount}</strong></div>
                    <div>Volume: <strong>{adminRunResult.totalVolumeExecutedUsdc} USDC</strong></div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowAdminModal(false)}
                className="px-3 py-1.5 text-xs text-ink-muted hover:text-ink font-medium"
              >
                Close
              </button>
              <button
                onClick={handleAdminExecuteRun}
                disabled={isAdminExecuting}
                className="px-4 py-1.5 rounded bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAdminExecuting ? "Running..." : "Execute Admin Run"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CoinsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="m7 6 1 1" />
      <path d="m14 14 1 1" />
    </svg>
  );
}
