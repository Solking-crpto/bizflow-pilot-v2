"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { getActiveNetwork, NetworkConfig } from "@/lib/networks";
import { useNetwork } from "@/components/network/NetworkContext";
import { buildSiweMessage } from "@/lib/auth/siwe";
import { apiFetch } from "@/lib/apiFetch";
import {
  EIP6963ProviderDetail,
  EIP6963ProviderInfo,
  subscribeToEip6963,
  getSavedWalletRdns,
  setSavedWalletRdns,
  clearSavedWalletRdns,
  mapWalletError,
} from "@/lib/auth/eip6963";

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface OrgSummary {
  id: string;
  name: string;
  currency?: string;
}

interface WalletContextType {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  isCorrectNetwork: boolean;
  activeNetwork: NetworkConfig;
  org: OrgSummary | null;
  isAdmin: boolean;
  isLoading: boolean;
  isConnecting: boolean;
  error: string | null;
  discoveredWallets: EIP6963ProviderDetail[];
  selectedWalletInfo: EIP6963ProviderInfo | null;
  selectedProvider: any;
  connect: () => Promise<string | null>;
  connectWithProvider: (
    walletDetail: EIP6963ProviderDetail,
    preInitiatedPromise?: Promise<string[]>
  ) => Promise<string | null>;
  cancelConnecting: () => void;
  signIn: () => Promise<boolean>;
  logout: () => Promise<void>;
  switchNetwork: () => Promise<boolean>;
  refreshSession: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { config: activeNetwork } = useNetwork();
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [org, setOrg] = useState<OrgSummary | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [discoveredWallets, setDiscoveredWallets] = useState<EIP6963ProviderDetail[]>([]);
  const [selectedWalletInfo, setSelectedWalletInfo] = useState<EIP6963ProviderInfo | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);

  const activeProviderRef = useRef<any>(null);
  const isCancelledRef = useRef<boolean>(false);

  const isConnected = !!address;
  const isCorrectNetwork = chainId === activeNetwork.chainId;

  // 1. Subscribe to EIP-6963 Provider Announcements
  useEffect(() => {
    const unsubscribe = subscribeToEip6963((wallets) => {
      setDiscoveredWallets(wallets);
    });
    return unsubscribe;
  }, []);

  // 2. Check existing session on mount
  const refreshSession = useCallback(async () => {
    try {
      const res = await apiFetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.address) {
          setIsAuthenticated(true);
          setAddress(data.address);
          setOrg(data.org);
          setIsAdmin(data.isAdmin || false);
        } else {
          setIsAuthenticated(false);
          setOrg(null);
          setIsAdmin(false);
        }
      }
    } catch {
      // Session fetch error handled gracefully
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Helper to attach event listeners to the chosen provider
  const attachProviderListeners = useCallback(
    (provider: any) => {
      if (!provider || typeof provider.on !== "function") return;

      const handleAccountsChanged = (accounts: string[]) => {
        if (!accounts || accounts.length === 0) {
          setAddress(null);
          setIsAuthenticated(false);
          setOrg(null);
          setIsAdmin(false);
        } else {
          const nextAddress = accounts[0].toLowerCase();
          setAddress((prev) => {
            if (prev && nextAddress !== prev.toLowerCase()) {
              logout();
            }
            return nextAddress;
          });
        }
      };

      const handleChainChanged = (chainIdHex: string) => {
        const nextChainId = parseInt(chainIdHex, 16);
        setChainId(nextChainId);
      };

      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("chainChanged", handleChainChanged);

      provider
        .request({ method: "eth_chainId" })
        .then((hex: string) => setChainId(parseInt(hex, 16)))
        .catch(() => {});
    },
    []
  );

  // Auto-initialize provider and chainId from window.ethereum if already present
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum
        .request({ method: "eth_chainId" })
        .then((hex: string) => {
          if (hex) setChainId(parseInt(hex, 16));
        })
        .catch(() => {});
      attachProviderListeners(window.ethereum);
    }
  }, [attachProviderListeners]);

  // 3. Connect With Explicit Provider (Zero awaits before eth_requestAccounts!)
  const connectWithProvider = useCallback(
    async (
      walletDetail: EIP6963ProviderDetail,
      preInitiatedPromise?: Promise<string[]>
    ): Promise<string | null> => {
      setError(null);
      setIsConnecting(true);
      isCancelledRef.current = false;

      const provider = walletDetail.provider;
      const info = walletDetail.info;

      try {
        // Execute or await the requestAccounts call initiated directly by click handler
        const accountsPromise =
          preInitiatedPromise || provider.request({ method: "eth_requestAccounts" });
        const accounts = await accountsPromise;

        if (isCancelledRef.current) {
          setIsConnecting(false);
          return null;
        }

        if (!accounts || accounts.length === 0) {
          setError("No accounts found in wallet.");
          setIsConnecting(false);
          return null;
        }

        const connectedAddr = accounts[0].toLowerCase();
        setAddress(connectedAddr);
        setSelectedProvider(provider);
        setSelectedWalletInfo(info);
        activeProviderRef.current = provider;

        if (info?.rdns) {
          setSavedWalletRdns(info.rdns);
        }

        // Fetch chain ID after accounts granted
        try {
          const hexChainId = await provider.request({ method: "eth_chainId" });
          setChainId(parseInt(hexChainId, 16));
        } catch {
          // chainId read fallback
        }

        attachProviderListeners(provider);
        setIsConnecting(false);
        return connectedAddr;
      } catch (err: any) {
        if (isCancelledRef.current) {
          setIsConnecting(false);
          return null;
        }
        const mapped = mapWalletError(err);
        setError(mapped);
        setIsConnecting(false);
        return null;
      }
    },
    [attachProviderListeners]
  );

  // 4. Cancel Pending Connection State
  const cancelConnecting = useCallback(() => {
    isCancelledRef.current = true;
    setIsConnecting(false);
    setError(null);
  }, []);

  // 5. Connect Generic (picks single wallet, saved wallet, or falls back to window.ethereum)
  const connect = useCallback(async (): Promise<string | null> => {
    setError(null);

    // If EIP-6963 wallets are discovered:
    if (discoveredWallets.length > 0) {
      const savedRdns = getSavedWalletRdns();
      if (savedRdns) {
        const savedMatch = discoveredWallets.find(
          (w) => w.info.rdns === savedRdns || w.info.uuid === savedRdns
        );
        if (savedMatch) {
          // Synchronous invocation
          const p = savedMatch.provider.request({ method: "eth_requestAccounts" });
          return connectWithProvider(savedMatch, p);
        }
      }

      if (discoveredWallets.length === 1) {
        const single = discoveredWallets[0];
        const p = single.provider.request({ method: "eth_requestAccounts" });
        return connectWithProvider(single, p);
      }

      // If multiple wallets exist, returning null signals caller to open picker
      return null;
    }

    // Fallback: window.ethereum
    if (typeof window !== "undefined" && window.ethereum) {
      const fallbackDetail: EIP6963ProviderDetail = {
        info: {
          uuid: "window.ethereum",
          name: "Browser Wallet",
          icon: "",
          rdns: "window.ethereum",
        },
        provider: window.ethereum,
      };
      const p = window.ethereum.request({ method: "eth_requestAccounts" });
      return connectWithProvider(fallbackDetail, p);
    }

    // No wallet found
    setError("Install MetaMask");
    return null;
  }, [discoveredWallets, connectWithProvider]);

  // 6. Switch or Add Arc Network (using active provider)
  const switchNetwork = useCallback(async (): Promise<boolean> => {
    const provider = activeProviderRef.current || selectedProvider || (typeof window !== "undefined" ? window.ethereum : null);
    if (!provider) {
      setError("No wallet connected.");
      return false;
    }
    setError(null);

    const targetHex = "0x" + activeNetwork.chainId.toString(16);

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetHex }],
      });
      setChainId(activeNetwork.chainId);
      return true;
    } catch (switchError: any) {
      // 4902 indicated chain is not added yet
      if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        try {
          const { getWalletAddChainParams } = await import("@/lib/networks");
          const chainParams = getWalletAddChainParams(activeNetwork.mode);
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [chainParams],
          });
          setChainId(activeNetwork.chainId);
          return true;
        } catch (addError: any) {
          setError(
            addError.message
              ? `${addError.message} (See official Arc setup docs: https://docs.arc.io/arc/references/connect-to-arc)`
              : "Failed to add Arc network to wallet. See official setup docs: https://docs.arc.io/arc/references/connect-to-arc"
          );
          return false;
        }
      }
      setError(mapWalletError(switchError));
      return false;
    }
  }, [selectedProvider, activeNetwork]);

  // 7. Sign-In With Ethereum (using active provider)
  const signIn = useCallback(async (): Promise<boolean> => {
    setError(null);
    let currentAddress = address;

    if (!currentAddress) {
      currentAddress = await connect();
      if (!currentAddress) return false;
    }

    const provider = activeProviderRef.current || selectedProvider || (typeof window !== "undefined" ? window.ethereum : null);
    if (!provider) {
      setError("Wallet provider unavailable for signing.");
      return false;
    }

    if (!isCorrectNetwork) {
      const switched = await switchNetwork();
      if (!switched) {
        setError(`Please switch your wallet to ${activeNetwork.name} (Chain ID ${activeNetwork.chainId}).`);
        return false;
      }
    }

    try {
      // A. Fetch one-time nonce
      const nonceRes = await apiFetch("/api/auth/nonce");
      if (!nonceRes.ok) throw new Error("Could not acquire authentication nonce");
      const { nonce } = await nonceRes.json();

      // B. Build SIWE message
      const domain = window.location.host;
      const uri = window.location.origin;
      const message = buildSiweMessage({
        domain,
        address: currentAddress,
        uri,
        nonce,
        chainId: activeNetwork.chainId,
        networkName: activeNetwork.name,
      });

      // C. Request user wallet signature (EIP-191 personal_sign)
      const signature = await provider.request({
        method: "personal_sign",
        params: [message, currentAddress],
      });

      // D. Verify signature on backend
      const verifyRes = await apiFetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          signature,
          address: currentAddress,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Signature verification failed");
      }

      setIsAuthenticated(true);
      setOrg(verifyData.org);
      setIsAdmin(verifyData.isAdmin || false);
      return true;
    } catch (err: any) {
      setError(mapWalletError(err));
      return false;
    }
  }, [address, isCorrectNetwork, activeNetwork, connect, switchNetwork, selectedProvider]);

  // 8. Logout
  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    }
    setIsAuthenticated(false);
    setOrg(null);
    setIsAdmin(false);
    clearSavedWalletRdns();
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
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
        selectedWalletInfo,
        selectedProvider,
        connect,
        connectWithProvider,
        cancelConnecting,
        signIn,
        logout,
        switchNetwork,
        refreshSession,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
