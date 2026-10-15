"use client";

import React, { useState, useRef, useEffect } from "react";
import { Info, ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react";
import { useNetwork } from "@/components/network/NetworkContext";
import { ARC_DOCS_URLS } from "@/lib/networks";

export function NetworkSwitcher() {
  const { network, config, isMainnet, isTestnet, switchNetwork } = useNetwork();
  const [showInfo, setShowInfo] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowInfo(false);
      }
    }
    if (showInfo) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showInfo]);

  return (
    <div className="flex items-center gap-2" ref={popoverRef}>
      {/* Segmented Control TESTNET | MAINNET */}
      <div
        className="inline-flex items-center p-0.5 rounded-lg bg-canvas border border-border text-xs font-mono select-none"
        role="group"
        aria-label="Network Switcher"
      >
        <button
          type="button"
          onClick={() => switchNetwork("testnet")}
          className={`px-2.5 py-1 rounded-md transition-all font-semibold flex items-center gap-1.5 ${
            isTestnet
              ? "bg-amber-100 text-amber-950 border border-amber-300 shadow-xs"
              : "text-ink-muted hover:text-ink hover:bg-canvas-subtle"
          }`}
          aria-pressed={isTestnet}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isTestnet ? "bg-amber-600 animate-pulse" : "bg-transparent"}`} />
          <span>TESTNET</span>
        </button>

        <button
          type="button"
          onClick={() => switchNetwork("mainnet")}
          className={`px-2.5 py-1 rounded-md transition-all font-semibold flex items-center gap-1.5 ${
            isMainnet
              ? "bg-navy text-white border border-navy-light shadow-xs"
              : "text-ink-muted hover:text-ink hover:bg-canvas-subtle"
          }`}
          aria-pressed={isMainnet}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isMainnet ? "bg-emerald-400 animate-pulse" : "bg-transparent"}`} />
          <span>MAINNET</span>
        </button>
      </div>

      {/* Network Badge & Info Popover Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          aria-expanded={showInfo}
          className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono border transition-all ${
            isMainnet
              ? "bg-navy-50 text-navy-900 border-navy-200 hover:bg-navy-100"
              : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
          }`}
          title="Click for network explanation"
        >
          <span className="font-semibold">{config.badgeLabel}</span>
          <Info className="w-3 h-3 opacity-60" />
        </button>

        {showInfo && (
          <div className="absolute right-0 mt-2 w-80 rounded-xl bg-surface border border-border shadow-xl p-4 text-xs text-ink space-y-3 z-50 animate-scale-in">
            <div className="flex items-start gap-2.5">
              <div
                className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                  isMainnet ? "bg-navy text-white" : "bg-amber-500 text-white"
                }`}
              >
                {isMainnet ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-ink">
                  {isMainnet ? "Arc Mainnet (Production)" : "Arc Testnet (Sandbox)"}
                </h4>
                <p className="text-ink-muted leading-relaxed">
                  {isMainnet
                    ? "Mainnet: real USDC settlement on Arc Chain 5042. Payments and audit anchors are permanent and broadcast on-chain."
                    : "Testnet: practise with free test USDC on Arc Chain 5042002. Nothing real is spent; test USDC has no value."}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border space-y-1.5 font-mono text-[11px] text-ink-muted">
              <div className="flex justify-between">
                <span>Chain ID:</span>
                <span className="font-bold text-ink">{config.chainId}</span>
              </div>
              <div className="flex justify-between">
                <span>USDC Token:</span>
                <span className="truncate max-w-[170px]" title={config.usdcAddress}>
                  {config.usdcAddress}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Explorer:</span>
                <a
                  href={config.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-teal hover:underline inline-flex items-center gap-1"
                >
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <a
                href={ARC_DOCS_URLS.networkInfo}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand-teal hover:underline inline-flex items-center gap-1 font-medium"
              >
                <span>Read official Arc Network docs</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
