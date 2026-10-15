"use client";

import React, { useState } from "react";
import { X, Users, ShieldCheck, AlertCircle, Loader2, Clock } from "lucide-react";
import { isAddress } from "viem";
import { isBlocklistedWallet } from "@/lib/security/walletBlocklist";

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplier?: {
    id: string;
    name: string;
    walletAddress: string;
    perVendorLimitUsdc: string;
    status: string;
  } | null;
}

export function SupplierModal({ isOpen, onClose, onSuccess, supplier }: SupplierModalProps) {
  const isEditing = !!supplier;
  const [name, setName] = useState(supplier?.name || "");
  const [walletAddress, setWalletAddress] = useState(supplier?.walletAddress || "");
  const [perVendorLimitUsdc, setPerVendorLimitUsdc] = useState(
    supplier?.perVendorLimitUsdc ? supplier.perVendorLimitUsdc.replace(/[^0-9.]/g, "") : "25.00"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isAddress(walletAddress)) {
      setError("Invalid EVM wallet address format (must start with 0x and have 40 hex characters).");
      return;
    }

    if (isBlocklistedWallet(walletAddress)) {
      setError("Security refusal: Wallet address failed OFAC compliance screening.");
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEditing ? `/api/suppliers/${supplier.id}` : "/api/suppliers";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          walletAddress: walletAddress.trim(),
          perVendorLimitUsdc: perVendorLimitUsdc.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save supplier");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save supplier");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl bg-surface border border-border shadow-elevated p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-navy text-white">
              <Users className="w-4 h-4 text-brand-teal" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                {isEditing ? "Edit Supplier" : "Add Supplier Counterparty"}
              </h3>
              <p className="text-[11px] text-ink-muted">Register verified recipient wallet for Arc USDC settlement</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-ink">Supplier Business Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Dangote Distribution"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-ink">Payout EVM Wallet Address *</label>
            <input
              type="text"
              required
              placeholder="0x..."
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy font-mono text-[11px]"
            />
            <span className="text-[10px] text-ink-muted block">
              Checked in real time against OFAC compliance blocklists.
            </span>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-ink">Per-Vendor Spending Cap (USDC)</label>
            <input
              type="number"
              step="0.01"
              max="25.00"
              value={perVendorLimitUsdc}
              onChange={(e) => setPerVendorLimitUsdc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-canvas focus:bg-white focus:outline-none focus:border-navy font-mono"
            />
            <span className="text-[10px] text-ink-muted block">
              Beta hard cap: 25.00 USDC maximum per supplier settlement.
            </span>
          </div>

          {isEditing && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 flex items-start gap-2">
              <Clock className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span className="text-[11px]">
                Note: Updating a payout wallet address triggers a mandatory 24-hour security cooldown before payments can be settled to the new address.
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-danger-light border border-danger-border text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-border text-ink-muted hover:text-ink transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-navy hover:bg-navy-light text-white font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
              )}
              <span>{isEditing ? "Update Supplier" : "Register Supplier"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
