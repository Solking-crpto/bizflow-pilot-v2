"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Edit2,
  ExternalLink,
  Wallet,
} from "lucide-react";
import { SupplierModal } from "./SupplierModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { HashView } from "@/components/ui/StatusChip";
import { getActiveNetwork } from "@/lib/networks";

export interface SerializedSupplier {
  id: string;
  name: string;
  walletAddress: string;
  status: string;
  perVendorLimitUsdc: string;
  walletCooldownUntil?: string | null;
  createdAt: string;
}

export function SupplierDeskClient({ suppliers }: { suppliers: SerializedSupplier[] }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SerializedSupplier | null>(null);
  const network = getActiveNetwork();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Suppliers & Counterparties</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Manage verified supplier recipient wallets, per-vendor spending limits, and OFAC compliance screening.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingSupplier(null);
            setIsModalOpen(true);
          }}
          className="px-3.5 py-1.5 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-xs flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 text-brand-teal" />
          <span>Add Supplier</span>
        </button>
      </div>

      <SupplierModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSupplier(null);
        }}
        onSuccess={() => router.refresh()}
        supplier={editingSupplier}
      />

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Suppliers Added Yet"
          description="Register your first counterparty supplier to issue purchase orders and process verified USDC settlements on Arc."
          action={{
            label: "Add Your First Supplier",
            onClick: () => {
              setEditingSupplier(null);
              setIsModalOpen(true);
            },
          }}
          secondaryAction={{
            label: "Business Onboarding",
            href: "/onboarding",
          }}
        />
      ) : (
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-canvas text-ink-muted font-semibold">
                  <th className="py-2.5 px-4">Supplier Name</th>
                  <th className="py-2.5 px-4">Payout EVM Wallet</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Per-Vendor Limit</th>
                  <th className="py-2.5 px-4">Security Screening</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {suppliers.map((s) => {
                  const isCooldown = s.status === "pending_cooldown";
                  return (
                    <tr key={s.id} className="hover:bg-canvas/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-ink">{s.name}</td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <HashView hash={s.walletAddress} truncate={true} />
                          <a
                            href={`${network.explorerUrl}/address/${s.walletAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-ink-muted hover:text-navy"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {isCooldown ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Clock className="w-3 h-3" /> 24h Cooldown
                          </span>
                        ) : s.status === "active" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <ShieldCheck className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger bg-danger-light px-2 py-0.5 rounded border border-danger-border">
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-ink">{s.perVendorLimitUsdc}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" /> OFAC Screened
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setEditingSupplier(s);
                            setIsModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-canvas border border-border hover:bg-white text-ink text-xs font-medium transition"
                        >
                          <Edit2 className="w-3 h-3 text-ink-muted" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
