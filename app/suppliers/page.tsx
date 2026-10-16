export const dynamic = "force-dynamic";
export const revalidate = 0;

import React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork } from "@/lib/networks";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { getServerSession, getSessionOrg } from "@/lib/auth/session";
import { SupplierDeskClient, SerializedSupplier } from "@/components/suppliers/SupplierDeskClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users, Wallet } from "lucide-react";

export const metadata: Metadata = {
  title: "Suppliers & Counterparties | BizFlow Pilot V2",
  description: "Manage verified suppliers, EVM payout wallets, and per-vendor limits on Arc.",
};

export default async function SuppliersPage() {
  const cookieStore = cookies();
  const networkMode = getServerActiveNetwork(cookieStore.get("bizflow_network")?.value);
  const session = await getServerSession();

  if (!session || !session.address) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Suppliers & Counterparties</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Manage verified suppliers, EVM payout wallets, and per-vendor limits on Arc.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Wallet}
          title="Connect your wallet to begin"
          description="Connect your Web3 wallet to manage corporate suppliers, screen counterparty payout addresses, and configure governance limits."
          action={{
            label: "Explore Public Metrics",
            href: "/metrics",
          }}
          secondaryAction={{
            label: "Judge Guide",
            href: "/judges",
          }}
        />
      </div>
    );
  }

  const db = getDb(networkMode);
  let suppliers: SerializedSupplier[] = [];

  if (session) {
    const org = await getSessionOrg(session, networkMode);
    if (org) {
      const records = await withDbTimeout(() =>
        db.vendor.findMany({
          where: { orgId: org.id },
          orderBy: { createdAt: "desc" },
        })
      );

      suppliers = records.map((v) => ({
        id: v.id,
        name: v.name,
        walletAddress: v.walletAddress,
        status: v.status,
        perVendorLimitUsdc: formatUsdc(usdcAtomic(v.perVendorLimitUsdc)),
        walletCooldownUntil: v.walletCooldownUntil ? v.walletCooldownUntil.toISOString() : null,
        createdAt: v.createdAt.toISOString(),
      }));
    }
  }

  return <SupplierDeskClient suppliers={suppliers} />;
}
