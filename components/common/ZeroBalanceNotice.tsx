"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, Droplets, ExternalLink, ArrowRight } from "lucide-react";
import { useWallet } from "@/components/auth/WalletContext";
import { useNetwork } from "@/components/network/NetworkContext";
import { NETWORKS, ARC_DOCS_URLS } from "@/lib/networks";
import { createPublicClient, custom, erc20Abi } from "viem";

export function ZeroBalanceNotice() {
  const { isConnected, address, activeNetwork } = useWallet();
  const { isMainnet, isTestnet, switchNetwork } = useNetwork();
  const [balance, setBalance] = useState<bigint | null>(null);

  useEffect(() => {
    if (!isConnected || !address || typeof window === "undefined" || !window.ethereum) {
      setBalance(null);
      return;
    }

    let isMounted = true;

    async function checkBalance() {
      try {
        const publicClient = createPublicClient({
          chain: activeNetwork.chain,
          transport: custom(window.ethereum),
        });

        // 1. Check native gas balance (on Arc, native currency is USDC)
        const nativeBal = await publicClient.getBalance({
          address: address as `0x${string}`,
        });

        // 2. Check ERC-20 contract balance if contract exists
        let erc20Bal = 0n;
        if (activeNetwork.usdcAddress) {
          try {
            erc20Bal = (await publicClient.readContract({
              address: activeNetwork.usdcAddress,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address as `0x${string}`],
            })) as bigint;
          } catch {
            // ERC20 read failover
          }
        }

        const totalBal = nativeBal > erc20Bal ? nativeBal : erc20Bal;
        if (isMounted) {
          setBalance(totalBal);
        }
      } catch {
        // RPC blip
      }
    }

    checkBalance();
    const interval = setInterval(checkBalance, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isConnected, address, activeNetwork]);

  if (!isConnected || balance === null || balance > 0n) {
    return null;
  }

  const faucetUrl = NETWORKS.testnet.faucetUrl || "https://faucet.circle.com";

  if (isTestnet) {
    return (
      <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Zero Testnet Balance:</strong> Your connected wallet has 0 test USDC. Request free tokens from the faucet to practise settlements and cover gas.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={faucetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors shadow-2xs"
          >
            <span>Get free test USDC</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  if (isMainnet) {
    return (
      <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
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
            <span>Try testnet first</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
