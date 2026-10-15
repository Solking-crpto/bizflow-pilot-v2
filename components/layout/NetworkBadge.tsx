"use client";

import React from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";

export function NetworkBanner({
  mode,
  isPublicSandbox,
}: {
  mode: "testnet" | "mainnet";
  isPublicSandbox?: boolean;
}) {
  if (isPublicSandbox && mode === "testnet") {
    return (
      <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 text-center text-xs font-semibold text-amber-950 flex items-center justify-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          <strong>Sandbox: test USDC only</strong> — Visitor sandbox mode active (Circle Wallets, ARC-TESTNET). Rate-limited to 0.05 USDC test settlements.
        </span>
      </div>
    );
  }

  if (mode !== "testnet") return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1 text-center text-xs font-medium text-amber-800 flex items-center justify-center gap-2">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
      <span>
        <strong>STAGING SIMULATION (ARC TESTNET)</strong> — No real funds are at risk. Gas and settlement denominated in Circle Testnet USDC.
      </span>
    </div>
  );
}

export function NetworkBadge({ mode }: { mode: "testnet" | "mainnet" }) {
  if (mode === "mainnet") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-navy text-white text-xs font-mono font-medium shadow-sm border border-navy-light">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold">ARC MAINNET: real USDC</span>
        <span className="text-[10px] text-slate-300 bg-white/10 px-1 py-0.2 rounded">5042</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-mono font-medium">
      <span className="w-2 h-2 rounded-full bg-amber-500" />
      <span>TESTNET: no real funds</span>
      <span className="text-[10px] text-amber-700 bg-amber-100 px-1 py-0.2 rounded">5042002</span>
    </div>
  );
}
