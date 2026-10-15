import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, FileText, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — Non-Custodial Beta | BizFlow Pilot V2",
  description: "Terms and conditions governing the use of BizFlow Pilot V2 public beta software.",
};

export default function TermsPage() {
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
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-light text-brand-teal text-xs font-semibold font-mono border border-brand-teal/20">
          <FileText className="w-3.5 h-3.5" />
          <span>Legal & Compliance</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Terms of Service</h1>
        <p className="text-sm text-ink-muted">
          Last updated: October 2026 • Public Beta Edition
        </p>
      </div>

      {/* Key Notice Banner */}
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900 space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-amber-950">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Non-Custodial Experimental Software Notice</span>
        </div>
        <p className="leading-relaxed">
          BizFlow Pilot V2 is provided &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo; for experimental beta evaluation.
          BizFlow is strictly non-custodial: we do not hold, control, or have access to your private keys, funds, or wallet credentials.
          All on-chain actions require your explicit, client-side signature authorization.
        </p>
      </div>

      {/* Terms Content */}
      <div className="space-y-6 text-xs text-ink-muted leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ink">1. Acceptance of Terms</h2>
          <p>
            By connecting your Web3 wallet, generating a session token, or submitting purchase orders,
            goods receipts, or invoices to BizFlow Pilot V2 (&ldquo;Service&rdquo;), you acknowledge that
            you have read, understood, and agreed to be bound by these Terms of Service. If you do not
            agree, you must not use the Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ink">2. Non-Custodial Architecture & User Responsibility</h2>
          <p>
            BizFlow Pilot V2 does not function as a bank, financial institution, custodian, or escrow agent.
            At no point does BizFlow have possession, custody, or control of your cryptocurrency or USDC tokens.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>You are solely responsible for safeguarding your Web3 wallet private keys and recovery phrases.</li>
            <li>You are solely responsible for reviewing and authorizing all transaction signatures in your wallet.</li>
            <li>Once an on-chain transfer is broadcast to the Arc network, it is irreversible and cannot be canceled by BizFlow.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ink">3. Nature of Advisory AI and Policy Engine</h2>
          <p>
            The artificial intelligence agent within BizFlow provides purely advisory proposals based on
            deterministic policy rules, 3-way matching algorithms, and treasury cash flow metrics.
          </p>
          <p>
            The AI agent cannot execute transactions on your behalf, cannot broadcast transactions from the server,
            and does not provide accounting, financial, tax, or legal advice. You remain solely responsible for
            verifying invoice validity and approving supplier payments.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ink">4. Beta Limits & Acceptable Use</h2>
          <p>
            During the public beta phase, the application enforces safety guardrails, including an app-level
            per-transaction cap (default 25.00 USDC) and daily advisory call limits. You agree not to:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Attempt to bypass rate limits, authorization checks, or multi-tenant organizational isolation.</li>
            <li>Submit fraudulent, sanctioned, or unauthorized remittance addresses.</li>
            <li>Ingest adversarial prompt-injection payloads designed to manipulate AI behavior.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ink">5. Disclaimer of Warranties & Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED WITHOUT WARRANTIES OF ANY KIND,
            WHETHER EXPRESS, IMPLIED, OR STATUTORY. BIZFLOW AND ITS CONTRIBUTORS DISCLAIM ALL WARRANTIES
            OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
          <p>
            IN NO EVENT SHALL BIZFLOW BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE
            DAMAGES, LOSS OF FUNDS, GAS SPIKES, NETWORK DOWNTIME, OR SMART CONTRACT FAILURES ARISING FROM
            USE OF THE ARC NETWORK OR THE SERVICE.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ink">6. Modifications</h2>
          <p>
            We reserve the right to modify these Terms or discontinue features of the beta service at any time.
            Continued use following changes constitutes acceptance of modified terms.
          </p>
        </section>
      </div>

      {/* Footer Links */}
      <div className="pt-6 border-t border-border flex items-center justify-between text-xs text-ink-muted">
        <span>BizFlow Pilot V2 • Non-Custodial Public Beta</span>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-ink underline">Privacy Policy</Link>
          <Link href="/risk" className="hover:text-ink underline">Risk Disclosure</Link>
        </div>
      </div>
    </div>
  );
}
