"use client";

import React from "react";
import { WalletProvider } from "@/components/auth/WalletContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}
