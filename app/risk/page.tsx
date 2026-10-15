import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ShieldAlert, Zap, Cpu, Terminal } from "lucide-react";

export const metadata: Metadata = {
  title: "Risk Disclosure — Non-Custodial Beta | BizFlow Pilot V2",
  description: "Comprehensive risk disclosures regarding experimental blockchain networks, smart contracts, and non-custodial operations.",
};

export default function RiskPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
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
      <div className="border-b border-border pb-6 space-y-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 text-xs font-semibold font-mono border border-rose-200">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Security & Risk Disclosure</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Risk Disclosure</h1>
        <p className="text-sm text-ink-muted">
          Important disclosures regarding experimental software, blockchain settlement, and non-custodial risk.
        </p>
      </div>

      {/* Primary Alert Banner */}
      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 text-xs text-rose-950 space-y-2">
        <div className="flex items-center gap-2 font-bold text-rose-900">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Read Before Transacting on Arc Mainnet</span>
        </div>
        <p className="leading-relaxed">
          BizFlow Pilot V2 is an experimental, non-custodial business payment prototype currently in public beta.
          Transacting on blockchain networks involves inherent technological and financial risks.
          Do not commit funds you cannot afford to lose. Always verify recipient wallet addresses and transaction data in your wallet before signing.
        </p>
      </div>

      {/* Detailed Risk Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risk 1: Experimental Network */}
        <div className="p-5 rounded-xl border border-border bg-surface shadow-card space-y-3">
          <div className="p-2 w-fit rounded-lg bg-navy text-brand-teal">
            <Zap className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-ink">1. Experimental Blockchain Network</h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            The Arc network (Chain ID 5042 mainnet, 5042002 testnet) is an emerging Layer-1 EVM-compatible blockchain.
            Network congestion, RPC timeouts, gas price volatility, or validator reorgs may cause transaction delays or failures.
            BizFlow cannot reverse or modify confirmed on-chain transactions.
          </p>
        </div>

        {/* Risk 2: Non-Custodial Operations */}
        <div className="p-5 rounded-xl border border-border bg-surface shadow-card space-y-3">
          <div className="p-2 w-fit rounded-lg bg-navy text-brand-teal">
            <Terminal className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-ink">2. Non-Custodial Key Security</h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            BizFlow never possesses your private keys or seed phrase. All transactions are constructed as intents and require your
            client-side cryptographic signature (e.g., via MetaMask, Coinbase Wallet, or Rabby).
            If your wallet is compromised, or if you sign an unintended transaction, BizFlow cannot recover lost funds.
          </p>
        </div>

        {/* Risk 3: Smart Contract Audit Status */}
        <div className="p-5 rounded-xl border border-border bg-surface shadow-card space-y-3">
          <div className="p-2 w-fit rounded-lg bg-navy text-brand-teal">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-ink">3. Smart Contract Audit Status</h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            The on-chain anchoring smart contract (<code className="font-mono bg-canvas px-1 rounded text-ink">AuditAnchor.sol</code>)
            has undergone internal testing and automated security scans, but has not yet received a formal external third-party security audit.
            Use of smart contract functions is at your own risk.
          </p>
        </div>

        {/* Risk 4: Advisory AI Limitations */}
        <div className="p-5 rounded-xl border border-border bg-surface shadow-card space-y-3">
          <div className="p-2 w-fit rounded-lg bg-navy text-brand-teal">
            <Cpu className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-ink">4. Advisory AI & No Financial Advice</h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            The AI finance copilot generates payment timing recommendations based on invoice due dates and treasury reserve buffers.
            Recommendations are purely informational and do not constitute financial, investment, legal, or tax advice.
            The user retains full decision-making responsibility for every payment.
          </p>
        </div>
      </div>

      {/* Safety Controls Active in Beta */}
      <div className="p-5 rounded-xl border border-border bg-surface shadow-card space-y-3">
        <h2 className="text-sm font-bold text-ink flex items-center gap-2">
          <span>Active Safety Guardrails in Beta</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-ink-muted">
          <div className="p-3 rounded-lg bg-canvas border border-border">
            <strong className="text-ink block">Per-Payment Beta Cap</strong>
            Default hard cap of 25.00 USDC per transaction during public testing.
          </div>
          <div className="p-3 rounded-lg bg-canvas border border-border">
            <strong className="text-ink block">OFAC & Cooldown Checks</strong>
            Sanctions screening and 24-hour settlement cooldown on new supplier addresses.
          </div>
          <div className="p-3 rounded-lg bg-canvas border border-border">
            <strong className="text-ink block">Prompt-Injection Shield</strong>
            Deterministic quarantine of invoices containing adversarial LLM override directives.
          </div>
        </div>
      </div>

      {/* Footer Links */}
      <div className="pt-6 border-t border-border flex items-center justify-between text-xs text-ink-muted">
        <span>BizFlow Pilot V2 • Non-Custodial Public Beta</span>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-ink underline">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-ink underline">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}
