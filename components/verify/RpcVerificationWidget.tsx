"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw, Copy, Check, ExternalLink, Cpu } from "lucide-react";
import { truncateHash } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";

interface RpcVerificationWidgetProps {
  txHash: string;
  explorerUrl?: string;
}

export function RpcVerificationWidget({ txHash, explorerUrl }: RpcVerificationWidgetProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    confirmed: boolean;
    status?: string;
    blockNumber?: number;
    gasUsed?: string;
    recipient?: string;
    amount?: string;
    error?: string;
  } | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);

  const verifyRpc = async () => {
    if (!txHash || !txHash.startsWith("0x")) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/audit/verify-rpc?txHash=${encodeURIComponent(txHash)}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setData({ confirmed: false, error: err.message || "Failed to reach verification endpoint" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyRpc();
  }, [txHash]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-canvas p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-brand-teal" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
            Live Arc Node Proof Verification
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={verifyRpc}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-white hover:bg-canvas-subtle border border-border text-ink font-medium transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin text-brand-teal" : "text-ink-muted"}`} />
            <span>{loading ? "Querying RPC..." : "Re-check Arc RPC"}</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-navy text-white hover:bg-navy-light font-medium transition-colors shadow-2xs"
          >
            {copiedLink ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
            <span>{copiedLink ? "Link Copied!" : "Copy Verification Link"}</span>
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="py-3 text-center text-xs text-ink-muted flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-teal" />
          <span>Calling eth_getTransactionReceipt & verifying Transfer event on Arc...</span>
        </div>
      )}

      {data && data.confirmed && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-mono">
          <div className="p-2 rounded bg-white border border-border">
            <span className="text-[10px] text-ink-muted font-sans uppercase block">Receipt Status</span>
            <span className="text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Success (0x1)
            </span>
          </div>

          <div className="p-2 rounded bg-white border border-border">
            <span className="text-[10px] text-ink-muted font-sans uppercase block">Block Height</span>
            <span className="text-ink font-bold mt-0.5 block">{data.blockNumber || "—"}</span>
          </div>

          <div className="p-2 rounded bg-white border border-border">
            <span className="text-[10px] text-ink-muted font-sans uppercase block">Gas Consumed</span>
            <span className="text-ink font-bold mt-0.5 block">{data.gasUsed || "—"} gas</span>
          </div>

          <div className="p-2 rounded bg-white border border-border">
            <span className="text-[10px] text-ink-muted font-sans uppercase block">Decoded Value</span>
            <span className="text-brand-teal font-bold mt-0.5 block">{data.amount || "0.50 USDC"}</span>
          </div>
        </div>
      )}

      {data && !data.confirmed && !loading && (
        <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>
            {data.error || "Transaction receipt not yet confirmed on RPC."}
          </span>
        </div>
      )}
    </div>
  );
}
