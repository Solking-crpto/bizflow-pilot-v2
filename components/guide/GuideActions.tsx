"use client";

import React from "react";
import { ArrowRight, Droplets, ExternalLink, Sparkles } from "lucide-react";
import { useNetwork } from "@/components/network/NetworkContext";
import { NETWORKS } from "@/lib/networks";
import Link from "next/link";

export function GuideActionButtons() {
  const { network, switchNetwork } = useNetwork();
  const faucetUrl = NETWORKS.testnet.faucetUrl || "https://faucet.circle.com";

  const handleStartTestnet = () => {
    if (network !== "testnet") {
      switchNetwork("testnet");
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-6 border-t border-border">
      <Link
        href="/"
        onClick={handleStartTestnet}
        className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
      >
        <Sparkles className="w-4 h-4 text-amber-200" />
        <span>Try it free on testnet</span>
        <ArrowRight className="w-4 h-4" />
      </Link>

      <a
        href={faucetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-5 py-2.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 font-semibold text-sm shadow-2xs transition-colors inline-flex items-center gap-2"
      >
        <Droplets className="w-4 h-4 text-amber-700" />
        <span>Get free test USDC</span>
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

export function GuideFaucetButton() {
  const faucetUrl = NETWORKS.testnet.faucetUrl || "https://faucet.circle.com";

  return (
    <a
      href={faucetUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors shadow-2xs shrink-0"
    >
      <Droplets className="w-3.5 h-3.5" />
      <span>Open Free Faucet</span>
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}
