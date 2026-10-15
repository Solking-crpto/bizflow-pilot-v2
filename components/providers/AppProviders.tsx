"use client";

import React from "react";
import { NetworkProvider } from "@/components/network/NetworkContext";
import { WalletProvider } from "@/components/auth/WalletContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <NetworkProvider>
      <WalletProvider>{children}</WalletProvider>
    </NetworkProvider>
  );
}
