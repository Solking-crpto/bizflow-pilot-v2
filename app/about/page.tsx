import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Cpu,
  Layers,
  ArrowRight,
  ExternalLink,
  Bot,
  FileCheck2,
  ReceiptText,
  Boxes,
  CheckCircle2,
} from "lucide-react";
import { DetectedWallets } from "@/components/about/DetectedWallets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "About & Trust Architecture | BizFlow Pilot V2",
  description: "Cryptographic trust model, decentralized settlement mechanics, and decoupled AI execution on Arc.",
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2">
      {/* Title */}
      <div className="space-y-2 border-b border-border pb-4">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-light text-brand-teal text-xs font-mono font-semibold">
          Tameion Agents Hackathon 2026 Edition
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          BizFlow Pilot V2 — Architectural Trust Model
        </h1>
        <p className="text-sm text-ink-muted max-w-2xl leading-relaxed">
          The autonomous AI finance agent that never holds the keys. Turning verified business activity
          into policy-approved USDC payments on Arc, with tamper-evident audit proofs.
        </p>
      </div>

      {/* Core Principle Card */}
      <div className="p-6 rounded-2xl border border-navy/20 bg-gradient-to-br from-navy/5 via-surface to-brand-light/30 shadow-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-navy text-white">
            <Lock className="w-6 h-6 text-brand-teal" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink">Core Security Invariant</h2>
            <p className="text-xs text-ink-muted">Non-bypassable boundary between reasoning and execution</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border text-sm font-medium text-ink leading-relaxed">
          <span className="text-navy font-bold">"The AI proposes. A deterministic policy engine decides. Only the engine can trigger the wallet."</span>
          <p className="text-xs text-ink-muted font-normal mt-2 leading-relaxed">
            The Large Language Model is strictly restricted to advisory output. It never holds private keys,
            never has access to wallet credentials, cannot alter spending policies, and cannot directly call the payment adapter.
            All invoice text is treated as hostile untrusted data with automated prompt-injection quarantine.
          </p>
        </div>
      </div>

      {/* Step-by-Step Proof Chain Architecture */}
      <div className="rounded-xl border border-border bg-surface shadow-card p-6 space-y-5">
        <h2 className="text-base font-bold text-ink flex items-center gap-2">
          <Layers className="w-5 h-5 text-brand-teal" />
          <span>Activity-to-Payment Proof Chain</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-canvas border border-border space-y-2">
            <div className="flex items-center gap-2 font-bold text-navy">
              <span className="w-5 h-5 rounded-full bg-navy text-white font-mono text-[10px] flex items-center justify-center">1</span>
              <span>Purchase Order & Stock Commitment</span>
            </div>
            <p className="text-ink-muted leading-relaxed">
              Procurement begins with an authorized PO specifying items, quantities, and agreed unit price in USDC.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-canvas border border-border space-y-2">
            <div className="flex items-center gap-2 font-bold text-navy">
              <span className="w-5 h-5 rounded-full bg-navy text-white font-mono text-[10px] flex items-center justify-center">2</span>
              <span>Warehouse Goods Receipt Note</span>
            </div>
            <p className="text-ink-muted leading-relaxed">
              Physical inventory delivery is inspected, logged, and signed by warehouse personnel before any payment is considered.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-canvas border border-border space-y-2">
            <div className="flex items-center gap-2 font-bold text-navy">
              <span className="w-5 h-5 rounded-full bg-navy text-white font-mono text-[10px] flex items-center justify-center">3</span>
              <span>Deterministic 3-Way Match & Duplicate Screen</span>
            </div>
            <p className="text-ink-muted leading-relaxed">
              PO lines, Goods Receipts, and Invoices are matched mathematically. Quantities must match exactly; unit prices must stay within 1% policy tolerance.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-canvas border border-border space-y-2">
            <div className="flex items-center gap-2 font-bold text-navy">
              <span className="w-5 h-5 rounded-full bg-navy text-white font-mono text-[10px] flex items-center justify-center">4</span>
              <span>AI Finance Agent Timing Proposal</span>
            </div>
            <p className="text-ink-muted leading-relaxed">
              Agent evaluates cash-flow liquidity, payment terms, and vendor history to propose payment timing via structured JSON.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-canvas border border-border space-y-2">
            <div className="flex items-center gap-2 font-bold text-navy">
              <span className="w-5 h-5 rounded-full bg-navy text-white font-mono text-[10px] flex items-center justify-center">5</span>
              <span>10-Rule Deterministic Policy Gate</span>
            </div>
            <p className="text-ink-muted leading-relaxed">
              Pure server-side engine tests active vendor, wallet authenticity, spending caps, liquidity floor, and global kill switch.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-canvas border border-border space-y-2">
            <div className="flex items-center gap-2 font-bold text-navy">
              <span className="w-5 h-5 rounded-full bg-navy text-white font-mono text-[10px] flex items-center justify-center">6</span>
              <span>Arc USDC Settlement & On-Chain Anchor</span>
            </div>
            <p className="text-ink-muted leading-relaxed">
              Direct EVM or Circle Wallets settles USDC on Arc. Once confirmed, <code className="font-mono text-brand-teal">AuditAnchor.sol</code> records the cryptographic proof.
            </p>
          </div>
        </div>
      </div>

      {/* Arc Network & Decimal Trap Specifications */}
      <div className="rounded-xl border border-border bg-surface shadow-card p-6 space-y-4">
        <h2 className="text-base font-bold text-ink flex items-center gap-2">
          <Cpu className="w-5 h-5 text-brand-teal" />
          <span>Arc Network Technical Implementation</span>
        </h2>

        <div className="space-y-3 text-xs leading-relaxed text-ink-muted">
          <p>
            Arc is Circle's stablecoin-native Layer 1 blockchain where <strong>USDC is the native gas token</strong>.
            BizFlow Pilot handles Arc's unique dual-decimal architecture with compiler-enforced branded types:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-canvas border border-border">
              <span className="font-semibold text-ink block mb-1">Native Gas Balance (18 Decimals)</span>
              <p className="text-[11px]">
                Returned by <code className="font-mono text-navy">eth_getBalance</code>. Measured in atomic 1e-18 gas units. Handled strictly via <code className="font-mono text-navy">NativeGasAtomic</code>.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-canvas border border-border">
              <span className="font-semibold text-ink block mb-1">ERC-20 USDC Token Interface (6 Decimals)</span>
              <p className="text-[11px]">
                Standard ERC-20 interface at <code className="font-mono text-navy">0x3600000000000000000000000000000000000000</code>. Measured in 1e-6 units. Handled strictly via <code className="font-mono text-navy">UsdcAtomic</code>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Runtime Network Switch & Data Isolation */}
      <div className="rounded-xl border border-border bg-surface shadow-card p-6 space-y-4">
        <h2 className="text-base font-bold text-ink flex items-center gap-2">
          <Layers className="w-5 h-5 text-brand-teal" />
          <span>Single Deployment Runtime Network Switch & Physical Schema Isolation</span>
        </h2>
        <div className="space-y-3 text-xs leading-relaxed text-ink-muted">
          <p>
            BizFlow Pilot V2 runs as a <strong>single unified deployment</strong> that allows users to toggle between <strong>Arc Testnet (Chain 5042002)</strong> and <strong>Arc Mainnet (Chain 5042)</strong> at runtime:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-canvas border border-border">
              <span className="font-semibold text-ink block mb-1">Physical Database Separation</span>
              <p className="text-[11px]">
                Mainnet and Testnet data are strictly separated into two PostgreSQL schemas (<code className="font-mono text-navy">v2_mainnet</code> vs <code className="font-mono text-navy">v2_testnet</code>) accessed via dedicated Prisma clients (<code className="font-mono text-navy">getDb(network)</code>). Tests and sandbox runs are hard-blocked from ever writing to or reading from mainnet.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-canvas border border-border">
              <span className="font-semibold text-ink block mb-1">State Mutation Safety & Stale Tab Guard</span>
              <p className="text-[11px]">
                Network state is managed via an authenticated <code className="font-mono text-navy">bizflow_network</code> cookie synchronized across browser tabs via <code className="font-mono text-navy">BroadcastChannel</code>. Mutating API endpoints require a matching <code className="font-mono text-navy">X-Bizflow-Network</code> header, returning HTTP 409 Conflict if a tab attempts an operation on a stale network context.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detected Wallets (EIP-6963 Discovery) */}
      <DetectedWallets />

      {/* External Resources & Hackathon Citations */}
      <div className="p-5 rounded-xl border border-border bg-canvas space-y-3 text-xs">
        <span className="font-semibold text-ink block">Official References & Verified Documentation</span>
        <div className="flex flex-wrap gap-4 text-navy">
          <a
            href="https://docs.arc.network"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-brand-teal transition-colors font-medium"
          >
            <span>Arc Network Docs</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://developers.circle.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-brand-teal transition-colors font-medium"
          >
            <span>Circle Developer Platform</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://dorahacks.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-brand-teal transition-colors font-medium"
          >
            <span>Tameion Agents Hackathon</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
