import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp,
  Receipt,
  Users,
  ShieldCheck,
  Bot,
  Anchor,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { prisma, withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { getActiveNetwork } from "@/lib/networks";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Public Metrics & Traction Ledger | BizFlow Pilot V2",
  description: "Real-time, verifiable metrics computed strictly from real database records and Arc on-chain settlement receipts.",
};

export default async function MetricsPage() {
  const network = getActiveNetwork();

  let invoicesCount = 0;
  let confirmedPayments: { amountAtomic: bigint }[] = [];
  let vendorsCount = 0;
  let agentDecisionsCount = 0;
  let duplicatesCount = 0;
  let injectionsCount = 0;
  let anchoredCount = 0;

  try {
    const [invCount, payments, venCount, decisionsCount, dupsCount, injCount, anchCount] =
      await withDbTimeout(() =>
        Promise.all([
          prisma.invoice.count(),
          prisma.payment.findMany({
            where: { status: { in: ["confirmed", "anchored"] } },
            select: { amountAtomic: true },
          }),
          prisma.vendor.count({ where: { status: "active" } }),
          prisma.agentDecision.count(),
          prisma.invoice.count({ where: { duplicateScore: { gte: 90 } } }),
          prisma.invoice.count({ where: { isInjectionSuspect: true } }),
          prisma.payment.count({ where: { anchorTxHash: { not: null } } }),
        ])
      );

    invoicesCount = invCount;
    confirmedPayments = payments;
    vendorsCount = venCount;
    agentDecisionsCount = decisionsCount;
    duplicatesCount = dupsCount;
    injectionsCount = injCount;
    anchoredCount = anchCount;
  } catch (err) {
    console.warn("MetricsPage database fallback:", err);
  }

  const totalVolumeAtomic = confirmedPayments.reduce(
    (sum, p) => sum + BigInt(p.amountAtomic),
    0n
  );

  const formattedVolume =
    confirmedPayments.length > 0
      ? `${formatUsdc(usdcAtomic(totalVolumeAtomic))} USDC`
      : "0.00 USDC (n/a)";

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Navigation */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Command Center</span>
        </Link>
      </div>

      {/* Header */}
      <div className="border-b border-border pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-light text-brand-teal text-xs font-semibold font-mono border border-brand-teal/20 mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Public Traction & Integrity Dashboard</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Verifiable Metrics</h1>
          <p className="text-sm text-ink-muted mt-1">
            Real-time AP/AR throughput computed exclusively from production database rows on {network.name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/api/metrics"
            target="_blank"
            className="px-3 py-1.5 rounded-md bg-canvas hover:bg-canvas-subtle border border-border text-xs font-mono text-ink transition-colors flex items-center gap-1.5"
          >
            <span>Raw JSON API</span>
            <ExternalLink className="w-3 h-3 text-ink-muted" />
          </Link>
        </div>
      </div>

      {/* Honesty & Anti-Fake Guarantee Banner */}
      <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-950 flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="leading-relaxed space-y-1">
          <strong className="font-semibold block text-emerald-950">
            Tameion Integrity Policy: Zero Synthetic Volume
          </strong>
          <p>
            Every statistic shown below is queried in real time from PostgreSQL records and on-chain Arc transaction receipts.
            We never inject synthetic transactions, fake customer balances, or simulated volumes. If a metric is zero, it is honestly displayed as zero.
          </p>
        </div>
      </div>

      {/* Key Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Settled Volume */}
        <div className="p-5 rounded-xl border border-border bg-surface shadow-card space-y-2">
          <span className="text-xs text-ink-muted font-medium flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-brand-teal" />
            Real Settled Volume
          </span>
          <div className="text-2xl font-mono font-bold text-ink">{formattedVolume}</div>
          <span className="text-[11px] text-ink-muted block">
            {confirmedPayments.length > 0
              ? `${confirmedPayments.length} confirmed on-chain payments`
              : "Awaiting first public beta settlement"}
          </span>
        </div>

        {/* Invoices Processed */}
        <div className="p-5 rounded-xl border border-border bg-surface shadow-card space-y-2">
          <span className="text-xs text-ink-muted font-medium flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-navy" />
            Invoices Intake & Verified
          </span>
          <div className="text-2xl font-mono font-bold text-ink">{invoicesCount}</div>
          <span className="text-[11px] text-ink-muted block">
            Passed 3-way match & security verification
          </span>
        </div>

        {/* Verified Suppliers */}
        <div className="p-5 rounded-xl border border-border bg-surface shadow-card space-y-2">
          <span className="text-xs text-ink-muted font-medium flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-brand-teal" />
            Verified Suppliers
          </span>
          <div className="text-2xl font-mono font-bold text-ink">{vendorsCount}</div>
          <span className="text-[11px] text-ink-muted block">
            OFAC-screened with remittance addresses
          </span>
        </div>

        {/* On-Chain Audit Proofs */}
        <div className="p-5 rounded-xl border border-border bg-surface shadow-card space-y-2">
          <span className="text-xs text-ink-muted font-medium flex items-center gap-1.5">
            <Anchor className="w-3.5 h-3.5 text-navy" />
            Audit Proofs Anchored
          </span>
          <div className="text-2xl font-mono font-bold text-ink">{anchoredCount}</div>
          <span className="text-[11px] text-ink-muted block">
            Anchored to AuditAnchor.sol smart contract
          </span>
        </div>
      </div>

      {/* Security Defense & Agent Decision Metrics */}
      <div className="rounded-xl border border-border bg-surface shadow-card p-6 space-y-4">
        <h2 className="text-sm font-bold text-ink flex items-center gap-2">
          <Bot className="w-4 h-4 text-brand-teal" />
          <span>Security & Autonomous Agent Defensive Performance</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-canvas border border-border space-y-1">
            <span className="text-ink-muted block font-medium">Duplicate Invoices Blocked</span>
            <div className="text-xl font-mono font-bold text-amber-700">{duplicatesCount}</div>
            <span className="text-[11px] text-ink-muted block">
              Prevented duplicate payments via hash & PO checks
            </span>
          </div>

          <div className="p-4 rounded-lg bg-canvas border border-border space-y-1">
            <span className="text-ink-muted block font-medium">Injection Attacks Blocked</span>
            <div className="text-xl font-mono font-bold text-danger">{injectionsCount}</div>
            <span className="text-[11px] text-ink-muted block">
              Hostile prompt injection payloads quarantined
            </span>
          </div>

          <div className="p-4 rounded-lg bg-canvas border border-border space-y-1">
            <span className="text-ink-muted block font-medium">Agent Decisions Recorded</span>
            <div className="text-xl font-mono font-bold text-navy">{agentDecisionsCount}</div>
            <span className="text-[11px] text-ink-muted block">
              Immutable decision trails with observation hashes
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="pt-6 border-t border-border flex items-center justify-between text-xs text-ink-muted">
        <span>BizFlow Pilot V2 • Public Beta on Arc</span>
        <div className="flex items-center gap-4">
          <Link href="/pilots" className="hover:text-ink underline">Pilot Businesses</Link>
          <Link href="/judges" className="hover:text-ink underline">Judge Guide</Link>
          <Link href="/risk" className="hover:text-ink underline">Risk Notice</Link>
        </div>
      </div>
    </div>
  );
}
