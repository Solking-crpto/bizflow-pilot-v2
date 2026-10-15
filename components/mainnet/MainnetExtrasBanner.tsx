"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, ShieldAlert, ExternalLink, ArrowRight } from "lucide-react";
import { useWallet } from "@/components/auth/WalletContext";
import { useNetwork } from "@/components/network/NetworkContext";
import { ARC_DOCS_URLS } from "@/lib/networks";

export function MainnetExtrasBanner() {
  const { isConnected, address } = useWallet();
  const { isMainnet, switchNetwork } = useNetwork();
  const [isRiskDismissed, setIsRiskDismissed] = useState(true);
  const [balance, setBalance] = useState<bigint | null>(null);

  useEffect(() => {
    if (!isMainnet) return;
    try {
      const dismissed = localStorage.getItem("bizflow_mainnet_risk_ack");
      if (!dismissed) {
        setIsRiskDismissed(false);
      }
    } catch {}
  }, [isMainnet]);

  // Read wallet USDC balance on Arc Mainnet if connected
  useEffect(() => {
    if (!isMainnet || !isConnected || !address || typeof window === "undefined" || !window.ethereum) {
      return;
    }

    let isMounted = true;
    window.ethereum
      .request({
        method: "eth_getBalance",
        params: [address, "latest"],
      })
      .then((hexVal: string) => {
        if (isMounted) {
          try {
            setBalance(BigInt(hexVal));
          } catch {
            setBalance(null);
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isMainnet, isConnected, address]);

  if (!isMainnet) return null;

  const handleDismissRisk = () => {
    try {
      localStorage.setItem("bizflow_mainnet_risk_ack", "true");
    } catch {}
    setIsRiskDismissed(true);
  };

  return (
    <div className="space-y-3 mb-6">
      {/* 1. First-use Risk Acknowledgement */}
      {!isRiskDismissed && (
        <div className="p-4 rounded-lg bg-navy text-white border border-navy-light shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-sm text-white">Arc Mainnet Public Beta Notice</span>
              <p className="text-slate-300 leading-relaxed text-xs">
                Real USDC is transferred on Arc Mainnet (Chain 5042). All payments are non-custodial, signed by your wallet, and irreversible. Single payments are strictly capped at 25.00 USDC during beta.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => switchNetwork("testnet")}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-medium text-[11px] transition-colors cursor-pointer"
            >
              Try Testnet First
            </button>
            <button
              type="button"
              onClick={handleDismissRisk}
              className="px-3 py-1 rounded bg-brand-teal text-navy font-bold text-[11px] hover:bg-brand-teal/90 transition-colors"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {/* 2. Zero-Balance Helper */}
      {isConnected && balance !== null && balance === 0n && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Zero USDC Balance:</strong> You need USDC on Arc mainnet; it also pays gas.
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-[11px]">
            <a
              href={ARC_DOCS_URLS.getUsdcMainnet}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-900 font-semibold hover:underline inline-flex items-center gap-1"
            >
              <span>Get USDC on Arc</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              type="button"
              onClick={() => switchNetwork("testnet")}
              className="text-navy font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Switch to Testnet Sandbox</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
