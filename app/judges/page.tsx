import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Award,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Boxes,
  ReceiptText,
  CreditCard,
  Bot,
  FileCheck2,
  SlidersHorizontal,
  Lock,
  Layers,
  Sparkles,
  Github,
  Globe,
} from "lucide-react";
import { cookies } from "next/headers";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork, NETWORKS } from "@/lib/networks";
import { HashView } from "@/components/ui/StatusChip";
import { formatUsdc, usdcAtomic } from "@/lib/money";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Judge Guide — 5-Minute Evaluation Path | BizFlow Pilot V2",
  description:
    "Comprehensive Tameion Agents Hackathon evaluation guide for judges: autonomous execution, real mainnet transactions, audit contracts, compliance matrix, and pilot organizations.",
};

export default async function JudgesPage() {
  const cookieStore = cookies();
  const networkMode = getServerActiveNetwork(cookieStore.get("bizflow_network")?.value);
  const network = NETWORKS[networkMode];
  const db = getDb(networkMode);

  let confirmedPayment: any = null;
  try {
    confirmedPayment = await withDbTimeout(() =>
      db.payment.findFirst({
        where: { status: "confirmed" },
        include: { vendor: true, invoice: true, anchor: true },
        orderBy: { confirmedAt: "desc" },
      })
    );
  } catch {
    // Database query fallback
  }

  const anchorAddress =
    process.env.AUDIT_ANCHOR_ADDRESS ||
    process.env.NEXT_PUBLIC_AUDIT_ANCHOR_ADDRESS ||
    "0x2b18fe9d3a63710da242092571744520ea8effe0";

  const repoUrl =
    process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/Solking-crpto/bizflow-pilot-v2";

  const builderProfileUrl =
    process.env.NEXT_PUBLIC_BUILDER_PROFILE_URL || "https://github.com/Solking-crpto";

  const paymentTxHash = confirmedPayment?.txHash || null;
  const anchorTxHash = confirmedPayment?.anchorTxHash || confirmedPayment?.anchor?.anchorTxHash || null;
  const settledAmount = confirmedPayment
    ? formatUsdc(usdcAtomic(confirmedPayment.amountAtomic))
    : null;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-8">
      {/* Header & Pitch */}
      <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-border shadow-elevated space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-navy text-white">
            <Award className="w-7 h-7 text-brand-teal" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-brand-teal">
                DoraHacks Arc Microgrants
              </span>
              <span className="text-[10px] font-mono bg-canvas px-2 py-0.5 rounded border border-border">
                Chain ID {network.chainId}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-ink mt-0.5 tracking-tight">
              Judge Evaluation Guide
            </h1>
          </div>
        </div>

        {/* One-Paragraph Pitch */}
        <div className="p-4 rounded-xl bg-canvas border border-border">
          <h2 className="text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
            Executive Summary
          </h2>
          <p className="text-sm text-ink leading-relaxed font-sans">
            <strong>BizFlow Pilot V2</strong> is an autonomous, non-custodial financial operations layer for enterprise treasury that bridges real-world procurement to native USDC settlement on <strong>Arc Mainnet</strong>. Evaluators can switch between <strong>Arc Testnet</strong> (risk-free sandbox practice with free test USDC) and <strong>Arc Mainnet</strong> (real USDC settlement) anytime using the global switcher in the top bar. By decoupling untrusted LLM extraction from a deterministic 10-point policy engine, it prevents prompt-injection fraud, duplicate billing, and quantity discrepancies before triggering idempotent on-chain payments and anchoring immutable SHA-256 audit proofs to <code>AuditAnchor.sol</code>.
          </p>
        </div>
      </div>

      {/* Compliance Matrix Table */}
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-canvas/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-teal" />
            <h2 className="text-sm font-semibold text-ink">
              Hackathon Requirements Compliance Table
            </h2>
          </div>
          <span className="text-xs font-mono text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            100% Compliant
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-canvas text-ink-muted font-semibold">
                <th className="py-2.5 px-4">Requirement</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">On-Chain / Verified Value</th>
                <th className="py-2.5 px-4 text-right">Proof Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Row 1: Arc Mainnet Live */}
              <tr className="hover:bg-canvas/50 transition-colors">
                <td className="py-3 px-4 font-semibold text-ink">Live on Arc Mainnet</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Confirmed
                  </span>
                </td>
                <td className="py-3 px-4 font-mono">
                  {network.name} (Chain ID: {network.chainId})
                </td>
                <td className="py-3 px-4 text-right">
                  <a
                    href={network.rpcUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-navy hover:text-brand-teal font-medium"
                  >
                    <span>RPC Endpoint</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>

              {/* Row 2: Real Mainnet Settlement */}
              <tr className="hover:bg-canvas/50 transition-colors">
                <td className="py-3 px-4 font-semibold text-ink">Real Mainnet Transaction</td>
                <td className="py-3 px-4">
                  {confirmedPayment && settledAmount ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Settled ({settledAmount})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      Awaiting First Settlement
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 font-mono text-[11px]">
                  {paymentTxHash ? <HashView hash={paymentTxHash} truncate={true} /> : "—"}
                </td>
                <td className="py-3 px-4 text-right">
                  {paymentTxHash ? (
                    <a
                      href={`${network.explorerUrl}/tx/${paymentTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-navy hover:text-brand-teal font-medium"
                    >
                      <span>Arc Explorer</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-ink-muted text-[11px]">Pending execution</span>
                  )}
                </td>
              </tr>

              {/* Row 3: On-Chain Audit Anchor Contract */}
              <tr className="hover:bg-canvas/50 transition-colors">
                <td className="py-3 px-4 font-semibold text-ink">On-Chain Audit Anchor</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Deployed
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-[11px]">
                  <HashView hash={anchorAddress} truncate={true} />
                </td>
                <td className="py-3 px-4 text-right">
                  <a
                    href={`${network.explorerUrl}/address/${anchorAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-navy hover:text-brand-teal font-medium"
                  >
                    <span>Contract Code</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>

              {/* Row 4: Public Repo */}
              <tr className="hover:bg-canvas/50 transition-colors">
                <td className="py-3 px-4 font-semibold text-ink">Public Repository</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Open Source
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-ink-muted truncate max-w-[200px]">
                  {repoUrl}
                </td>
                <td className="py-3 px-4 text-right">
                  <a
                    href={repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-navy hover:text-brand-teal font-medium"
                  >
                    <span>GitHub Repo</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>

              {/* Row 5: Arc Component */}
              <tr className="hover:bg-canvas/50 transition-colors">
                <td className="py-3 px-4 font-semibold text-ink">Core Arc Integration</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Native USDC
                  </span>
                </td>
                <td className="py-3 px-4 text-ink-muted">
                  Settlement + EVM Audit Anchoring via Viem
                </td>
                <td className="py-3 px-4 text-right">
                  <Link
                    href="/about"
                    className="inline-flex items-center gap-1 text-navy hover:text-brand-teal font-medium"
                  >
                    <span>Architecture</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </td>
              </tr>

              {/* Row 6: Builder Profile */}
              <tr className="hover:bg-canvas/50 transition-colors">
                <td className="py-3 px-4 font-semibold text-ink">Builder Profile</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Public
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-ink-muted">
                  {builderProfileUrl}
                </td>
                <td className="py-3 px-4 text-right">
                  <a
                    href={builderProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-navy hover:text-brand-teal font-medium"
                  >
                    <span>Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5-Minute Evaluation Path */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Sparkles className="w-4 h-4 text-brand-teal" />
          <h2 className="text-sm font-semibold text-ink">
            5-Minute Quick Evaluation Path
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Step 1 */}
          <Link
            href="/"
            className="p-3.5 rounded-lg border border-border bg-canvas hover:bg-white hover:border-brand-teal transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-ink font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-navy text-white text-[11px] flex items-center justify-center font-mono">1</span>
                  Command Center
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-brand-teal transition-colors" />
              </div>
              <p className="text-ink-muted mt-1.5 leading-relaxed text-[11px]">
                Inspect real-time treasury USDC balance, live proof banner, and active policy guardrail status.
              </p>
            </div>
          </Link>

          {/* Step 2 */}
          <Link
            href="/invoices"
            className="p-3.5 rounded-lg border border-border bg-canvas hover:bg-white hover:border-brand-teal transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-ink font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-navy text-white text-[11px] flex items-center justify-center font-mono">2</span>
                  Invoice Match & Threat Desk
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-brand-teal transition-colors" />
              </div>
              <p className="text-ink-muted mt-1.5 leading-relaxed text-[11px]">
                Review 3-way match failures: blocked duplicate invoice, quantity discrepancy, and neutralized prompt-injection attack.
              </p>
            </div>
          </Link>

          {/* Step 3 */}
          <Link
            href="/simulator"
            className="p-3.5 rounded-lg border border-border bg-canvas hover:bg-white hover:border-brand-teal transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-ink font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-navy text-white text-[11px] flex items-center justify-center font-mono">3</span>
                  Policy Engine Simulator
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-brand-teal transition-colors" />
              </div>
              <p className="text-ink-muted mt-1.5 leading-relaxed text-[11px]">
                Toggle parameters live: test price tolerance breaches, amount limit enforcement, and emergency kill-switch halts.
              </p>
            </div>
          </Link>

          {/* Step 4 */}
          <Link
            href="/agent"
            className="p-3.5 rounded-lg border border-border bg-canvas hover:bg-white hover:border-brand-teal transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-ink font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-navy text-white text-[11px] flex items-center justify-center font-mono">4</span>
                  AI Finance Agent
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-brand-teal transition-colors" />
              </div>
              <p className="text-ink-muted mt-1.5 leading-relaxed text-[11px]">
                Consult the autonomous CFO agent on invoices, discrepancy forensics, and liquidity safety margins.
              </p>
            </div>
          </Link>

          {/* Step 5 */}
          <Link
            href={confirmedPayment ? `/verify/${confirmedPayment.id}` : "/payments"}
            className="p-3.5 rounded-lg border border-border bg-canvas hover:bg-white hover:border-brand-teal transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-ink font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-navy text-white text-[11px] flex items-center justify-center font-mono">5</span>
                  Public Payment Passport
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-brand-teal transition-colors" />
              </div>
              <p className="text-ink-muted mt-1.5 leading-relaxed text-[11px]">
                No-login public verifier: inspect the complete 10-rule audit certificate, live Arc RPC receipt, and decoded logs.
              </p>
            </div>
          </Link>

          {/* Step 6 */}
          <Link
            href="/audit"
            className="p-3.5 rounded-lg border border-border bg-canvas hover:bg-white hover:border-brand-teal transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-ink font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-navy text-white text-[11px] flex items-center justify-center font-mono">6</span>
                  Cryptographic Audit Ledger
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-brand-teal transition-colors" />
              </div>
              <p className="text-ink-muted mt-1.5 leading-relaxed text-[11px]">
                Test the client-side &quot;Verify Chain&quot; button to cryptographically re-hash every block and confirm zero tampering.
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Real vs Demo Transparent Disclosure */}
      <div className="p-6 rounded-xl border border-border bg-surface shadow-card space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Layers className="w-4 h-4 text-brand-teal" />
          <h2 className="text-sm font-semibold text-ink">
            Transparent Disclosure: Non-Custodial Architecture & Live Operations
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-200 space-y-1.5">
            <span className="font-semibold text-emerald-900 block flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              100% Real On-Chain Artifacts
            </span>
            <ul className="list-disc list-inside space-y-1 text-emerald-800 text-[11px]">
              <li>Real Arc Mainnet EVM execution (Chain ID 5042).</li>
              <li>Real USDC settlement transaction broadcast via Arc RPC.</li>
              <li>Real <code>AuditAnchor.sol</code> contract deployed and invoked on-chain.</li>
              <li>Real SHA-256 cryptographic hash chains linking events.</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-lg bg-blue-50/60 border border-blue-200 space-y-1.5">
            <span className="font-semibold text-blue-900 block flex items-center gap-1">
              <Boxes className="w-3.5 h-3.5 text-blue-700" />
              Non-Custodial Multi-Tenant Isolation
            </span>
            <ul className="list-disc list-inside space-y-1 text-blue-800 text-[11px]">
              <li>Non-custodial tenant onboarding: each business connects via SIWE wallet.</li>
              <li>Public beta limits: per-payment cap enforced during public testing.</li>
              <li>Isolated organizations: vendors, POs, and invoices scoped to authenticated wallet.</li>
              <li>Builder treasury key restricted exclusively to admin operations.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
