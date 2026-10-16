"use client";

import React from "react";
import { AlertTriangle, ShieldCheck, ExternalLink } from "lucide-react";
import { useNetwork } from "@/components/network/NetworkContext";
import { NETWORKS } from "@/lib/networks";

export function NetworkBanner({
  mode,
  isPublicSandbox,
}: {
  mode?: "testnet" | "mainnet";
  isPublicSandbox?: boolean;
}) {
  const { isTestnet, network } = useNetwork();
  // Request-scoped runtime network is active truth
  const currentIsTestnet = network ? network === "testnet" : isTestnet;
  const faucetUrl = NETWORKS.testnet.faucetUrl || "https://faucet.circle.com";

  if (isPublicSandbox && currentIsTestnet) {
    return (
      <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 text-center text-xs font-semibold text-amber-950 flex flex-wrap items-center justify-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          <strong>TESTNET: test USDC has no value</strong> — Visitor sandbox active (Circle Wallets, ARC-TESTNET). Rate-limited to 0.05 USDC test settlements.
        </span>
        <a
          href={faucetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-200/90 hover:bg-amber-300 px-2 py-0.5 rounded border border-amber-400/60 transition-colors underline decoration-amber-600"
        >
          <span>Get free test USDC</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  if (!currentIsTestnet) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 text-center text-xs font-semibold text-amber-950 flex flex-wrap items-center justify-center gap-2 shadow-2xs">
      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
      <span>
        <strong>TESTNET: test USDC has no value</strong> — Practise with free test USDC on Arc Chain 5042002. Nothing real is spent.
      </span>
      <a
        href={faucetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-200/90 hover:bg-amber-300 px-2 py-0.5 rounded border border-amber-400/60 transition-colors underline decoration-amber-600"
      >
        <span>Get free test USDC</span>
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

export function NetworkBadge({ mode }: { mode?: "testnet" | "mainnet" }) {
  const { isMainnet } = useNetwork();
  const currentIsMainnet = mode !== undefined ? mode === "mainnet" : isMainnet;

  if (currentIsMainnet) {
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
      <span>TESTNET: test USDC has no value</span>
      <span className="text-[10px] text-amber-700 bg-amber-100 px-1 py-0.2 rounded">5042002</span>
    </div>
  );
}
