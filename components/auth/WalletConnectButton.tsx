"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Wallet,
  LogOut,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Lock,
  PlusCircle,
} from "lucide-react";
import { useWallet } from "./WalletContext";
import { truncateHash } from "@/lib/utils";

export function WalletConnectButton() {
  const {
    address,
    isConnected,
    isAuthenticated,
    isCorrectNetwork,
    activeNetwork,
    org,
    isAdmin,
    isLoading,
    error,
    connect,
    signIn,
    logout,
    switchNetwork,
  } = useWallet();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  if (isLoading) {
    return (
      <div className="h-8 w-28 rounded-lg bg-canvas border border-border animate-pulse" />
    );
  }

  // State 1: Not connected to window.ethereum
  if (!isConnected) {
    return (
      <div className="flex flex-col items-end">
        <button
          onClick={async () => {
            setActionPending(true);
            await connect();
            setActionPending(false);
          }}
          disabled={actionPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs transition-colors"
        >
          {actionPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Wallet className="w-3.5 h-3.5 text-brand-teal" />
          )}
          <span>Connect Wallet</span>
        </button>
        {error && <span className="text-[10px] text-danger mt-1 max-w-[200px] text-right truncate" title={error}>{error}</span>}
      </div>
    );
  }

  // State 2: Connected but on wrong network
  if (!isCorrectNetwork) {
    return (
      <div className="flex flex-col items-end">
        <button
          onClick={async () => {
            setActionPending(true);
            await switchNetwork();
            setActionPending(false);
          }}
          disabled={actionPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition-colors animate-pulse"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Switch to {activeNetwork.name}</span>
        </button>
        {error && <span className="text-[10px] text-danger mt-1 max-w-[200px] text-right truncate" title={error}>{error}</span>}
      </div>
    );
  }

  // State 3: Connected on Arc, but not yet signed-in via SIWE
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-end">
        <button
          onClick={async () => {
            setActionPending(true);
            await signIn();
            setActionPending(false);
          }}
          disabled={actionPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-teal hover:bg-brand-hover text-white text-xs font-semibold shadow-xs transition-colors"
        >
          {actionPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Lock className="w-3.5 h-3.5" />
          )}
          <span>Sign In With Wallet</span>
        </button>
        {error && <span className="text-[10px] text-danger mt-1 max-w-[200px] text-right truncate" title={error}>{error}</span>}
      </div>
    );
  }

  // State 4: Fully connected and authenticated via SIWE
  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-canvas hover:bg-white border border-border text-ink text-xs font-medium transition shadow-xs"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <div className="flex flex-col text-left leading-tight">
          <span className="text-[10px] text-ink-muted uppercase font-mono font-semibold">
            {org ? org.name : "Unregistered Business"}
          </span>
          <span className="font-mono text-[11px] font-bold text-navy">
            {truncateHash(address || "", 6, 4)}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-ink-muted" />
      </button>

      {dropdownOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
          />
          <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-surface border border-border shadow-elevated z-50 p-2 space-y-1 text-xs">
            <div className="p-2 border-b border-border mb-1">
              <div className="text-[10px] uppercase font-bold text-ink-muted">Active Tenant</div>
              <div className="font-semibold text-ink truncate mt-0.5">
                {org?.name || "No Business Setup"}
              </div>
              <div className="text-[11px] font-mono text-ink-muted truncate mt-0.5">
                {address}
              </div>
              {isAdmin && (
                <span className="inline-block mt-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  Admin Authority
                </span>
              )}
            </div>

            {!org && (
              <Link
                href="/onboarding"
                onClick={() => setDropdownOpen(false)}
                className="w-full flex items-center gap-2 p-2 rounded-lg text-brand-teal hover:bg-brand-light font-medium transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Onboard Business Profile</span>
              </Link>
            )}

            <Link
              href="/settings"
              onClick={() => setDropdownOpen(false)}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-ink hover:bg-canvas transition-colors"
            >
              <Building2 className="w-4 h-4 text-ink-muted" />
              <span>Governance Settings</span>
            </Link>

            <button
              onClick={() => {
                setDropdownOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-danger hover:bg-danger-light transition-colors text-left font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span>Disconnect & Logout</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
