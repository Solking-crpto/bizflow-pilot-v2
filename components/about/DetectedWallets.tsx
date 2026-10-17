"use client";

import React, { useState, useEffect } from "react";
import { Wallet, CheckCircle2, Info, ExternalLink } from "lucide-react";
import { EIP6963ProviderDetail, subscribeToEip6963, isMetaMask } from "@/lib/auth/eip6963";

export function DetectedWallets() {
  const [wallets, setWallets] = useState<EIP6963ProviderDetail[]>([]);
  const [hasWindowEthereum, setHasWindowEthereum] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setHasWindowEthereum(typeof window !== "undefined" && !!window.ethereum);
    const unsubscribe = subscribeToEip6963((discovered) => {
      setWallets(discovered);
    });
    return unsubscribe;
  }, []);

  if (!mounted) {
    return (
      <div className="p-4 rounded-xl bg-canvas border border-border animate-pulse h-20" />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink flex items-center gap-2">
          <Wallet className="w-5 h-5 text-brand-teal" />
          <span>Detected Browser Wallets (EIP-6963 Multi-Provider Discovery)</span>
        </h2>
        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-brand-light text-brand-teal">
          {wallets.length} Discovered
        </span>
      </div>

      <p className="text-xs text-ink-muted leading-relaxed">
        BizFlow Pilot V2 implements <strong>EIP-6963</strong> to eliminate wallet extension collisions in multi-wallet browsers.
        Below are the active wallet extensions currently announcing themselves in your browser session:
      </p>

      {wallets.length === 0 ? (
        <div className="p-4 rounded-xl bg-canvas border border-border flex items-start justify-between gap-3 text-xs">
          <div className="space-y-1">
            <span className="font-semibold text-ink flex items-center gap-1.5">
              <Info className="w-4 h-4 text-ink-muted" />
              {hasWindowEthereum ? "Generic Browser Wallet (window.ethereum)" : "No EIP-6963 wallet extensions announcing"}
            </span>
            <p className="text-ink-muted text-[11px]">
              {hasWindowEthereum
                ? "A legacy window.ethereum provider is active, but no extensions announced via EIP-6963."
                : "Install MetaMask, Rabby, or another EIP-6963 compatible wallet extension to connect."}
            </p>
          </div>
          {!hasWindowEthereum && (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:underline shrink-0"
            >
              <span>Install MetaMask</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {wallets.map((w) => {
            const isMm = isMetaMask(w);
            return (
              <div
                key={w.info.uuid || w.info.rdns}
                className="p-3 rounded-xl border border-border bg-canvas flex items-center gap-3"
              >
                {w.info.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={w.info.icon}
                    alt={w.info.name}
                    className="w-8 h-8 rounded-lg object-contain shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-navy/10 flex items-center justify-center text-navy font-bold text-xs shrink-0">
                    {w.info.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-ink truncate flex items-center gap-1">
                    <span className="truncate">{w.info.name}</span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  </div>
                  <div className="text-[10px] text-ink-muted font-mono truncate">
                    {w.info.rdns || "EIP-1193"}
                  </div>
                  {isMm && (
                    <span className="inline-block mt-0.5 text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-mono font-medium">
                      MetaMask Priority
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
