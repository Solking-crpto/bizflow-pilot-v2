"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  NetworkMode,
  NetworkConfig,
  NETWORKS,
  DEFAULT_NETWORK,
  NETWORK_COOKIE_NAME,
  NETWORK_HEADER_NAME,
  getWalletAddChainParams,
  isValidNetwork,
} from "@/lib/networks";

interface NetworkContextValue {
  network: NetworkMode;
  config: NetworkConfig;
  isMainnet: boolean;
  isTestnet: boolean;
  switchNetwork: (target: NetworkMode) => void;
  getNetworkHeaders: () => Record<string, string>;
  isConfirmingMainnet: boolean;
  confirmSwitchToMainnet: () => void;
  cancelSwitchToMainnet: () => void;
  crossTabNotice: string | null;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

function getInitialNetwork(): NetworkMode {
  if (typeof window === "undefined") return DEFAULT_NETWORK;

  // 1. Read cookie
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${NETWORK_COOKIE_NAME}=([^;]+)`));
  if (match && isValidNetwork(match[1])) {
    return match[1];
  }

  // 2. Read localStorage
  const saved = localStorage.getItem("bizflow_active_network");
  if (saved && isValidNetwork(saved)) {
    return saved;
  }

  return DEFAULT_NETWORK;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetworkState] = useState<NetworkMode>(getInitialNetwork);
  const [isConfirmingMainnet, setIsConfirmingMainnet] = useState(false);
  const [crossTabNotice, setCrossTabNotice] = useState<string | null>(null);

  const config = NETWORKS[network] || NETWORKS[DEFAULT_NETWORK];

  const persistNetwork = useCallback((mode: NetworkMode) => {
    // 1. Set cookie (1 year, SameSite=Lax, Secure if HTTPS)
    const secureFlag = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${NETWORK_COOKIE_NAME}=${mode}; path=/; max-age=31536000; SameSite=Lax${secureFlag}`;

    // 2. Set localStorage
    try {
      localStorage.setItem("bizflow_active_network", mode);
    } catch {}

    // 3. Broadcast to other tabs
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("bizflow_network_channel");
        channel.postMessage({ type: "NETWORK_SWITCH", network: mode });
        channel.close();
      }
    } catch {}
  }, []);

  const applyNetworkSwitch = useCallback(
    async (mode: NetworkMode) => {
      persistNetwork(mode);
      setNetworkState(mode);

      // Offer to switch chain in wallet if window.ethereum is connected
      if (typeof window !== "undefined" && (window as any).ethereum) {
        const ethereum = (window as any).ethereum;
        const targetChainIdHex = mode === "mainnet" ? "0x13B2" : "0x4CECE2"; // 5042 or 5042002
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: targetChainIdHex }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
            try {
              const chainParams = getWalletAddChainParams(mode);
              await ethereum.request({
                method: "wallet_addEthereumChain",
                params: [chainParams],
              });
            } catch (addError) {
              console.warn("Failed to add network to wallet:", addError);
              setCrossTabNotice(
                "Notice: Arc chain addition failed. Follow the official setup guide: https://docs.arc.network"
              );
            }
          }
        }
      }

      // If on verify page, update the network segment in the URL rather than simple reload
      if (typeof window !== "undefined") {
        const pathname = window.location.pathname;
        if (pathname.startsWith("/verify/")) {
          const parts = pathname.split("/");
          if (parts.length >= 4 && (parts[2] === "mainnet" || parts[2] === "testnet")) {
            parts[2] = mode;
            window.location.href = parts.join("/") + window.location.search;
            return;
          }
        }
        window.location.reload();
      }
    },
    [persistNetwork]
  );

  const switchNetwork = useCallback(
    (target: NetworkMode) => {
      if (target === network) return;

      if (target === "mainnet") {
        // Mainnet requires explicit user confirmation
        setIsConfirmingMainnet(true);
      } else {
        // Testnet switches immediately
        applyNetworkSwitch("testnet");
      }
    },
    [network, applyNetworkSwitch]
  );

  const confirmSwitchToMainnet = useCallback(() => {
    setIsConfirmingMainnet(false);
    applyNetworkSwitch("mainnet");
  }, [applyNetworkSwitch]);

  const cancelSwitchToMainnet = useCallback(() => {
    setIsConfirmingMainnet(false);
  }, []);

  // Listen for cross-tab network switches
  useEffect(() => {
    if (typeof window === "undefined") return;

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel("bizflow_network_channel");
        channel.onmessage = (event) => {
          if (event.data?.type === "NETWORK_SWITCH" && event.data?.network) {
            const newMode = event.data.network;
            if (newMode !== network && isValidNetwork(newMode)) {
              setCrossTabNotice(`Network changed to ${newMode.toUpperCase()} in another tab. Synchronizing...`);
              setTimeout(() => {
                window.location.reload();
              }, 1200);
            }
          }
        };
      }
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "bizflow_active_network" && e.newValue && isValidNetwork(e.newValue)) {
        if (e.newValue !== network) {
          setCrossTabNotice(`Network changed to ${e.newValue.toUpperCase()} in another tab. Synchronizing...`);
          setTimeout(() => {
            window.location.reload();
          }, 1200);
        }
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, [network]);

  // Handle deep links (?network=testnet or ?network=mainnet)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetParam = params.get("network");

    if (targetParam && isValidNetwork(targetParam)) {
      if (targetParam !== network) {
        if (targetParam === "mainnet") {
          setIsConfirmingMainnet(true);
        } else {
          applyNetworkSwitch("testnet");
        }
      }
      // Clean up URL query parameter without retriggering
      params.delete("network");
      const cleanSearch = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState({}, "", `${window.location.pathname}${cleanSearch}`);
    }
  }, [network, applyNetworkSwitch]);

  const getNetworkHeaders = useCallback((): Record<string, string> => {
    return {
      [NETWORK_HEADER_NAME]: network,
    };
  }, [network]);

  // Dismiss confirmation modal on Escape key
  useEffect(() => {
    if (!isConfirmingMainnet) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelSwitchToMainnet();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isConfirmingMainnet, cancelSwitchToMainnet]);

  return (
    <NetworkContext.Provider
      value={{
        network,
        config,
        isMainnet: network === "mainnet",
        isTestnet: network === "testnet",
        switchNetwork,
        getNetworkHeaders,
        isConfirmingMainnet,
        confirmSwitchToMainnet,
        cancelSwitchToMainnet,
        crossTabNotice,
      }}
    >
      {children}

      {/* Mainnet Switch Confirmation Modal */}
      {isConfirmingMainnet && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelSwitchToMainnet();
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="w-12 h-12 rounded-xl bg-navy-50 text-navy flex items-center justify-center border border-navy/20">
              <span className="text-xl font-bold font-mono">!</span>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-ink">Switch to Arc Mainnet?</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                You are switching to <strong className="text-ink">Arc Mainnet</strong> with real USDC. All payments and contract actions on Mainnet are permanent, settlement-final, and broadcast to the live Arc ledger.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-canvas border border-border text-xs text-ink-muted space-y-1">
              <div className="font-semibold text-ink flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-navy" />
                <span>Chain 5042 • Real USDC Settlement</span>
              </div>
              <p>Your browser wallet will be prompted to switch to Arc Mainnet.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={cancelSwitchToMainnet}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-ink-muted hover:text-ink hover:bg-canvas transition-colors"
              >
                Stay on Testnet
              </button>
              <button
                type="button"
                onClick={confirmSwitchToMainnet}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-navy text-white hover:bg-navy/90 transition-colors shadow-sm"
              >
                Switch to Mainnet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Tab Synchronization Notice */}
      {crossTabNotice && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy text-white text-xs font-medium shadow-xl animate-slide-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{crossTabNotice}</span>
        </div>
      )}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}
