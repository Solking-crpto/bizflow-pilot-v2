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
  X,
  ExternalLink,
} from "lucide-react";
import { useWallet } from "./WalletContext";
import { WalletPickerModal } from "./WalletPickerModal";
import { truncateHash } from "@/lib/utils";
import { EIP6963ProviderDetail } from "@/lib/auth/eip6963";

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
    isConnecting,
    error,
    discoveredWallets,
    connectWithProvider,
    cancelConnecting,
    signIn,
    logout,
    switchNetwork,
  } = useWallet();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="h-8 w-24 sm:w-28 rounded-lg bg-canvas border border-border animate-pulse" />
    );
  }

  const activeError = error && error !== dismissedError ? error : null;

  // Floating Toast Notification for errors
  const errorToast = activeError && (
    <div className="absolute right-0 top-full mt-2 z-50 w-80 p-3 rounded-xl bg-surface border border-danger/40 shadow-xl text-xs text-ink flex items-start gap-2 animate-scale-in">
      <AlertTriangle className="w-4 h-4 shrink-0 text-danger mt-0.5" />
      <div className="flex-1 text-[11px] leading-tight space-y-1">
        <span className="font-bold text-danger block">Wallet Notice</span>
        {activeError.includes("Install MetaMask") ? (
          <div className="space-y-1.5">
            <p className="text-ink-muted">No Web3 wallet detected in your browser.</p>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-navy hover:underline"
            >
              <span>Install MetaMask</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : (
          <span className="text-ink-muted">{activeError}</span>
        )}
      </div>
      <button
        onClick={() => setDismissedError(error)}
        className="text-ink-muted hover:text-ink text-xs p-0.5 rounded"
        title="Dismiss notice"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  // Connecting State Overlay / Card with Cancel button
  const connectingBanner = isConnecting && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-sm rounded-2xl bg-surface border border-border shadow-elevated p-5 text-center space-y-4 animate-scale-in">
        <div className="mx-auto w-12 h-12 rounded-full bg-brand-light flex items-center justify-center text-brand-teal">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-ink">Connecting... check your wallet extension</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            Please open your wallet extension to approve the connection request.
          </p>
        </div>
        <button
          onClick={cancelConnecting}
          className="w-full py-2 px-3 rounded-lg border border-border bg-canvas hover:bg-white text-ink text-xs font-semibold transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  // Direct Click Handler for connecting
  const handleConnectClick = () => {
    setDismissedError(null);

    // If multiple wallets discovered, open wallet picker so user can pick
    if (discoveredWallets.length > 1) {
      setPickerOpen(true);
      return;
    }

    // If exactly 1 wallet discovered, call eth_requestAccounts directly inside click handler!
    if (discoveredWallets.length === 1) {
      const singleWallet = discoveredWallets[0];
      const accountsPromise = singleWallet.provider.request({
        method: "eth_requestAccounts",
      });
      connectWithProvider(singleWallet, accountsPromise);
      return;
    }

    // Fallback: window.ethereum
    if (typeof window !== "undefined" && window.ethereum) {
      const accountsPromise = window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const fallbackDetail: EIP6963ProviderDetail = {
        info: {
          uuid: "window.ethereum",
          name: "Browser Wallet",
          icon: "",
          rdns: "window.ethereum",
        },
        provider: window.ethereum,
      };
      connectWithProvider(fallbackDetail, accountsPromise);
      return;
    }

    // No wallet installed
    setPickerOpen(true);
  };

  // State 1: Not connected to wallet
  if (!isConnected) {
    return (
      <div className="relative">
        <button
          onClick={handleConnectClick}
          disabled={isConnecting}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
          title="Connect Web3 Wallet"
        >
          {isConnecting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Wallet className="w-3.5 h-3.5 text-brand-teal" />
          )}
          <span className="hidden sm:inline">Connect Wallet</span>
          <span className="inline sm:hidden">Connect</span>
        </button>
        {errorToast}
        {connectingBanner}
        <WalletPickerModal
          isOpen={pickerOpen}
          wallets={discoveredWallets}
          onClose={() => setPickerOpen(false)}
          onSelectWallet={(wallet, preInitiatedPromise) => {
            setPickerOpen(false);
            connectWithProvider(wallet, preInitiatedPromise);
          }}
        />
      </div>
    );
  }

  // State 2: Connected but on wrong network
  if (!isCorrectNetwork) {
    return (
      <div className="relative">
        <button
          onClick={async () => {
            setActionPending(true);
            setDismissedError(null);
            await switchNetwork();
            setActionPending(false);
          }}
          disabled={actionPending}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition-colors animate-pulse shrink-0"
          title={`Switch to ${activeNetwork.name}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Switch to {activeNetwork.name}</span>
          <span className="inline sm:hidden">Switch</span>
        </button>
        {errorToast}
      </div>
    );
  }

  // State 3: Connected on Arc, but not yet signed-in via SIWE
  if (!isAuthenticated) {
    return (
      <div className="relative">
        <button
          onClick={async () => {
            setActionPending(true);
            setDismissedError(null);
            await signIn();
            setActionPending(false);
          }}
          disabled={actionPending}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-brand-teal hover:bg-brand-hover text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
          title="Sign in with SIWE"
        >
          {actionPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Lock className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Sign In With Wallet</span>
          <span className="inline sm:hidden">Sign In</span>
        </button>
        {errorToast}
      </div>
    );
  }

  // State 4: Fully connected and authenticated via SIWE
  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-lg bg-canvas hover:bg-white border border-border text-ink text-xs font-medium transition shadow-xs shrink-0"
        aria-label="Account details"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <div className="flex flex-col text-left leading-tight min-w-0">
          <span className="text-[9px] sm:text-[10px] text-ink-muted uppercase font-mono font-semibold truncate max-w-[80px] sm:max-w-[120px]">
            {org ? org.name : "Active Wallet"}
          </span>
          <span className="font-mono text-[10px] sm:text-[11px] font-bold text-navy truncate">
            {truncateHash(address || "", 4, 3)}
          </span>
        </div>
        <ChevronDown className="w-3 h-3 text-ink-muted shrink-0" />
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
