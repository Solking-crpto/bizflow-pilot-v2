"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ShieldCheck,
  ArrowRight,
  Wallet,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  Sliders,
} from "lucide-react";
import { useWallet } from "@/components/auth/WalletContext";
import { truncateHash } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";

export default function OnboardingPage() {
  const router = useRouter();
  const {
    address,
    isConnected,
    isAuthenticated,
    isCorrectNetwork,
    activeNetwork,
    connect,
    signIn,
    switchNetwork,
    refreshSession,
  } = useWallet();

  const [formData, setFormData] = useState({
    name: "",
    country: "",
    contactEmail: "",
    websiteUrl: "",
    xUrl: "",
    linkedinUrl: "",
    requireApprovalAbove: "5.00",
    minReserveUsdc: "2.00",
    dailyLimitUsdc: "25.00",
    autoApproveLimitUsdc: "0.50",
    priceToleranceBps: 100, // 1.00%
  });

  const [agreedToRisk, setAgreedToRisk] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agreedToRisk) {
      setError("Please acknowledge the non-custodial risk disclosure before proceeding.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiFetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          country: formData.country,
          contactEmail: formData.contactEmail || undefined,
          websiteUrl: formData.websiteUrl || undefined,
          xUrl: formData.xUrl || undefined,
          linkedinUrl: formData.linkedinUrl || undefined,
          settings: {
            priceToleranceBps: Number(formData.priceToleranceBps),
            requireApprovalAbove: formData.requireApprovalAbove,
            minReserveUsdc: formData.minReserveUsdc,
            dailyLimitUsdc: formData.dailyLimitUsdc,
            autoApproveLimitUsdc: formData.autoApproveLimitUsdc,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to complete onboarding");
      }

      await refreshSession();
      router.push("/invoices");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during onboarding.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-8">
      {/* Title Header */}
      <div className="space-y-2 border-b border-border pb-4">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-light text-brand-teal text-xs font-mono font-semibold">
          Non-Custodial Public Beta Onboarding
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Onboard Your Business to BizFlow Pilot V2
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
          Connect your Web3 wallet to establish your sovereign business profile. All procurement records are private to your organization, and settlements are executed exclusively through your own wallet signatures.
        </p>
      </div>

      {/* Step 1: Wallet Connection Card */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-brand-teal" />
            <h2 className="text-sm font-semibold text-ink">Step 1: Payer Wallet Authentication</h2>
          </div>
          {isAuthenticated ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Authenticated
            </span>
          ) : (
            <span className="text-xs text-ink-muted">Action Required</span>
          )}
        </div>

        {!isConnected ? (
          <div className="text-center py-4 space-y-3">
            <p className="text-xs text-ink-muted">
              Connect your browser wallet (Rabby, MetaMask, etc.) to bind your business organization.
            </p>
            <button
              onClick={() => connect()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs transition"
            >
              <Wallet className="w-4 h-4 text-brand-teal" />
              <span>Connect Browser Wallet</span>
            </button>
          </div>
        ) : !isCorrectNetwork ? (
          <div className="text-center py-4 space-y-3">
            <p className="text-xs text-amber-700 font-medium">
              Your wallet is currently connected to another network. Please switch to {activeNetwork.name} ({activeNetwork.chainId}).
            </p>
            <button
              onClick={() => switchNetwork()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition"
            >
              <span>Switch to {activeNetwork.name}</span>
            </button>
          </div>
        ) : !isAuthenticated ? (
          <div className="text-center py-4 space-y-3">
            <p className="text-xs text-ink-muted">
              Sign a one-time cryptographic EIP-191 message to verify wallet ownership without gas fees.
            </p>
            <button
              onClick={() => signIn()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-teal hover:bg-brand-hover text-white text-xs font-semibold shadow-xs transition"
            >
              <Lock className="w-4 h-4" />
              <span>Sign-In With Ethereum</span>
            </button>
          </div>
        ) : (
          <div className="p-3 bg-canvas rounded-lg border border-border flex items-center justify-between text-xs">
            <div>
              <span className="text-ink-muted block text-[10px] uppercase font-bold">Connected Payer Address</span>
              <span className="font-mono font-bold text-navy">{address}</span>
            </div>
            <span className="font-mono text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded">
              Chain {activeNetwork.chainId}
            </span>
          </div>
        )}
      </div>

      {/* Step 2: Business Profile & Settings Form */}
      {isAuthenticated && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-card space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Building2 className="w-5 h-5 text-brand-teal" />
              <h2 className="text-sm font-semibold text-ink">Step 2: Business Organization Profile</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-ink">Business Legal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Logistics Ltd"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-ink">Country of Operation *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. United Kingdom"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-ink">Contact Email</label>
                <input
                  type="email"
                  placeholder="finance@yourcompany.com"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-ink">Website URL</label>
                <input
                  type="url"
                  placeholder="https://yourcompany.com"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy transition"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Governance Guardrails */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-card space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Sliders className="w-5 h-5 text-brand-teal" />
              <div>
                <h2 className="text-sm font-semibold text-ink">Step 3: Governance & Policy Guardrails</h2>
                <span className="text-[11px] text-ink-muted">Public beta hard cap: transactions capped at 25.00 USDC</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-ink">Per-Payment Auto-Approve Cap (USDC)</label>
                <input
                  type="number"
                  step="0.01"
                  max="25.00"
                  value={formData.autoApproveLimitUsdc}
                  onChange={(e) => setFormData({ ...formData, autoApproveLimitUsdc: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy transition font-mono"
                />
                <span className="text-[10px] text-ink-muted">Capped at 25.00 USDC during beta.</span>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-ink">Require Owner Approval Above (USDC)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.requireApprovalAbove}
                  onChange={(e) => setFormData({ ...formData, requireApprovalAbove: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy transition font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-ink">Liquidity Cash Floor (USDC)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.minReserveUsdc}
                  onChange={(e) => setFormData({ ...formData, minReserveUsdc: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy transition font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-ink">Price Match Tolerance (bps)</label>
                <input
                  type="number"
                  value={formData.priceToleranceBps}
                  onChange={(e) => setFormData({ ...formData, priceToleranceBps: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy transition font-mono"
                />
                <span className="text-[10px] text-ink-muted">100 bps = 1.00% allowable price variance.</span>
              </div>
            </div>
          </div>

          {/* Step 4: Non-Custodial Risk Acknowledgment */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-3 text-xs">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-amber-900 block">Non-Custodial Architecture Disclosure</span>
                <p className="text-amber-800 leading-relaxed text-[11px]">
                  BizFlow Pilot V2 does not hold custody of funds. The server never stores your private keys or seed phrase. All USDC transfers on Arc must be approved and signed directly in your Web3 wallet.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 pt-2 border-t border-amber-200/60 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToRisk}
                onChange={(e) => setAgreedToRisk(e.target.checked)}
                className="rounded border-amber-300 text-brand-teal focus:ring-brand-teal"
              />
              <span className="text-amber-900 font-medium">
                I understand that BizFlow Pilot V2 is non-custodial and agree to the beta operational limits.
              </span>
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-danger-light border border-danger-border text-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !agreedToRisk}
            className="w-full py-3 rounded-xl bg-navy hover:bg-navy-light disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Complete Business Onboarding</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
