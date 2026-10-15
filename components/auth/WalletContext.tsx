"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getActiveNetwork, NetworkConfig } from "@/lib/networks";
import { buildSiweMessage } from "@/lib/auth/siwe";

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
  error: string | null;
  connect: () => Promise<string | null>;
  signIn: () => Promise<boolean>;
  logout: () => Promise<void>;
  switchNetwork: () => Promise<boolean>;
  refreshSession: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const activeNetwork = getActiveNetwork();
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [org, setOrg] = useState<OrgSummary | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isConnected = !!address;
  const isCorrectNetwork = chainId === activeNetwork.chainId;

  // 1. Check existing session on mount
  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
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

  // 2. Listen to wallet events (accountsChanged, chainChanged)
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress(null);
        setIsAuthenticated(false);
        setOrg(null);
        setIsAdmin(false);
      } else {
        const nextAddress = accounts[0].toLowerCase();
        if (address && nextAddress !== address.toLowerCase()) {
          // Changed account - logout previous session
          logout();
          setAddress(nextAddress);
        }
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const nextChainId = parseInt(chainIdHex, 16);
      setChainId(nextChainId);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    // Initial check of chain
    window.ethereum
      .request({ method: "eth_chainId" })
      .then((hex: string) => setChainId(parseInt(hex, 16)))
      .catch(() => {});

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [address]);

  // 3. Connect Wallet
  const connect = async (): Promise<string | null> => {
    setError(null);
    if (typeof window === "undefined" || !window.ethereum) {
      setError("No Web3 wallet detected. Please install Rabby, MetaMask, or another compatible browser wallet.");
      return null;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        setError("No accounts found in wallet.");
        return null;
      }

      const connectedAddr = accounts[0].toLowerCase();
      setAddress(connectedAddr);

      const hexChainId = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(parseInt(hexChainId, 16));

      return connectedAddr;
    } catch (err: any) {
      if (err.code === 4001) {
        setError("Connection request rejected by user.");
      } else {
        setError(err.message || "Failed to connect wallet.");
      }
      return null;
    }
  };

  // 4. Switch or Add Arc Network
  const switchNetwork = async (): Promise<boolean> => {
    if (typeof window === "undefined" || !window.ethereum) return false;
    setError(null);

    const targetHex = "0x" + activeNetwork.chainId.toString(16);

    try {
      await window.ethereum.request({
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
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [chainParams],
          });
          setChainId(activeNetwork.chainId);
          return true;
        } catch (addError: any) {
          setError(addError.message || "Failed to add Arc network to wallet.");
          return false;
        }
      }
      setError(switchError.message || "Failed to switch network.");
      return false;
    }
  };

  // 5. Sign-In With Ethereum
  const signIn = async (): Promise<boolean> => {
    setError(null);
    let currentAddress = address;

    if (!currentAddress) {
      currentAddress = await connect();
      if (!currentAddress) return false;
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
      const nonceRes = await fetch("/api/auth/nonce");
      if (!nonceRes.ok) throw new Error("Could not acquire authentication nonce");
      const { nonce } = await nonceRes.json();

      // B. Build SIWE message with network name and chain ID
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
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, currentAddress],
      });

      // D. Verify signature on backend
      const verifyRes = await fetch("/api/auth/verify", {
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
      if (err.code === 4001) {
        setError("Signature request rejected by user.");
      } else {
        setError(err.message || "Sign-in failed.");
      }
      return false;
    }
  };

  // 6. Logout
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    }
    setIsAuthenticated(false);
    setOrg(null);
    setIsAdmin(false);
  };

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
        error,
        connect,
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
