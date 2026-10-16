"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  ReceiptText,
  Bot,
  CreditCard,
  FileCheck2,
  SlidersHorizontal,
  Settings,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Award,
  CheckCircle2,
  Building2,
  Users,
  BookOpen,
} from "lucide-react";
import { Logo } from "../ui/Logo";
import { OrgSwitcher } from "./OrgSwitcher";
import packageJson from "@/package.json";

export const NAV_ITEMS = [
  { name: "Command Center", href: "/", icon: LayoutDashboard },
  { name: "Suppliers", href: "/suppliers", icon: Users },
  { name: "Inventory & POs", href: "/inventory", icon: Boxes },
  { name: "Invoice Desk", href: "/invoices", icon: ReceiptText },
  { name: "AI Finance Agent", href: "/agent", icon: Bot },
  { name: "Agent Decisions", href: "/agent/decisions", icon: CheckCircle2 },
  { name: "Payment Desk", href: "/payments", icon: CreditCard },
  { name: "Trust & Audit Ledger", href: "/audit", icon: FileCheck2 },
  { name: "Policy Simulator", href: "/simulator", icon: SlidersHorizontal },
  { name: "Pilot Businesses", href: "/pilots", icon: Building2 },
  { name: "Rules & Settings", href: "/settings", icon: Settings },
  { name: "User Guide", href: "/guide", icon: BookOpen },
  { name: "Judge Guide", href: "/judges", icon: Award },
  { name: "About & Trust Model", href: "/about", icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 bg-surface border-r border-border flex-col h-screen sticky top-0 select-none shrink-0">
      {/* Brand Header & Org Switcher */}
      <div className="p-4 border-b border-border space-y-3">
        <Logo />
        <OrgSwitcher />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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

      {/* Public Payment Passport link */}
      <div className="p-3 border-t border-border bg-canvas/50">
        <div className="p-2.5 rounded-lg border border-border bg-white shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-ink mb-1">
            <span className="flex items-center gap-1.5 text-navy font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
              Public Passport
            </span>
            <span className="text-[10px] bg-brand-light text-brand-teal px-1.5 py-0.5 rounded font-mono">
              Live
            </span>
          </div>
          <p className="text-[11px] text-ink-muted leading-snug mb-2">
            No-login cryptographic proof viewer for auditors & suppliers.
          </p>
          <Link
            href="/verify/demo"
            className="flex items-center justify-center gap-1 text-xs text-navy hover:text-brand-teal font-medium py-1 px-2 rounded border border-border bg-canvas hover:bg-white transition-colors"
          >
            <span>Open Passport</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Footer / Trust Badge */}
      <div className="p-4 border-t border-border flex items-center justify-between text-xs text-ink-muted">
        <span className="font-mono text-[11px] truncate" title="BizFlow Pilot V2 · Tameion edition">
          BizFlow Pilot V2 · Tameion edition
        </span>
        <span className="text-[10px] font-mono bg-canvas px-1.5 py-0.5 rounded border border-border ml-1 shrink-0">
          v{packageJson.version}
        </span>
      </div>
    </aside>
  );
}
