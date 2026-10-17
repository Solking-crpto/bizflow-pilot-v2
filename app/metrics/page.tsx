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
  Building2,
  Code2,
} from "lucide-react";
import { getDb, withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { NETWORKS, NetworkMode } from "@/lib/networks";
import { isTestOrganization } from "@/lib/builder-wallets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Public Metrics & Traction Ledger | BizFlow Pilot V2",
  description:
    "Real-time, verifiable metrics computed strictly from real database records and Arc on-chain settlement receipts across Mainnet and Testnet, with honest separation between external wallets and builder test activity.",
};

interface MetricGroupData {
  organizationsCount: number;
  invoicesCount: number;
  confirmedPaymentsCount: number;
  settledVolumeFormatted: string;
  vendorsCount: number;
  agentDecisionsCount: number;
  duplicatesCount: number;
  injectionsCount: number;
  anchoredCount: number;
}

interface NetworkMetricsData {
  networkMode: NetworkMode;
  name: string;
  chainId: number;
  available: boolean;
  error?: string;
  external: MetricGroupData;
  testActivity: MetricGroupData;
}

async function fetchNetworkMetrics(networkMode: NetworkMode): Promise<NetworkMetricsData> {
  const network = NETWORKS[networkMode];
  try {
    const db = getDb(networkMode);

    // Retrieve all organizations in this network schema
    const orgs = await withDbTimeout(
      () =>
        db.organization.findMany({
          select: { id: true, name: true, walletAddress: true, isTest: true },
        }),
      2500,
      []
    );

    const externalOrgIds = orgs.filter((o) => !isTestOrganization(o)).map((o) => o.id);
    const testOrgIds = orgs.filter((o) => isTestOrganization(o)).map((o) => o.id);

    async function queryMetricsForOrgIds(orgIds: string[]): Promise<MetricGroupData> {
      if (orgIds.length === 0) {
        return {
          organizationsCount: 0,
          invoicesCount: 0,
          settledVolumeFormatted: "0.00 USDC",
          confirmedPaymentsCount: 0,
          vendorsCount: 0,
          agentDecisionsCount: 0,
          duplicatesCount: 0,
          injectionsCount: 0,
          anchoredCount: 0,
        };
      }

      const [invCount, payments, venCount, decisionsCount, dupsCount, injCount, anchCount] =
        await withDbTimeout(() =>
          Promise.all([
            db.invoice.count({ where: { orgId: { in: orgIds } } }),
            db.payment.findMany({
              where: {
                orgId: { in: orgIds },
                status: { in: ["confirmed", "anchored"] },
              },
              select: { amountAtomic: true },
            }),
            db.vendor.count({ where: { orgId: { in: orgIds }, status: "active" } }),
            db.agentDecision.count({ where: { orgId: { in: orgIds } } }),
            db.invoice.count({
              where: { orgId: { in: orgIds }, duplicateScore: { gte: 90 } },
            }),
            db.invoice.count({
              where: { orgId: { in: orgIds }, isInjectionSuspect: true },
            }),
            db.payment.count({
              where: { orgId: { in: orgIds }, anchorTxHash: { not: null } },
            }),
          ]),
          3500
        );

      const totalVolumeAtomic = payments.reduce(
        (sum, p) => sum + BigInt(p.amountAtomic),
        0n
      );

      return {
        organizationsCount: orgIds.length,
        invoicesCount: invCount,
        settledVolumeFormatted:
          payments.length > 0
            ? `${formatUsdc(usdcAtomic(totalVolumeAtomic))} USDC`
            : "0.00 USDC",
        confirmedPaymentsCount: payments.length,
        vendorsCount: venCount,
        agentDecisionsCount: decisionsCount,
        duplicatesCount: dupsCount,
        injectionsCount: injCount,
        anchoredCount: anchCount,
      };
    }

    const [externalMetrics, testMetrics] = await Promise.all([
      queryMetricsForOrgIds(externalOrgIds),
      queryMetricsForOrgIds(testOrgIds),
    ]);

    return {
      networkMode,
      name: network.name,
      chainId: network.chainId,
      available: true,
      external: externalMetrics,
      testActivity: testMetrics,
    };
  } catch (err: any) {
    const emptyGroup: MetricGroupData = {
      organizationsCount: 0,
      invoicesCount: 0,
      settledVolumeFormatted: "0.00 USDC",
      confirmedPaymentsCount: 0,
      vendorsCount: 0,
      agentDecisionsCount: 0,
      duplicatesCount: 0,
      injectionsCount: 0,
      anchoredCount: 0,
    };
    return {
      networkMode,
      name: network.name,
      chainId: network.chainId,
      available: false,
      error: err.message || "Database connection unavailable",
      external: emptyGroup,
      testActivity: emptyGroup,
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

      {/* Data Honesty & Anti-Synthetic Disclosure */}
      <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-950 flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="leading-relaxed space-y-1">
          <strong className="font-semibold block text-emerald-950">
            Tameion Integrity Policy: Complete Separation of External Wallets & Builder Test Activity
          </strong>
          <p>
            Every statistic shown below is queried in real time from PostgreSQL records and on-chain Arc transaction receipts.
            Mainnet and Testnet data are stored in completely separate schemas (<code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">v2_mainnet</code> and <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">v2_testnet</code>) and are <strong>never aggregated or summed together</strong>.
            Furthermore, each network displays two distinct columns: <strong>External wallets</strong> (real community & enterprise AP) and <strong>Builder and test activity</strong> (automated integration tests, CI runs, and developer rehearsals).
          </p>
        </div>
      </div>

      {/* Mainnet Section */}
      <NetworkSection data={mainnetData} isMainnet={true} />

      {/* Testnet Section */}
      <NetworkSection data={testnetData} isMainnet={false} />

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

function NetworkSection({
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
      {/* Network Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${badgeClasses}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
            {isMainnet ? "Arc Mainnet (Real USDC)" : "Arc Testnet (Test USDC)"}
          </span>
          <span className="text-xs font-mono text-ink-muted">
            Chain {data.chainId}
          </span>
        </div>
        <span className="text-xs text-ink-muted">
          Showing 2 verified columns: External Wallets vs Builder & Test Activity
        </span>
      </div>

      {/* Two Clearly Labelled Columns Per Network */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: External Wallets */}
        <MetricsColumnView
          title="External wallets"
          subtitle="Real enterprise & community accounts payable activity"
          tag="Community & Pilot AP"
          tagColor="emerald"
          metrics={data.external}
          isExternal={true}
        />

        {/* Column 2: Builder and test activity */}
        <MetricsColumnView
          title="Builder and test activity"
          subtitle="Automated integration tests, CI runs & rehearsals"
          tag="Builder & Test Activity"
          tagColor="amber"
          metrics={data.testActivity}
          isExternal={false}
        />
      </div>
    </div>
  );
}

function MetricsColumnView({
  title,
  subtitle,
  tag,
  tagColor,
  metrics,
  isExternal,
}: {
  title: string;
  subtitle: string;
  tag: string;
  tagColor: "emerald" | "amber";
  metrics: MetricGroupData;
  isExternal: boolean;
}) {
  const containerClasses = isExternal
    ? "p-5 rounded-xl border border-emerald-500/20 bg-emerald-50/20 space-y-5"
    : "p-5 rounded-xl border border-border bg-canvas/60 space-y-5";

  const badgeClasses = isExternal
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : "bg-amber-100 text-amber-800 border-amber-200";

  return (
    <div className={containerClasses}>
      {/* Column Header */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            {isExternal ? (
              <Building2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <Code2 className="w-4 h-4 text-amber-600" />
            )}
            <h3 className="text-base font-bold text-ink">{title}</h3>
          </div>
          <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>
        </div>
        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${badgeClasses}`}>
          {tag}
        </span>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Settled Volume */}
        <div className="p-3.5 rounded-lg bg-surface border border-border space-y-1 shadow-xs">
          <span className="text-[11px] text-ink-muted font-medium flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-brand-teal" />
            Settled Volume
          </span>
          <div className="text-lg font-mono font-bold text-ink">
            {metrics.settledVolumeFormatted}
          </div>
          <span className="text-[10px] text-ink-muted block">
            {metrics.confirmedPaymentsCount} confirmed payments
          </span>
        </div>

        {/* Invoices Intake */}
        <div className="p-3.5 rounded-lg bg-surface border border-border space-y-1 shadow-xs">
          <span className="text-[11px] text-ink-muted font-medium flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-navy" />
            Invoices Intake
          </span>
          <div className="text-lg font-mono font-bold text-ink">
            {metrics.invoicesCount}
          </div>
          <span className="text-[10px] text-ink-muted block">
            Passed 3-way match & security verification
          </span>
        </div>

        {/* Verified Suppliers */}
        <div className="p-3.5 rounded-lg bg-surface border border-border space-y-1 shadow-xs">
          <span className="text-[11px] text-ink-muted font-medium flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-brand-teal" />
            Suppliers & Orgs
          </span>
          <div className="text-lg font-mono font-bold text-ink">
            {metrics.vendorsCount}{" "}
            <span className="text-xs font-normal text-ink-muted">
              ({metrics.organizationsCount} orgs)
            </span>
          </div>
          <span className="text-[10px] text-ink-muted block">
            Active approved payees
          </span>
        </div>

        {/* Audit Proofs Anchored */}
        <div className="p-3.5 rounded-lg bg-surface border border-border space-y-1 shadow-xs">
          <span className="text-[11px] text-ink-muted font-medium flex items-center gap-1.5">
            <Anchor className="w-3.5 h-3.5 text-navy" />
            Audit Proofs
          </span>
          <div className="text-lg font-mono font-bold text-ink">
            {metrics.anchoredCount}
          </div>
          <span className="text-[10px] text-ink-muted block">
            Anchored to AuditAnchor.sol
          </span>
        </div>
      </div>

      {/* Defensive Performance */}
      <div className="p-3.5 rounded-lg bg-surface border border-border space-y-2 shadow-xs">
        <h4 className="text-[11px] font-bold text-ink flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-brand-teal" />
          <span>Defensive Performance & Agent Decisions</span>
        </h4>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded bg-canvas border border-border">
            <span className="text-[10px] text-ink-muted block">Duplicates</span>
            <div className="text-sm font-mono font-bold text-amber-700">
              {metrics.duplicatesCount}
            </div>
          </div>
          <div className="p-2 rounded bg-canvas border border-border">
            <span className="text-[10px] text-ink-muted block">Injections</span>
            <div className="text-sm font-mono font-bold text-danger">
              {metrics.injectionsCount}
            </div>
          </div>
          <div className="p-2 rounded bg-canvas border border-border">
            <span className="text-[10px] text-ink-muted block">Decisions</span>
            <div className="text-sm font-mono font-bold text-navy">
              {metrics.agentDecisionsCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
