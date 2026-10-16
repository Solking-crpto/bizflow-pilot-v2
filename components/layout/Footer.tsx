"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Copy, Check, ExternalLink, ShieldCheck, Github, Layers } from "lucide-react";
import { truncateHash } from "@/lib/utils";
import { useNetwork } from "@/components/network/NetworkContext";

interface FooterProps {
  networkMode?: "testnet" | "mainnet";
}

export function Footer({ networkMode }: FooterProps) {
  const { network } = useNetwork();
  const activeMode = networkMode || network;
  const [copied, setCopied] = useState(false);

  // Read anchor address strictly from AUDIT_ANCHOR_ADDRESS_TESTNET / AUDIT_ANCHOR_ADDRESS_MAINNET
  const rawAnchorAddress =
    activeMode === "mainnet"
      ? process.env.AUDIT_ANCHOR_ADDRESS_MAINNET
      : process.env.AUDIT_ANCHOR_ADDRESS_TESTNET;

  const anchorAddress =
    rawAnchorAddress && rawAnchorAddress.trim().startsWith("0x")
      ? rawAnchorAddress.trim()
      : null;

  const isAnchorDeployed = Boolean(anchorAddress);

  const repoUrl =
    process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/Solking-crpto/bizflow-pilot-v2";

  const explorerUrl = anchorAddress
    ? (activeMode === "mainnet"
        ? `https://explorer.arc.io/address/${anchorAddress}`
        : `https://testnet.arcscan.app/address/${anchorAddress}`)
    : "#";

  const copyAnchor = () => {
    if (!anchorAddress) return;
    navigator.clipboard.writeText(anchorAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@bizflow.io";
  const supportMailto = `mailto:${supportEmail}?subject=BizFlow%20Pilot%20V2%20Problem%20Report`;

  return (
    <footer className="border-t border-border bg-surface text-ink text-xs mt-auto overflow-hidden">
      <div className="max-w-[1280px] w-full mx-auto px-3 sm:px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 overflow-hidden">
        {/* Left: Built for Arc + Beta note + Legal Links */}
        <div className="flex flex-wrap items-center gap-2 text-ink-muted">
          <span className="font-semibold text-navy">BizFlow Pilot V2</span>
          <span>•</span>
          <span className="text-brand-teal font-medium">Non-Custodial Beta</span>
          <span>•</span>
          <span className="font-mono text-[11px] bg-canvas px-1.5 py-0.5 rounded border border-border">
            v2.1.0
          </span>
          <span>•</span>
          <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/70 font-medium">
            Beta Limit: 25.00 USDC max / payment
          </span>
          <span>•</span>
          <Link href="/terms" className="hover:text-navy transition-colors underline">
            Terms
          </Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-navy transition-colors underline">
            Privacy
          </Link>
          <span>•</span>
          <Link href="/risk" className="hover:text-navy transition-colors underline">
            Risk Notice
          </Link>
          <span>•</span>
          <a href={supportMailto} className="hover:text-brand-teal transition-colors underline">
            Report a Problem
          </a>
        </div>

        {/* Right: Contract Anchor + Network + Repo */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Audit Anchor contract */}
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] bg-canvas px-2.5 py-1 rounded border border-border">
            <ShieldCheck className={`w-3.5 h-3.5 ${isAnchorDeployed ? "text-brand-teal" : "text-ink-muted"}`} />
            {isAnchorDeployed && anchorAddress ? (
              <>
                <span className="text-ink-muted font-sans">Anchor:</span>
                <span className="text-ink font-semibold" title={anchorAddress}>
                  {truncateHash(anchorAddress, 6, 4)}
                </span>
                <button
                  onClick={copyAnchor}
                  className="p-0.5 text-ink-muted hover:text-ink transition-colors"
                  title="Copy contract address"
                  aria-label="Copy anchor contract address"
                >
                  {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                </button>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-0.5 text-ink-muted hover:text-brand-teal transition-colors"
                  title="Open contract in Arc Explorer"
                  aria-label="Open contract in Arc Explorer"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>
            ) : (
              <span
                className="text-ink-muted font-sans italic cursor-not-allowed"
                title={`Audit anchor smart contract is not deployed on Arc ${activeMode === "mainnet" ? "Mainnet" : "Testnet"} yet. Set AUDIT_ANCHOR_ADDRESS_${activeMode.toUpperCase()} in the environment to configure.`}
              >
                Audit anchor: not deployed yet
              </span>
            )}
          </div>

          {/* Network tag */}
          <span className="font-mono text-[11px] px-2 py-1 rounded bg-canvas border border-border font-medium text-ink">
            Arc {activeMode === "mainnet" ? "5042" : "5042002"}
          </span>

          {/* Repo Link */}
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-ink-muted hover:text-navy transition-colors font-medium"
            title="Public GitHub Repository"
            aria-label="Public GitHub Repository"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
