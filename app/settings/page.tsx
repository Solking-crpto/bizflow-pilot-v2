export const dynamic = "force-dynamic";
export const revalidate = 0;

import React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork } from "@/lib/networks";
import { getTreasuryPublicAddress } from "@/lib/treasury";
import { getServerSession, getSessionOrg } from "@/lib/auth/session";
import { SettingsClient, SerializedSettings, SerializedVendor } from "@/components/settings/SettingsClient";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sliders, Wallet } from "lucide-react";

export const metadata: Metadata = {
  title: "Rules & Settings — Governance & Security Controls | BizFlow Pilot V2",
  description: "Configure policy limits, corporate approval thresholds, approved vendors, and emergency halts.",
};

export default async function SettingsPage() {
  const cookieStore = cookies();
  const networkMode = getServerActiveNetwork(cookieStore.get("bizflow_network")?.value);
  const session = await getServerSession();

  if (!session || !session.address) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Rules & Settings — Governance Controls</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Configure policy limits, corporate approval thresholds, approved vendors, and emergency halts.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Wallet}
          title="Connect your wallet to begin"
          description="Connect your Web3 wallet to manage corporate treasury limits, configure approval thresholds, and manage emergency kill switch controls."
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
  let org: any = null;
  let dbError: string | null = null;

  try {
    org = await getSessionOrg(session, networkMode);
    if (org) {
      const [settings, vendors] = await withDbTimeout(() =>
        Promise.all([
          db.setting.findMany({ where: { orgId: org.id } }),
          db.vendor.findMany({ where: { orgId: org.id } }),
        ])
      );
      org = { ...org, settings, vendors };
    }
  } catch (err: any) {
    dbError = err.message || "Failed to load settings from database.";
  }

  if (dbError) {
    return (
      <DatabaseErrorState
        title="Settings Database Error"
        message={dbError || "No organization configuration found on active database."}
      />
    );
  }

  const rawSettings = org?.settings?.[0] || {
    killSwitchActive: false,
    priceToleranceBps: 100,
    requireApprovalAbove: 5000000000n,
    minReserveUsdc: 2000000000n,
    dailyLimitUsdc: 20000000000n,
    agentMode: "assisted",
    autoApproveLimitUsdc: 500000n,
    maxDailyAutonomousUsdc: 1000000n,
  };
  const rawVendors = org?.vendors || [];
  const treasuryPublicAddress = getTreasuryPublicAddress();

  const serializedSettings: SerializedSettings = {
    killSwitchActive: !!rawSettings.killSwitchActive,
    priceToleranceBps: Number(rawSettings.priceToleranceBps || 100),
    requireApprovalAbove: (rawSettings.requireApprovalAbove || 5000000000n).toString(),
    minReserveUsdc: (rawSettings.minReserveUsdc || 2000000000n).toString(),
    dailyLimitUsdc: (rawSettings.dailyLimitUsdc || 20000000000n).toString(),
    agentMode: rawSettings.agentMode || "assisted",
    autoApproveLimitUsdc: (rawSettings.autoApproveLimitUsdc || 500000n).toString(),
    maxDailyAutonomousUsdc: (rawSettings.maxDailyAutonomousUsdc || 1000000n).toString(),
  };

  const serializedVendors: SerializedVendor[] = rawVendors.map((v: any) => ({
    id: v.id,
    name: v.name,
    walletAddress: v.walletAddress,
    status: v.status,
    perVendorLimitUsdc: (v.perVendorLimitUsdc || 10000000000n).toString(),
  }));

  return (
    <SettingsClient
      initialSettings={serializedSettings}
      vendors={serializedVendors}
      treasuryPublicAddress={treasuryPublicAddress}
    />
  );
}
