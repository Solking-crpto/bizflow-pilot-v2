"use client";

import React, { useState } from "react";
import { AlertTriangle, Droplets, Database, ExternalLink, Check, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { useWallet } from "@/components/auth/WalletContext";
import { getWalletAddChainParams, ARC_DOCS_URLS } from "@/lib/networks";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiFetch";

export function TestnetExtrasPanel() {
  const { address, isAuthenticated, activeNetwork, signIn } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [sampleMessage, setSampleMessage] = useState<string | null>(null);
  const [copiedSetting, setCopiedSetting] = useState<string | null>(null);
  const router = useRouter();

  if (activeNetwork.mode !== "testnet") return null;

  const chainParams = getWalletAddChainParams("testnet");

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSetting(id);
    setTimeout(() => setCopiedSetting(null), 2000);
  };

  const handleAddChainToWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [chainParams],
      });
    } catch (err: any) {
      alert("Failed to add network: " + (err?.message || "Unknown error"));
    }
  };

  const handleLoadSampleData = async () => {
    if (!isAuthenticated) {
      const signedIn = await signIn();
      if (!signedIn) return;
    }

    setIsLoadingSample(true);
    setSampleMessage(null);

    try {
      const res = await apiFetch("/api/sample-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (res.ok) {
        setSampleMessage("Sample dataset generated! Created PO, Goods Receipt, and 0.05 USDC Invoice.");
        router.refresh();
      } else {
        setSampleMessage("Error: " + (data.error || "Failed to create sample data"));
      }
    } catch (err: any) {
      setSampleMessage("Error: " + (err?.message || "Network error"));
    } finally {
      setIsLoadingSample(false);
    }
  };

  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50/70 overflow-hidden shadow-xs">
      {/* Top Banner */}
      <div className="px-4 py-2 bg-amber-100 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-amber-950 font-medium">
          <Database className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Testnet AP Sandbox</strong> — Practice autonomous accounts payable risk-free.
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Load Sample Data Button */}
          <button
            type="button"
            onClick={handleLoadSampleData}
            disabled={isLoadingSample}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors disabled:opacity-50 text-[11px] shadow-2xs"
            title="Create sample PO, Goods Receipt, and Invoice tagged [SAMPLE]"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{isLoadingSample ? "Loading sample..." : "Load Sample Data"}</span>
          </button>

          {/* Toggle Wallet/Faucet Drawer */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-200/80 hover:bg-amber-200 text-amber-900 font-semibold text-[11px] transition-colors"
          >
            <Droplets className="w-3.5 h-3.5 text-amber-700" />
            <span>Get Free Test USDC</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Success/Error message banner */}
      {sampleMessage && (
        <div className="px-4 py-2 bg-white/90 border-b border-amber-200 text-xs font-medium text-ink flex items-center justify-between">
          <span>{sampleMessage}</span>
          <button onClick={() => setSampleMessage(null)} className="text-ink-muted hover:text-ink text-xs ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Collapsible Panel: Faucet & Exact Arc Testnet Settings */}
      {isOpen && (
        <div className="p-4 sm:p-5 bg-white text-xs text-ink space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Step 1: Circle Faucet */}
            <div className="p-4 rounded-md border border-border bg-canvas/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-brand-teal" /> Step 1: Request Test USDC
                </span>
                <a
                  href={ARC_DOCS_URLS.testnetFaucet}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-teal hover:underline"
                >
                  <span>Circle Faucet</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-ink-muted leading-relaxed">
                Visit the official Circle Faucet to request testnet USDC on Arc Testnet for your wallet address.
              </p>
              {address && (
                <div className="flex items-center justify-between p-2 rounded bg-surface border border-border font-mono text-[11px]">
                  <span className="truncate mr-2">{address}</span>
                  <button
                    onClick={() => handleCopy(address, "address")}
                    className="text-brand-teal hover:underline shrink-0 flex items-center gap-1"
                  >
                    {copiedSetting === "address" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSetting === "address" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: Exact Arc Testnet Settings */}
            <div className="p-4 rounded-md border border-border bg-canvas/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink">Step 2: Add Arc Testnet to Wallet</span>
                <button
                  type="button"
                  onClick={handleAddChainToWallet}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-navy text-white text-[11px] font-semibold hover:bg-navy-light transition-colors"
                >
                  Add to Wallet
                </button>
              </div>

              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between py-0.5 border-b border-border/50">
                  <span className="text-ink-muted">Network Name:</span>
                  <span className="font-semibold">{chainParams.chainName}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-border/50">
                  <span className="text-ink-muted">RPC URL:</span>
                  <span className="truncate max-w-[180px]">{chainParams.rpcUrls[0]}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-border/50">
                  <span className="text-ink-muted">Chain ID:</span>
                  <span>5042002 ({chainParams.chainId})</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-border/50">
                  <span className="text-ink-muted">Currency:</span>
                  <span>USDC (18 decimals)</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-ink-muted">Explorer:</span>
                  <span className="truncate max-w-[180px]">{chainParams.blockExplorerUrls[0]}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
