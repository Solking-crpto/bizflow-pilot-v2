import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Globe2,
  Wallet,
  Droplets,
  Building2,
  Users,
  PackageCheck,
  ReceiptText,
  Bot,
  CreditCard,
  ShieldCheck,
  HelpCircle,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { NETWORKS } from "@/lib/networks";
import { GuideActionButtons, GuideFaucetButton } from "@/components/guide/GuideActions";

export const metadata: Metadata = {
  title: "How to use BizFlow Pilot | User Guide",
  description:
    "A 2-minute quick start guide to non-custodial invoice verification, autonomous matching, and USDC settlement on Arc.",
};

export default function UserGuidePage() {
  const testnet = NETWORKS.testnet;
  const mainnet = NETWORKS.mainnet;
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@bizflow.io";
  const supportMailto = `mailto:${supportEmail}?subject=BizFlow%20Pilot%20V2%20Inquiry`;

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-2 pb-16">
      {/* Page Header */}
      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-light text-brand-teal border border-brand-teal/20">
            <Clock className="w-3.5 h-3.5" />
            <span>About a 2-minute read</span>
          </span>
          <span className="text-xs font-mono text-ink-muted bg-canvas px-2 py-0.5 rounded border border-border">
            Public Beta Guide
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">
          How to use BizFlow Pilot
        </h1>
        <p className="text-base sm:text-lg text-ink-muted leading-relaxed max-w-3xl">
          BizFlow Pilot checks your supplier invoices before you pay, then lets you pay in USDC from your own wallet on Arc. We never hold your money or your keys.
        </p>
      </div>

      {/* Table of Contents & Quick Navigation */}
      <div className="p-4 sm:p-5 rounded-xl border border-border bg-surface shadow-2xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand-teal" />
          <span>Table of Contents</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <a href="#comparison" className="p-2 rounded hover:bg-canvas text-ink hover:text-navy transition-colors flex items-center gap-1.5 font-medium">
            <span className="text-brand-teal font-mono font-bold">•</span>
            <span>Testnet vs Mainnet</span>
          </a>
          <a href="#step-1" className="p-2 rounded hover:bg-canvas text-ink hover:text-navy transition-colors flex items-center gap-1.5 font-medium">
            <span className="font-mono text-ink-muted font-bold">1.</span>
            <span>Choose a network</span>
          </a>
          <a href="#step-2" className="p-2 rounded hover:bg-canvas text-ink hover:text-navy transition-colors flex items-center gap-1.5 font-medium">
            <span className="font-mono text-ink-muted font-bold">2.</span>
            <span>Connect your wallet</span>
          </a>
          <a href="#step-3" className="p-2 rounded hover:bg-canvas text-ink hover:text-navy transition-colors flex items-center gap-1.5 font-medium">
            <span className="font-mono text-ink-muted font-bold">3.</span>
            <span>Get test USDC</span>
          </a>
          <a href="#step-4" className="p-2 rounded hover:bg-canvas text-ink hover:text-navy transition-colors flex items-center gap-1.5 font-medium">
            <span className="font-mono text-ink-muted font-bold">4.</span>
            <span>Create business profile</span>
          </a>
          <a href="#step-5" className="p-2 rounded hover:bg-canvas text-ink hover:text-navy transition-colors flex items-center gap-1.5 font-medium">
            <span className="font-mono text-ink-muted font-bold">5.</span>
            <span>Add your suppliers</span>
          </a>
          <a href="#step-6" className="p-2 rounded hover:bg-canvas text-ink hover:text-navy transition-colors flex items-center gap-1.5 font-medium">
            <span className="font-mono text-ink-muted font-bold">6.</span>
            <span>Record order & delivery</span>
          </a>
          <a href="#step-7" className="p-2 rounded hover:bg-canvas text-ink hover:text-navy transition-colors flex items-center gap-1.5 font-medium">
            <span className="font-mono text-ink-muted font-bold">7.</span>
            <span>Enter the invoice</span>
          </a>
          <a href="#step-8" className="p-2 rounded hover:bg-canvas text-ink hover:text-navy transition-colors flex items-center gap-1.5 font-medium">
            <span className="font-mono text-ink-muted font-bold">8.</span>
            <span>Ask the AI agent</span>
          </a>
          <a href="#step-9" className="p-2 rounded hover:bg-canvas text-ink hover:text-navy transition-colors flex items-center gap-1.5 font-medium">
            <span className="font-mono text-ink-muted font-bold">9.</span>
            <span>Review & sign payment</span>
          </a>
          <a href="#step-10" className="p-2 rounded hover:bg-canvas text-ink hover:text-navy transition-colors flex items-center gap-1.5 font-medium">
            <span className="font-mono text-ink-muted font-bold">10.</span>
            <span>Check the proof</span>
          </a>
          <a href="#faq" className="p-2 rounded hover:bg-canvas text-ink hover:text-navy transition-colors flex items-center gap-1.5 font-medium">
            <span className="text-brand-teal font-mono font-bold">•</span>
            <span>Frequently Asked Questions</span>
          </a>
        </div>
      </div>

      {/* Testnet vs Mainnet Comparison Box */}
      <section id="comparison" className="scroll-mt-20 space-y-4">
        <div className="flex items-center gap-2">
          <Globe2 className="w-5 h-5 text-navy" />
          <h2 className="text-xl font-bold tracking-tight text-ink">Testnet vs Mainnet Comparison</h2>
        </div>
        <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
          BizFlow Pilot V2 provides a single unified application with an instant runtime switcher in the top navigation bar. Every chain configuration is read directly from our verified network definitions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Testnet Card */}
          <div className="p-5 rounded-xl border border-amber-300 bg-amber-50/40 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-amber-200">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  Free Practice Environment
                </span>
                <h3 className="text-lg font-bold text-ink mt-1">{testnet.name}</h3>
              </div>
              <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-1 rounded">
                Chain {testnet.chainId}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-amber-200/60">
                <span className="text-ink-muted">Purpose:</span>
                <span className="font-semibold text-ink">Practise risk-free with free test USDC</span>
              </div>
              <div className="flex justify-between py-1 border-b border-amber-200/60">
                <span className="text-ink-muted">Funds Value:</span>
                <span className="font-semibold text-amber-800">Zero monetary value</span>
              </div>
              <div className="flex justify-between py-1 border-b border-amber-200/60">
                <span className="text-ink-muted">Gas Asset:</span>
                <span className="font-mono text-ink font-semibold">{testnet.chain.nativeCurrency.symbol} (Native)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-amber-200/60">
                <span className="text-ink-muted">Payment Limit:</span>
                <span className="font-mono text-ink font-semibold">{testnet.maxPaymentUsdc} USDC max</span>
              </div>
              <div className="flex justify-between py-1 border-b border-amber-200/60">
                <span className="text-ink-muted">Public RPC:</span>
                <span className="font-mono text-ink text-[11px] truncate max-w-[200px]" title={testnet.publicRpcUrl}>
                  {testnet.publicRpcUrl}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-amber-200/60">
                <span className="text-ink-muted">Block Explorer:</span>
                <a
                  href={testnet.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-brand-teal hover:underline inline-flex items-center gap-1 text-[11px] truncate max-w-[200px]"
                >
                  <span>{testnet.explorerUrl.replace("https://", "")}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-muted">Faucet:</span>
                {testnet.faucetUrl ? (
                  <a
                    href={testnet.faucetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-amber-800 hover:underline inline-flex items-center gap-1 text-[11px]"
                  >
                    <span>Circle Faucet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-ink-muted">None</span>
                )}
              </div>
            </div>
          </div>

          {/* Mainnet Card */}
          <div className="p-5 rounded-xl border border-navy/20 bg-surface shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white bg-navy px-2 py-0.5 rounded">
                  Live Production Environment
                </span>
                <h3 className="text-lg font-bold text-ink mt-1">{mainnet.name}</h3>
              </div>
              <span className="text-xs font-mono font-bold text-white bg-navy px-2 py-1 rounded">
                Chain {mainnet.chainId}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-ink-muted">Purpose:</span>
                <span className="font-semibold text-ink">Real corporate supplier settlements</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-ink-muted">Funds Value:</span>
                <span className="font-semibold text-navy">Real, irreversible USDC funds</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-ink-muted">Gas Asset:</span>
                <span className="font-mono text-ink font-semibold">{mainnet.chain.nativeCurrency.symbol} (Native)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-ink-muted">Beta Safety Cap:</span>
                <span className="font-mono text-ink font-semibold">{mainnet.maxPaymentUsdc} USDC max</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-ink-muted">Public RPC:</span>
                <span className="font-mono text-ink text-[11px] truncate max-w-[200px]" title={mainnet.publicRpcUrl}>
                  {mainnet.publicRpcUrl}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-ink-muted">Block Explorer:</span>
                <a
                  href={mainnet.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-brand-teal hover:underline inline-flex items-center gap-1 text-[11px] truncate max-w-[200px]"
                >
                  <span>{mainnet.explorerUrl.replace("https://", "")}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-muted">Faucet:</span>
                <span className="text-ink-muted font-sans italic">None (Real USDC required)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Numbered Steps with Icons */}
      <section className="space-y-6">
        <div className="border-b border-border pb-3">
          <h2 className="text-xl font-bold tracking-tight text-ink">10-Step Operational Flow</h2>
          <p className="text-xs sm:text-sm text-ink-muted mt-0.5">
            Follow these ten clear steps to run verified accounts payable from order intake to cryptographic on-chain proof.
          </p>
        </div>

        <div className="space-y-4">
          {/* Step 1 */}
          <div id="step-1" className="scroll-mt-20 p-5 rounded-xl border border-border bg-surface shadow-2xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-canvas border border-border flex items-center justify-center text-navy font-mono font-bold shrink-0">
              1
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-brand-teal" />
                <h3 className="text-sm font-bold text-ink">Choose a network</h3>
              </div>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                Use the TESTNET | MAINNET switch at the top. Testnet is free practice with test USDC that has no value. Mainnet uses real USDC and payments are final. Start on testnet.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div id="step-2" className="scroll-mt-20 p-5 rounded-xl border border-border bg-surface shadow-2xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-canvas border border-border flex items-center justify-center text-navy font-mono font-bold shrink-0">
              2
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-brand-teal" />
                <h3 className="text-sm font-bold text-ink">Connect your wallet</h3>
              </div>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                Click &quot;Sign in with wallet&quot; and approve the message in your wallet (MetaMask or any browser wallet). Signing is free and sends no money. If your wallet is on the wrong network, approve the prompt to switch or add Arc.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div id="step-3" className="scroll-mt-20 p-5 rounded-xl border border-border bg-surface shadow-2xs flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-canvas border border-border flex items-center justify-center text-navy font-mono font-bold shrink-0">
                3
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-ink">Get test USDC (testnet only)</h3>
                </div>
                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                  Open the free faucet (button), choose Arc Testnet, paste your wallet address, and request USDC. Arc uses USDC for gas too, so one balance covers payments and fees. On mainnet you need real USDC on Arc.
                </p>
              </div>
            </div>
            <div className="self-end sm:self-center shrink-0">
              <GuideFaucetButton />
            </div>
          </div>

          {/* Step 4 */}
          <div id="step-4" className="scroll-mt-20 p-5 rounded-xl border border-border bg-surface shadow-2xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-canvas border border-border flex items-center justify-center text-navy font-mono font-bold shrink-0">
              4
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-teal" />
                <h3 className="text-sm font-bold text-ink">Create your business profile</h3>
              </div>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                Enter your business name and country, then set your own limits: per-payment limit, approval threshold, cash reserve and matching tolerance. A beta cap of 25 USDC per payment always applies.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div id="step-5" className="scroll-mt-20 p-5 rounded-xl border border-border bg-surface shadow-2xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-canvas border border-border flex items-center justify-center text-navy font-mono font-bold shrink-0">
              5
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-teal" />
                <h3 className="text-sm font-bold text-ink">Add your suppliers</h3>
              </div>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                Enter each supplier&apos;s name and payout wallet address. Check the address carefully. Payments are final. If you change a supplier&apos;s wallet later, there is a 24-hour cooldown and a review.
              </p>
            </div>
          </div>

          {/* Step 6 */}
          <div id="step-6" className="scroll-mt-20 p-5 rounded-xl border border-border bg-surface shadow-2xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-canvas border border-border flex items-center justify-center text-navy font-mono font-bold shrink-0">
              6
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-brand-teal" />
                <h3 className="text-sm font-bold text-ink">Record the order and delivery</h3>
              </div>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                Create a purchase order with line items, then log the goods or services you actually received.
              </p>
            </div>
          </div>

          {/* Step 7 */}
          <div id="step-7" className="scroll-mt-20 p-5 rounded-xl border border-border bg-surface shadow-2xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-canvas border border-border flex items-center justify-center text-navy font-mono font-bold shrink-0">
              7
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-brand-teal" />
                <h3 className="text-sm font-bold text-ink">Enter the invoice</h3>
              </div>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                BizFlow compares the invoice to the order and delivery, blocks duplicates, and treats invoice text as untrusted so hidden instructions cannot trigger a payment.
              </p>
            </div>
          </div>

          {/* Step 8 */}
          <div id="step-8" className="scroll-mt-20 p-5 rounded-xl border border-border bg-surface shadow-2xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-canvas border border-border flex items-center justify-center text-navy font-mono font-bold shrink-0">
              8
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-brand-teal" />
                <h3 className="text-sm font-bold text-ink">Ask the AI agent</h3>
              </div>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                &quot;Analyze my invoices&quot; ranks what to pay and when and explains why. It only recommends. It cannot sign or spend.
              </p>
            </div>
          </div>

          {/* Step 9 */}
          <div id="step-9" className="scroll-mt-20 p-5 rounded-xl border border-border bg-surface shadow-2xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-canvas border border-border flex items-center justify-center text-navy font-mono font-bold shrink-0">
              9
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand-teal" />
                <h3 className="text-sm font-bold text-ink">Review and sign the payment</h3>
              </div>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                Check the amount and recipient shown, then approve in your wallet. Keep a little USDC for gas.
              </p>
            </div>
          </div>

          {/* Step 10 */}
          <div id="step-10" className="scroll-mt-20 p-5 rounded-xl border border-border bg-surface shadow-2xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-canvas border border-border flex items-center justify-center text-navy font-mono font-bold shrink-0">
              10
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-brand-teal" />
                <h3 className="text-sm font-bold text-ink">Check the proof</h3>
              </div>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                Open the Payment Passport or the Audit Ledger to verify the payment on-chain. You can optionally anchor the proof on Arc.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions (FAQ) */}
      <section id="faq" className="scroll-mt-20 space-y-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-navy" />
          <h2 className="text-xl font-bold tracking-tight text-ink">Frequently Asked Questions</h2>
        </div>

        <div className="divide-y divide-border rounded-xl border border-border bg-surface overflow-hidden">
          {/* FAQ 1 */}
          <div className="p-5 space-y-1.5">
            <h3 className="text-sm font-bold text-ink">Is my money safe?</h3>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Yes. BizFlow Pilot is strictly non-custodial. We never hold your money or your private keys. Every single transaction must be confirmed and signed by you inside your browser wallet (MetaMask, Rabby, etc.) directly on the Arc network.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="p-5 space-y-1.5">
            <h3 className="text-sm font-bold text-ink">What if I pick the wrong network?</h3>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              You can switch between Testnet and Mainnet anytime using the switch in the top bar. Testnet tokens have zero monetary value and are completely safe to test with. If your wallet is connected to the wrong network when signing, BizFlow will prompt you to switch automatically.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="p-5 space-y-1.5">
            <h3 className="text-sm font-bold text-ink">What does the beta cap mean?</h3>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              During our public beta period, individual settlements on Arc Mainnet are strictly capped at {mainnet.maxPaymentUsdc} USDC per transaction to prevent accidental large outflows while you test our autonomous accounts payable engine.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="p-5 space-y-1.5">
            <h3 className="text-sm font-bold text-ink">Is sanctions screening included?</h3>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              BizFlow Pilot checks transactions against an internal blocked-address list of known flagged test accounts. It is not a complete regulatory sanctions screening solution (e.g. Chainalysis or TRM Labs). For production compliance, counterparties must be verified by your legal team.
            </p>
          </div>

          {/* FAQ 5 */}
          <div className="p-5 space-y-1.5">
            <h3 className="text-sm font-bold text-ink">How do I get help?</h3>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              If you run into any issues, have feedback, or need technical assistance, contact our support engineering team directly at{" "}
              <a href={supportMailto} className="text-brand-teal font-semibold hover:underline">
                {supportEmail}
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* End Actions: Try it free on testnet + Get free test USDC */}
      <GuideActionButtons />
    </div>
  );
}
