"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, X, ArrowRight, ShieldCheck, AlertTriangle } from "lucide-react";
import { useNetwork } from "@/components/network/NetworkContext";

export function FirstVisitChoiceModal({ networkMode }: { networkMode?: "testnet" | "mainnet" }) {
  const { network, switchNetwork } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);
  const storageKey = "bizflow_first_visit_choice_dismissed";

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(storageKey);
      if (!dismissed) {
        setIsOpen(true);
      }
    } catch {
      // localStorage may fail in private browsing
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(storageKey, "true");
    } catch {}
    setIsOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSelectNetwork = (mode: "testnet" | "mainnet") => {
    handleDismiss();
    if (mode !== network) {
      switchNetwork(mode);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-surface rounded-xl border border-border shadow-2xl p-6 sm:p-8 overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-canvas transition-colors"
          title="Dismiss dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center max-w-lg mx-auto mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-light text-brand-teal text-xs font-semibold mb-3 border border-brand-teal/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Welcome to BizFlow Pilot V2</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
            Choose How You Want to Start
          </h2>
          <p className="text-xs sm:text-sm text-ink-muted mt-1.5">
            Switch between free practice mode on Arc Testnet and real USDC settlements on Arc Mainnet anytime using the top bar.
          </p>
        </div>

        {/* Choice Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Testnet */}
          <div className="flex flex-col justify-between p-5 rounded-lg border border-border hover:border-amber-400 bg-surface hover:bg-amber-50/20 transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-mono">
                  Arc Testnet (5042002)
                </span>
                {network === "testnet" && (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-200/60 px-1.5 py-0.5 rounded">
                    Active Now
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-ink mb-1">Try it free on testnet</h3>
              <p className="text-xs text-ink-muted mb-4 leading-relaxed">
                Practise with free test USDC from the Circle faucet. Experience autonomous invoice matching, AI timing, and non-custodial settlement with zero real money spent.
              </p>
              <ul className="text-xs text-ink-muted space-y-1.5 mb-5">
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span> Free Circle faucet test USDC
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span> One-click sample data generator
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span> Zero financial risk
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => handleSelectNetwork("testnet")}
              className="w-full py-2.5 px-4 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Start on Testnet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 2: Mainnet */}
          <div className="flex flex-col justify-between p-5 rounded-lg border border-border hover:border-navy bg-surface hover:bg-canvas transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white bg-navy px-2 py-0.5 rounded font-mono">
                  Arc Mainnet (5042)
                </span>
                {network === "mainnet" && (
                  <span className="text-[10px] font-semibold text-navy bg-navy-50 px-1.5 py-0.5 rounded border border-navy/20">
                    Active Now
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-ink mb-1">Use real USDC on mainnet</h3>
              <p className="text-xs text-ink-muted mb-4 leading-relaxed">
                Connect your business wallet to pay real suppliers in USDC on Arc Mainnet. Non-custodial, policy-approved, with on-chain audit proof anchoring.
              </p>
              <ul className="text-xs text-ink-muted space-y-1.5 mb-5">
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span> Real USDC payments on Arc
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span> Non-custodial wallet signing
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span> On-chain audit verification
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => handleSelectNetwork("mainnet")}
              className="w-full py-2.5 px-4 rounded-md bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Go to Mainnet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
