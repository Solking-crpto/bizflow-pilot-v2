"use client";

import React from "react";
import { X, ExternalLink, ShieldCheck, Wallet } from "lucide-react";
import { EIP6963ProviderDetail, isMetaMask, getSavedWalletRdns } from "@/lib/auth/eip6963";

interface WalletPickerModalProps {
  isOpen: boolean;
  wallets: EIP6963ProviderDetail[];
  onClose: () => void;
  onSelectWallet: (wallet: EIP6963ProviderDetail, preInitiatedPromise: Promise<string[]>) => void;
}

export function WalletPickerModal({
  isOpen,
  wallets,
  onClose,
  onSelectWallet,
}: WalletPickerModalProps) {
  if (!isOpen) return null;

  const savedRdns = getSavedWalletRdns();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs animate-fade-in">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-surface border border-border shadow-elevated p-5 space-y-4 z-10 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-navy/5 text-navy">
              <Wallet className="w-5 h-5 text-brand-teal" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Choose Web3 Wallet</h3>
              <p className="text-[11px] text-ink-muted">Select an installed wallet to connect</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-canvas transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Discovered Wallets List */}
        <div className="space-y-2">
          {wallets.length === 0 ? (
            <div className="p-4 rounded-xl bg-canvas border border-border text-center space-y-2">
              <p className="text-xs text-ink-muted">No Web3 wallet extensions detected.</p>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-light transition"
              >
                <span>Install MetaMask</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            wallets.map((w) => {
              const isMm = isMetaMask(w);
              const isLastUsed = savedRdns && (w.info.rdns === savedRdns || w.info.uuid === savedRdns);

              return (
                <button
                  key={w.info.uuid || w.info.rdns}
                  onClick={() => {
                    // Synchronously invoke eth_requestAccounts BEFORE any awaits!
                    // This satisfies browser user-gesture requirements for extension popups.
                    const accountsPromise = w.provider.request({
                      method: "eth_requestAccounts",
                    });
                    onSelectWallet(w, accountsPromise);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:border-brand-teal hover:bg-canvas transition text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {w.info.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={w.info.icon}
                        alt={w.info.name}
                        className="w-7 h-7 rounded-lg object-contain shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-navy/10 flex items-center justify-center text-navy font-bold text-xs shrink-0">
                        {w.info.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="truncate">
                      <div className="text-xs font-bold text-ink group-hover:text-navy flex items-center gap-1.5">
                        <span className="truncate">{w.info.name}</span>
                        {isMm && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono font-medium">
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-ink-muted font-mono truncate">
                        {w.info.rdns || "Standard EIP-1193"}
                      </div>
                    </div>
                  </div>

                  {isLastUsed && (
                    <span className="text-[10px] text-brand-teal font-semibold font-mono shrink-0 ml-2">
                      Last used
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Security Notice */}
        <div className="pt-2 border-t border-border flex items-center gap-2 text-[10px] text-ink-muted">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Non-custodial connection. BizFlow never accesses your private keys.</span>
        </div>
      </div>
    </div>
  );
}
