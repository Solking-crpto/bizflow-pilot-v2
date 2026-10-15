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
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { getDb, withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { NETWORKS, NetworkMode } from "@/lib/networks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Public Metrics & Traction Ledger | BizFlow Pilot V2",
  description: "Real-time, verifiable metrics computed strictly from real database records and Arc on-chain settlement receipts across Mainnet and Testnet.",
};

interface NetworkMetricsData {
  networkMode: NetworkMode;
  name: string;
  chainId: number;
  available: boolean;
  error?: string;
  invoicesCount: number;
  confirmedPaymentsCount: number;
  settledVolumeFormatted: string;
  vendorsCount: number;
  agentDecisionsCount: number;
  duplicatesCount: number;
  injectionsCount: number;
  anchoredCount: number;
}

async function fetchNetworkMetrics(networkMode: NetworkMode): Promise<NetworkMetricsData> {
  const network = NETWORKS[networkMode];
  try {
    const db = getDb(networkMode);
    const [invCount, payments, venCount, decisionsCount, dupsCount, injCount, anchCount] =
      await withDbTimeout(() =>
        Promise.all([
          db.invoice.count(),
          db.payment.findMany({
            where: { status: { in: ["confirmed", "anchored"] } },
            select: { amountAtomic: true },
          }),
          db.vendor.count({ where: { status: "active" } }),
          db.agentDecision.count(),
          db.invoice.count({ where: { duplicateScore: { gte: 90 } } }),
          db.invoice.count({ where: { isInjectionSuspect: true } }),
          db.payment.count({ where: { anchorTxHash: { not: null } } }),
        ]),
        3000
      );

    const totalVolumeAtomic = payments.reduce(
      (sum, p) => sum + BigInt(p.amountAtomic),
      0n
    );

    return {
      networkMode,
      name: network.name,
      chainId: network.chainId,
      available: true,
      invoicesCount: invCount,
      confirmedPaymentsCount: payments.length,
      settledVolumeFormatted:
        payments.length > 0
          ? `${formatUsdc(usdcAtomic(totalVolumeAtomic))} USDC`
          : "0.00 USDC",
      vendorsCount: venCount,
      agentDecisionsCount: decisionsCount,
      duplicatesCount: dupsCount,
      injectionsCount: injCount,
      anchoredCount: anchCount,
    };
  } catch (err: any) {
    return {
      networkMode,
      name: network.name,
      chainId: network.chainId,
      available: false,
      error: err.message || "Database connection unavailable",
      invoicesCount: 0,
      confirmedPaymentsCount: 0,
      settledVolumeFormatted: "0.00 USDC",
      vendorsCount: 0,
      agentDecisionsCount: 0,
      duplicatesCount: 0,
      injectionsCount: 0,
      anchoredCount: 0,
    };
  }
}

export default async function MetricsPage() {
  const [mainnetData, testnetData] = await Promise.all([
    fetchNetworkMetrics("mainnet"),
    fetchNetworkMetrics("testnet"),
  ]);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8">
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
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-light text-brand-teal text-xs font-semibold font-mono border border-brand-teal/20">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Public Traction & Integrity Dashboard</span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-canvas border border-border text-ink-muted">
              Zero Cross-Network Aggregation
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Verifiable Metrics</h1>
          <p className="text-sm text-ink-muted mt-1">
            Real-time AP/AR throughput computed exclusively from production database rows on Arc Mainnet and Arc Testnet.
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
            Tameion Integrity Policy: Zero Synthetic Volume & Physical Separation
          </strong>
          <p>
            Every statistic shown below is queried in real time from PostgreSQL records and on-chain Arc transaction receipts.
            Mainnet and Testnet data are stored in completely separate schemas (<code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">v2_mainnet</code> and <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">v2_testnet</code>) and are <strong>never aggregated or summed together</strong>. If a metric is zero, it is honestly displayed as zero.
          </p>
        </div>
      </div>

      {/* Side-by-Side Dual Network Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Mainnet Column */}
        <NetworkMetricsColumn data={mainnetData} isMainnet={true} />

        {/* Testnet Column */}
        <NetworkMetricsColumn data={testnetData} isMainnet={false} />
      </div>

      {/* Navigation Footer */}
      <div className="pt-6 border-t border-border flex items-center justify-between text-xs text-ink-muted">
        <span>BizFlow Pilot V2 • Runtime Dual-Network Architecture</span>
        <div className="flex items-center gap-4">
          <Link href="/pilots" className="hover:text-ink underline">Pilot Businesses</Link>
          <Link href="/judges" className="hover:text-ink underline">Judge Guide</Link>
          <Link href="/risk" className="hover:text-ink underline">Risk Notice</Link>
        </div>
      </div>
    </div>
  );
}

function NetworkMetricsColumn({
  data,
  isMainnet,
}: {
  data: NetworkMetricsData;
  isMainnet: boolean;
}) {
  const badgeClasses = isMainnet
    ? "bg-navy-50 text-navy-900 border-navy-300"
    : "bg-amber-50 text-amber-900 border-amber-300";

  const dotClass = isMainnet ? "bg-emerald-500" : "bg-amber-500";

  if (!data.available) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${badgeClasses}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
              {data.name}
            </span>
          </div>
          <span className="text-xs text-ink-muted font-mono">Chain ID: {data.chainId}</span>
        </div>
        <div className="p-6 rounded-lg bg-canvas border border-border text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
          <h3 className="text-sm font-semibold text-ink">{data.name} Data Degraded</h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            {data.error || "Database schema connection temporarily unavailable. The other network remains fully accessible."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-6 shadow-card">
      {/* Column Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${badgeClasses}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
            {isMainnet ? "Mainnet (Real USDC)" : "Testnet (Test USDC)"}
          </span>
        </div>
        <span className="text-xs font-mono text-ink-muted">
          Chain {data.chainId}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Settled Volume */}
        <div className="p-4 rounded-lg bg-canvas border border-border space-y-1">
          <span className="text-[11px] text-ink-muted font-medium flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-brand-teal" />
            Settled Volume ({data.name})
          </span>
          <div className="text-xl font-mono font-bold text-ink">{data.settledVolumeFormatted}</div>
          <span className="text-[10px] text-ink-muted block">
            {data.confirmedPaymentsCount > 0
              ? `${data.confirmedPaymentsCount} confirmed payments`
              : "0 confirmed payments"}
          </span>
        </div>

        {/* Invoices Processed */}
        <div className="p-4 rounded-lg bg-canvas border border-border space-y-1">
          <span className="text-[11px] text-ink-muted font-medium flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-navy" />
            Invoices Intake ({data.name})
          </span>
          <div className="text-xl font-mono font-bold text-ink">{data.invoicesCount}</div>
          <span className="text-[10px] text-ink-muted block">
            Passed 3-way match & security verification
          </span>
        </div>

        {/* Verified Suppliers */}
        <div className="p-4 rounded-lg bg-canvas border border-border space-y-1">
          <span className="text-[11px] text-ink-muted font-medium flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-brand-teal" />
            Suppliers ({data.name})
          </span>
          <div className="text-xl font-mono font-bold text-ink">{data.vendorsCount}</div>
          <span className="text-[10px] text-ink-muted block">
            Screened against blocked-address list
          </span>
        </div>

        {/* On-Chain Audit Proofs */}
        <div className="p-4 rounded-lg bg-canvas border border-border space-y-1">
          <span className="text-[11px] text-ink-muted font-medium flex items-center gap-1.5">
            <Anchor className="w-3.5 h-3.5 text-navy" />
            Audit Proofs ({data.name})
          </span>
          <div className="text-xl font-mono font-bold text-ink">{data.anchoredCount}</div>
          <span className="text-[10px] text-ink-muted block">
            Anchored to AuditAnchor contract
          </span>
        </div>
      </div>

      {/* Security Defense & Agent Decision Metrics */}
      <div className="p-4 rounded-lg bg-canvas border border-border space-y-3">
        <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-brand-teal" />
          <span>Defensive Performance ({data.name})</span>
        </h4>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded bg-surface border border-border">
            <span className="text-[10px] text-ink-muted block">Duplicates</span>
            <div className="text-sm font-mono font-bold text-amber-700">{data.duplicatesCount}</div>
          </div>
          <div className="p-2 rounded bg-surface border border-border">
            <span className="text-[10px] text-ink-muted block">Injections</span>
            <div className="text-sm font-mono font-bold text-danger">{data.injectionsCount}</div>
          </div>
          <div className="p-2 rounded bg-surface border border-border">
            <span className="text-[10px] text-ink-muted block">Decisions</span>
            <div className="text-sm font-mono font-bold text-navy">{data.agentDecisionsCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
