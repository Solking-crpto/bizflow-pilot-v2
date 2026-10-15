"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Globe,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  FileCheck2,
  TrendingUp,
  Receipt,
  Bot,
  ShieldAlert,
  ArrowRight,
  Info,
} from "lucide-react";
import { formatUsdc } from "@/lib/money";

export interface PilotOrgData {
  id: string;
  name: string;
  currency: string;
  isPilot: boolean;
  websiteUrl?: string | null;
  xUrl?: string | null;
  linkedinUrl?: string | null;
  publicConsent: boolean;
  createdAt: string;
  treasuryModel: string;
  metrics: {
    invoicesCount: number;
    paymentVolumeFormatted: string;
    confirmedPaymentsCount: number;
    decisionsCount: number;
    autoExecutedCount: number;
    escalatedCount: number;
    threatsBlocked: number;
    recentSettlements: {
      id: string;
      amount: string;
      txHash: string;
      confirmedAt: string | null;
    }[];
  };
}

export function PilotsClient({ pilots }: { pilots: PilotOrgData[] }) {
  const [search, setSearch] = useState("");

  const filteredPilots = pilots.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalInvoices = pilots.reduce((sum, p) => sum + p.metrics.invoicesCount, 0);
  const totalSettlements = pilots.reduce((sum, p) => sum + p.metrics.confirmedPaymentsCount, 0);
  const totalDecisions = pilots.reduce((sum, p) => sum + p.metrics.decisionsCount, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Pilot Businesses Directory</h1>
            <span className="text-xs bg-brand-light text-brand-teal border border-brand-teal/30 px-2 py-0.5 rounded font-mono font-bold">
              Public Consents Only
            </span>
          </div>
          <p className="text-sm text-ink-muted mt-1">
            Real businesses running autonomous AP reconciliation and USDC settlement on Arc.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/judges"
            className="px-3.5 py-1.5 rounded-md bg-canvas hover:bg-canvas-subtle border border-border text-ink text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Info className="w-3.5 h-3.5 text-brand-teal" />
            <span>Judge Guide</span>
          </Link>
          <Link
            href="/settings/pilots"
            className="px-3.5 py-1.5 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-xs flex items-center gap-1.5"
          >
            <span>Pilot Admin</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Builder-Operated Treasury Disclosure Banner */}
      <div className="rounded-xl border border-brand-teal/30 bg-brand-light/20 p-5 shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-sm font-bold text-navy">
          <ShieldCheck className="w-4 h-4 text-brand-teal shrink-0" />
          <span>Builder-Operated Treasury Model (No Custody Risk)</span>
        </div>
        <p className="text-xs text-ink leading-relaxed">
          All payments are executed via a single <strong>builder-operated treasury, funded by the business</strong>.
          BizFlow Pilot V2 strictly avoids storing external private keys or custodying third-party corporate wallets.
          Instead, participating enterprises fund their designated treasury balance on Arc, and BizFlow’s autonomous agent
          reconciles, verifies, and settles approved vendor disbursements within deterministic policy bounds.
        </p>
      </div>

      {/* High-Level Traction Aggregates */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-xs font-medium text-ink-muted flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-brand-teal" />
            <span>Consented Pilots</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-ink">{pilots.length}</div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-xs font-medium text-ink-muted flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-brand-teal" />
            <span>Invoices Processed</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-ink">
            {totalInvoices > 0 ? totalInvoices : "n/a"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-xs font-medium text-ink-muted flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-brand-teal" />
            <span>Settled Payments</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-ink">
            {totalSettlements > 0 ? totalSettlements : "n/a"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="text-xs font-medium text-ink-muted flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-brand-teal" />
            <span>Autonomous Decisions</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-ink">
            {totalDecisions > 0 ? totalDecisions : "n/a"}
          </div>
        </div>
      </div>

      {/* Directory Search & List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <input
            type="text"
            placeholder="Search verified pilot businesses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm px-3.5 py-2 rounded-lg border border-border bg-surface text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-brand-teal"
          />
          <span className="text-xs text-ink-muted font-mono shrink-0">
            {filteredPilots.length} {filteredPilots.length === 1 ? "Organization" : "Organizations"} Listed
          </span>
        </div>

        {filteredPilots.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-ink-muted mx-auto opacity-40" />
            <h3 className="text-sm font-semibold text-ink">No pilot organizations with public consent found</h3>
            <p className="text-xs text-ink-muted max-w-md mx-auto">
              Only pilot businesses that have explicitly granted public directory consent (publicConsent=true) are listed on this page.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredPilots.map((org) => (
              <div
                key={org.id}
                className="rounded-xl border border-border bg-surface p-6 shadow-card space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-ink">{org.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-brand-light text-brand-teal border border-brand-teal/30 px-1.5 py-0.5 rounded font-mono font-bold">
                          PILOT BUSINESS
                        </span>
                        <span className="text-[11px] text-ink-muted font-mono">
                          Joined {new Date(org.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Consented</span>
                    </span>
                  </div>

                  {/* Proof Links */}
                  <div className="pt-3 flex flex-wrap items-center gap-3 text-xs">
                    {org.websiteUrl && (
                      <a
                        href={org.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-teal hover:underline flex items-center gap-1 font-medium"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Website</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                    {org.xUrl && (
                      <a
                        href={org.xUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-teal hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>X Profile</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                    {org.linkedinUrl && (
                      <a
                        href={org.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-teal hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>LinkedIn</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>

                  {/* Real Metrics Grid */}
                  <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-canvas p-2.5 rounded-lg">
                      <div className="text-[10px] text-ink-muted uppercase tracking-wider font-semibold">Invoices</div>
                      <div className="mt-1 font-bold text-ink font-mono text-sm">
                        {org.metrics.invoicesCount > 0 ? org.metrics.invoicesCount : "n/a"}
                      </div>
                    </div>

                    <div className="bg-canvas p-2.5 rounded-lg">
                      <div className="text-[10px] text-ink-muted uppercase tracking-wider font-semibold">Volume</div>
                      <div className="mt-1 font-bold text-ink font-mono text-sm">
                        {org.metrics.confirmedPaymentsCount > 0 ? org.metrics.paymentVolumeFormatted : "n/a"}
                      </div>
                    </div>

                    <div className="bg-canvas p-2.5 rounded-lg">
                      <div className="text-[10px] text-ink-muted uppercase tracking-wider font-semibold">Autonomous</div>
                      <div className="mt-1 font-bold text-ink font-mono text-sm">
                        {org.metrics.autoExecutedCount > 0 ? org.metrics.autoExecutedCount : "n/a"}
                      </div>
                    </div>
                  </div>

                  {/* Recent Verifiable Transactions */}
                  {org.metrics.recentSettlements.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
                        Recent On-Chain Settlements:
                      </div>
                      <div className="space-y-1">
                        {org.metrics.recentSettlements.map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between text-[11px] font-mono bg-canvas/60 px-2 py-1 rounded border border-border"
                          >
                            <span className="text-ink font-semibold">{tx.amount}</span>
                            <span className="text-brand-teal truncate max-w-[140px]">
                              {tx.txHash ? `${tx.txHash.slice(0, 8)}...${tx.txHash.slice(-6)}` : "Verified"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer: Verifiable Architecture */}
                <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-ink-muted">
                  <span>Model: Builder-operated treasury</span>
                  <Link
                    href="/agent/decisions"
                    className="text-brand-teal hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>View Decisions</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
