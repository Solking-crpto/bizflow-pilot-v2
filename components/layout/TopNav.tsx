"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Search, Award, ArrowLeftRight, Sparkles, Menu, X, ShieldCheck, ExternalLink } from "lucide-react";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { useNetwork } from "@/components/network/NetworkContext";
import { WalletConnectButton } from "@/components/auth/WalletConnectButton";
import { useWallet } from "@/components/auth/WalletContext";
import { NAV_ITEMS } from "./Sidebar";
import { Logo } from "../ui/Logo";
import { OrgSwitcher } from "./OrgSwitcher";
import packageJson from "@/package.json";

interface TopNavProps {
  networkMode?: "testnet" | "mainnet";
  orgName?: string;
  userEmail?: string;
  userRole?: string;
  walletAddress?: string;
  onConnectWallet?: () => void;
}

export function TopNav({
  orgName,
}: TopNavProps) {
  const pathname = usePathname();
  const { org, isAuthenticated } = useWallet();
  const { isMainnet, switchNetwork } = useNetwork();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeOrgName = isAuthenticated && (org?.name || orgName) ? (org?.name || orgName) : null;

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Close drawer on path change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header className="border-b border-border bg-surface sticky top-0 z-30">
      {/* Primary Top Bar Row */}
      <div className="h-14 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Side: Mobile Hamburger + Brand / Org Badge & Desktop Network Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-canvas transition-colors shrink-0"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          {activeOrgName ? (
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md border border-border bg-canvas transition-colors shrink-0 max-w-[140px] sm:max-w-[200px]">
              <Building2 className="w-3.5 h-3.5 text-navy shrink-0" />
              <span className="text-xs font-semibold text-ink tracking-tight truncate">{activeOrgName}</span>
              <span className="hidden sm:inline text-[9px] uppercase font-mono px-1 py-0.2 bg-brand-light text-brand-teal rounded font-bold border border-brand-teal/20 shrink-0">
                BETA
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/80 bg-canvas/60 text-xs font-semibold text-ink shrink-0">
              <span className="w-2 h-2 rounded-full bg-brand-teal" />
              <span className="tracking-tight text-xs">BizFlow V2</span>
            </div>
          )}

          {/* Network Switcher: Visible in primary bar on screens >= 640px */}
          <div className="hidden sm:flex items-center gap-2">
            <NetworkSwitcher />

            {/* Mainnet Extra: "Try testnet first" direct switch */}
            {isMainnet && (
              <button
                type="button"
                onClick={() => switchNetwork("testnet")}
                className="hidden xl:inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                title="Switch to Arc Testnet with free test USDC"
              >
                <ArrowLeftRight className="w-3 h-3 text-amber-600" />
                <span>Try testnet first</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Quick Links, Search, Wallet Connect */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Judge Guide Link */}
          <Link
            href="/judges"
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-2xs shrink-0"
            title="Judge Evaluation Guide"
          >
            <Award className="w-3.5 h-3.5 text-brand-teal shrink-0" />
            <span className="hidden md:inline">Judge Guide</span>
          </Link>

          {/* Desktop Search */}
          <div className="relative w-48 lg:w-64 hidden xl:block">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="Search PO, invoice #, hash..."
              className="w-full pl-8 pr-3 py-1 text-xs rounded-md border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy transition-colors font-mono"
              readOnly
            />
          </div>

          {/* Wallet Connect / Account Session */}
          <div className="flex items-center pl-1 sm:pl-2 sm:border-l sm:border-border">
            <WalletConnectButton />
          </div>
        </div>
      </div>

      {/* Mobile Second Row: Network Switcher (< 640px / 390px) to prevent any overflow */}
      <div className="flex sm:hidden py-1.5 px-3 border-t border-border/60 bg-canvas/40 items-center justify-between text-xs">
        <span className="text-[10px] font-mono text-ink-muted uppercase font-semibold">Network</span>
        <NetworkSwitcher />
      </div>

      {/* Mobile Sidebar Navigation Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Body */}
          <div className="relative w-72 max-w-[85vw] bg-surface h-full shadow-2xl flex flex-col z-[101] animate-slide-in">
            {/* Drawer Top / Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-canvas transition-colors"
                aria-label="Close Navigation Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Org Switcher in Drawer */}
            <div className="p-3 border-b border-border">
              <OrgSwitcher />
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
              <div className="px-3 pb-2 text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
                Financial Operations
              </div>
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-navy text-white shadow-xs font-semibold"
                        : "text-ink hover:bg-canvas hover:text-navy"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-brand-teal" : "text-ink-muted"}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Public Passport in Drawer */}
            <div className="p-3 border-t border-border bg-canvas/50">
              <Link
                href="/verify/demo"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between gap-1 text-xs text-navy hover:text-brand-teal font-medium py-1.5 px-2.5 rounded border border-border bg-white shadow-xs"
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
                  Public Passport
                </span>
                <ExternalLink className="w-3 h-3 text-ink-muted" />
              </Link>
            </div>

            {/* Drawer Footer Version */}
            <div className="p-3.5 border-t border-border flex items-center justify-between text-xs text-ink-muted bg-surface">
              <span className="font-mono text-[11px] truncate">BizFlow Pilot V2 · Tameion</span>
              <span className="text-[10px] font-mono bg-canvas px-1.5 py-0.5 rounded border border-border">
                v{packageJson.version}
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
