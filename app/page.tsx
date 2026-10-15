import React from "react";
import Link from "next/link";
import {
  CreditCard,
  ReceiptText,
  AlertOctagon,
  ShieldCheck,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Layers,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { getCommandCenterData } from "@/lib/data";
import { getActiveNetwork } from "@/lib/networks";
import { getTreasuryPublicAddress, getSanitizedPaymentProvider } from "@/lib/treasury";
import { getTreasuryBalances } from "@/lib/balances";
import { StatusChip, HashView } from "@/components/ui/StatusChip";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveProofCard } from "@/components/common/LiveProofCard";
import { Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Command Center | BizFlow Pilot V2",
  description: "Real-time corporate treasury overview, policy guardrails, and Arc settlement activity.",
};

export default async function CommandCenterPage() {
  const data = await getCommandCenterData();
  const network = getActiveNetwork();
  const treasuryAddress = getTreasuryPublicAddress();
  const paymentProvider = getSanitizedPaymentProvider();
  const treasuryBalances = await getTreasuryBalances();

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Command Center</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Real-time corporate treasury overview, policy guardrails, and Arc settlement activity.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Building2}
          title="Welcome to BizFlow Pilot V2"
          description="Get started by connecting your Web3 wallet, setting up your business profile, and registering suppliers for verified USDC settlement on Arc."
          action={{
            label: "Onboard Business",
            href: "/onboarding",
          }}
          secondaryAction={{
            label: "Explore Judge Guide",
            href: "/judges",
          }}
        />
      </div>
    );
  }

  const latestConfirmedPayment = data.recentPayments.find((p) => p.status === "confirmed") || null;

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Command Center</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Real-time corporate treasury overview, policy guardrails, and Arc settlement activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/invoices"
            className="px-3.5 py-1.5 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-xs flex items-center gap-1.5"
          >
            <ReceiptText className="w-3.5 h-3.5" />
            <span>Process Invoices</span>
          </Link>
          <Link
            href="/payments"
            className="px-3.5 py-1.5 rounded-md bg-brand-teal text-white text-xs font-semibold hover:bg-brand-hover transition-colors shadow-xs flex items-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Payment Desk</span>
          </Link>
        </div>
      </div>

      {/* Live Proof Card (Real On-Chain Settlement) */}
      <LiveProofCard payment={latestConfirmedPayment} explorerUrl={network.explorerUrl} />

      {/* Autonomous Agency & Decision Metrics (Tameion V2 Real Rows) */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-teal animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-navy">
              Autonomous Agency & Decision Metrics
            </h2>
          </div>
          <Link
            href="/agent/decisions"
            className="text-[11px] font-semibold text-brand-teal hover:underline flex items-center gap-1"
          >
            <span>View Full Decision Log</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs">
          <div className="p-2.5 rounded-lg bg-canvas border border-border">
            <span className="text-[10px] text-ink-muted uppercase font-semibold block">Invoices Processed</span>
            <span className="text-base font-bold font-mono text-ink block mt-0.5">{data.decisionMetrics?.invoicesProcessed ?? "n/a"}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-canvas border border-border">
            <span className="text-[10px] text-ink-muted uppercase font-semibold block">Settled Volume</span>
            <span className="text-base font-bold font-mono text-navy block mt-0.5">{data.decisionMetrics?.paymentVolumeUsdc ?? "n/a"}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-canvas border border-border">
            <span className="text-[10px] text-ink-muted uppercase font-semibold block">Duplicates Caught</span>
            <span className="text-base font-bold font-mono text-amber-700 block mt-0.5">{data.decisionMetrics?.duplicatesCaught ?? "0"}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-canvas border border-border">
            <span className="text-[10px] text-ink-muted uppercase font-semibold block">Injections Blocked</span>
            <span className="text-base font-bold font-mono text-danger block mt-0.5">{data.decisionMetrics?.injectionAttemptsBlocked ?? "0"}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-canvas border border-border">
            <span className="text-[10px] text-ink-muted uppercase font-semibold block">Decisions Made</span>
            <span className="text-base font-bold font-mono text-ink block mt-0.5">{data.decisionMetrics?.decisionsMade ?? "n/a"}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-canvas border border-border">
            <span className="text-[10px] text-ink-muted uppercase font-semibold block">Auto-Executed</span>
            <span className="text-base font-bold font-mono text-success block mt-0.5">{data.decisionMetrics?.autoExecuted ?? "n/a"}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-canvas border border-border">
            <span className="text-[10px] text-ink-muted uppercase font-semibold block">Escalated</span>
            <span className="text-base font-bold font-mono text-brand-teal block mt-0.5">{data.decisionMetrics?.escalated ?? "n/a"}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-canvas border border-border">
            <span className="text-[10px] text-ink-muted uppercase font-semibold block">Agreement Rate</span>
            <span className="text-base font-bold font-mono text-purple-700 block mt-0.5">{data.decisionMetrics?.humanAgreementRate ?? "n/a"}</span>
          </div>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Treasury Balance */}
        <div className="p-4 rounded-xl border border-border bg-surface shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">USDC Balance</span>
            <div className="p-1.5 rounded-md bg-brand-light text-brand-teal">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-ink">
              {treasuryBalances.usdcFormatted} <span className="text-xs font-sans text-brand-teal font-semibold">USDC</span>
            </div>
            <div className="text-[11px] text-ink-muted mt-1 leading-snug">
              Arc uses USDC as the gas token, so this single balance covers gas and payments.
            </div>
            {treasuryBalances.isLive && (
              <div className="mt-2 text-[10px] text-emerald-600 font-medium flex items-center justify-between border-t border-border/60 pt-1.5">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Arc RPC Live</span>
                </div>
                <span className="font-mono text-ink-muted">Gas: {treasuryBalances.gasFormatted}</span>
              </div>
            )}
          </div>
        </div>

        {/* Pending Invoices / Due Bills */}
        <div className="p-4 rounded-xl border border-border bg-surface shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">Verified Payables</span>
            <div className="p-1.5 rounded-md bg-navy/10 text-navy">
              <ReceiptText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-ink">
              {data.metrics.upcomingBillsFormatted}
            </div>
            <div className="text-[11px] text-ink-muted mt-1 leading-snug">
              <div>
                {data.metrics.awaitingSettlementCount}{" "}
                {data.metrics.awaitingSettlementCount === 1 ? "invoice" : "invoices"} awaiting settlement
              </div>
              <div className="text-ink font-medium mt-0.5">
                {data.metrics.settledFormatted} settled to date
              </div>
            </div>
          </div>
        </div>

        {/* Policy & Review Gate */}
        <div className="p-4 rounded-xl border border-border bg-surface shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">Action Required</span>
            <div className="p-1.5 rounded-md bg-warning-light text-warning">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-ink">
              {data.metrics.actionRequiredCount}{" "}
              <span className="text-xs font-sans font-normal text-ink-muted">
                {data.metrics.actionRequiredCount === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="text-[11px] text-warning font-medium mt-1 leading-snug">
              {data.metrics.blockedCount > 0 && `${data.metrics.blockedCount} policy-blocked`}
              {data.metrics.blockedCount > 0 && data.metrics.reviewRequiredCount > 0 && " · "}
              {data.metrics.reviewRequiredCount > 0 && `${data.metrics.reviewRequiredCount} review-required`}
              {data.metrics.actionRequiredCount === 0 && "All clear — 0 anomalies"}
            </div>
          </div>
        </div>

        {/* Policy Guard & Kill Switch */}
        <div className="p-4 rounded-xl border border-border bg-surface shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">Policy Engine</span>
            <div className="p-1.5 rounded-md bg-success-light text-success">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-success flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Enforcing 10 Rules
              </span>
            </div>
            <div className="text-[11px] text-ink-muted mt-1 font-mono">
              Kill Switch: {data.settings.killSwitchActive ? "ARMED (HALTED)" : "DISARMED (ACTIVE)"}
            </div>
          </div>
        </div>
      </div>

      {/* Activity-to-Payment Proof Chain Architecture Callout */}
      <div className="p-4 rounded-xl border border-brand-teal/30 bg-gradient-to-r from-brand-light/60 to-surface flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-navy text-white mt-0.5">
            <Layers className="w-5 h-5 text-brand-teal" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Activity-to-Payment Cryptographic Proof Chain</h3>
            <p className="text-xs text-ink-muted mt-0.5 max-w-2xl leading-relaxed">
              Every payment binds <strong>Purchase Order</strong> &rarr; <strong>Warehouse Goods Receipt</strong> &rarr; <strong>3-Way Match</strong> &rarr; <strong>AI Agent Reasoning</strong> &rarr; <strong>Deterministic Policy Gate</strong> &rarr; <strong>Arc USDC Settlement</strong> &rarr; <strong>AuditAnchor.sol</strong>.
            </p>
          </div>
        </div>
        <Link
          href="/audit"
          className="px-3 py-1.5 rounded-md bg-white border border-border text-xs font-semibold text-navy hover:bg-canvas transition-colors shadow-2xs whitespace-nowrap flex items-center gap-1.5 self-start md:self-center"
        >
          <span>Inspect Hash Chain</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Main Split: Invoices Queue + Settlement Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoices Queue (2 Columns) */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ReceiptText className="w-4 h-4 text-navy" />
              <h2 className="text-sm font-semibold text-ink">Invoice Desk & Match Queue</h2>
            </div>
            <Link
              href="/invoices"
              className="text-xs text-navy font-medium hover:text-brand-teal transition-colors flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-border">
            {data.recentInvoices.map((inv) => (
              <div key={inv.id} className="p-4 hover:bg-canvas/50 transition-colors flex items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-ink">{inv.invoiceNumber}</span>
                    <StatusChip status={inv.status} />
                    {inv.isInjectionSuspect && <StatusChip status="injection_suspect" label="Injection Threat" />}
                  </div>
                  <div className="text-xs text-ink-muted truncate">
                    Vendor: <span className="font-medium text-ink">{inv.vendorName}</span>
                  </div>
                </div>

                <div className="text-right whitespace-nowrap">
                  <div className="text-sm font-mono font-bold text-ink">{inv.amountFormatted}</div>
                  <div className="text-[11px] text-ink-muted">
                    Match: <span className="capitalize font-medium">{inv.matchStatus.replace("_", " ")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Arc Network & Provider Monitor (1 Column) */}
        <div className="rounded-xl border border-border bg-surface shadow-card p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Cpu className="w-4 h-4 text-navy" />
            <h2 className="text-sm font-semibold text-ink">Settlement Infrastructure</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-canvas border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Target Blockchain</span>
                <span className="font-semibold text-navy">{network.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Chain ID</span>
                <span className="font-mono text-ink font-bold">{network.chainId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Gas Asset</span>
                <span className="font-mono text-ink font-semibold">USDC (Native)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Settlement Provider</span>
                <span className="font-mono text-brand-teal font-semibold uppercase">
                  {paymentProvider}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Treasury Account</span>
                <span className="font-mono text-[11px] text-ink font-semibold" title={treasuryAddress}>
                  {treasuryAddress.slice(0, 6)}...{treasuryAddress.slice(-4)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-border space-y-1.5">
              <div className="flex items-center gap-1.5 text-ink font-semibold">
                <Lock className="w-3.5 h-3.5 text-navy" />
                <span>Security Principle</span>
              </div>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                The AI Agent proposes. A deterministic policy engine decides. The LLM never holds keys and cannot trigger the payment adapter.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/simulator"
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-canvas hover:bg-canvas-subtle border border-border text-xs font-semibold text-ink transition-colors"
              >
                <span>Launch Policy Simulator</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
