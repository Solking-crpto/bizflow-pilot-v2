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

export const metadata: Metadata = {
  title: "Suppliers & Counterparties | BizFlow Pilot V2",
  description: "Manage verified suppliers, EVM payout wallets, and per-vendor limits on Arc.",
};

export default async function SuppliersPage() {
  const cookieStore = cookies();
  const networkMode = getServerActiveNetwork(cookieStore.get("bizflow_network")?.value);
  const db = getDb(networkMode);

  const session = await getServerSession();
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
