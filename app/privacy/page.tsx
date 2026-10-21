import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, Lock, Database } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — Non-Custodial Beta | BizFlow Pilot V2",
  description: "Privacy policy detailing data isolation, cryptographic hashing, and zero-custody architecture.",
};

export default function PrivacyPage() {
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
          <Lock className="w-3.5 h-3.5" />
          <span>Data Protection & Privacy</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Privacy Policy</h1>
        <p className="text-sm text-ink-muted">
          Last updated: October 2026 • Public Beta Edition
        </p>
      </div>

      {/* Security Highlight */}
      <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/70 text-xs text-sky-900 space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-sky-950">
          <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
          <span>Zero Private Key Collection & Zero Tracking</span>
        </div>
        <p className="leading-relaxed">
          BizFlow Pilot V2 operates on zero-knowledge principles regarding your private keys.
          We never store, log, or request your wallet secret keys or seed phrases.
          Authentication is verified strictly through cryptographic Sign-In With Ethereum (EIP-191) signatures.
        </p>
      </div>

      {/* Privacy Sections */}
      <div className="space-y-6 text-xs text-ink-muted leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ink">1. Information We Collect</h2>
          <p>
            When you interact with the BizFlow application, we collect only the minimal data required
            to provide decentralized invoice settlement and audit verification:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Public Wallet Address:</strong> Used to associate your session with your business organization.</li>
            <li><strong>Organization Profile:</strong> Business name, country, optional contact email, and optional social links provided during onboarding.</li>
            <li><strong>Payable Data:</strong> Supplier names, remittance wallet addresses, purchase orders, goods receipts, and invoice line items entered into your organization.</li>
            <li><strong>Cryptographic Hashes:</strong> SHA-256 hashes of invoices, 3-way match outputs, and policy evaluations.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ink">2. How We Use Your Information</h2>
          <p>
            Your information is used solely to provide invoice reconciliation, execute deterministic
            policy checks, formulate advisory AI payment recommendations, and verify on-chain receipts.
          </p>
          <p>
            We do not sell, rent, monetize, or share your business data with data brokers or advertising networks.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ink">3. Multi-Tenant Cryptographic Isolation</h2>
          <p>
            Every query and mutation in BizFlow is strictly scoped to the authenticated organization.
            Session tokens are signed with HMAC-SHA256 and stored in secure, HttpOnly, SameSite=Lax cookies.
            One business organization cannot view, query, or modify another organization&apos;s suppliers or invoices.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ink">4. On-Chain Transparency & Blockchain Invariants</h2>
          <p>
            Please note that transactions broadcast to the Arc network (such as USDC transfers and AuditAnchor contract interactions)
            are inherently public, transparent, and immutable on the blockchain.
          </p>
          <p>
            Public verify pages (such as <code className="bg-canvas px-1 py-0.5 rounded font-mono">/verify/[id]</code>)
            display only sanitized cryptographic proofs (hashes and timestamps) and never disclose raw vendor contact details
            or confidential internal notes to unauthenticated viewers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ink">5. Physical Delivery Evidence & Retention Policy</h2>
          <p>
            When field receivers verify delivery of physical inventory through the Mobile Verifier Portal, we strictly enforce privacy-by-design and minimal collection:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Minimal Collection:</strong> Only photos/videos of goods, packing slips, and verifier contact info are collected. We explicitly do <em>not</em> collect GPS location coordinates, identity cards, or biometric data.</li>
            <li><strong>90-Day Evidence Retention:</strong> Uploaded evidence files (photos, videos, PDFs) are retained in private cloud storage for a maximum of 90 days (default <code className="bg-canvas px-1 py-0.5 rounded font-mono">EVIDENCE_RETENTION_DAYS</code>).</li>
            <li><strong>Automated Pruning:</strong> An automated daily cleanup cron (<code className="bg-canvas px-1 py-0.5 rounded font-mono">/api/cron/cleanup</code>) permanently prunes all raw media files older than 90 days from physical storage.</li>
            <li><strong>Permanent Audit Trails:</strong> Cryptographic SHA-256 file hashes, condition engine evaluations, and owner decisions are preserved permanently in the tamper-evident audit ledger to maintain complete historical accountability without retaining raw personal files.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ink">6. Data Retention & Erasure</h2>
          <p>
            Off-chain business data stored in the database can be reviewed and managed within your settings portal.
            However, on-chain transaction records and audit anchor events published to the Arc blockchain cannot be altered or removed.
          </p>
        </section>
      </div>

      {/* Footer Links */}
      <div className="pt-6 border-t border-border flex items-center justify-between text-xs text-ink-muted">
        <span>BizFlow Pilot V2 • Non-Custodial Public Beta</span>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-ink underline">Terms of Service</Link>
          <Link href="/risk" className="hover:text-ink underline">Risk Disclosure</Link>
        </div>
      </div>
    </div>
  );
}
