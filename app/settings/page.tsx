import React from "react";
import type { Metadata } from "next";
import { prisma, withDbTimeout } from "@/lib/db";
import { getTreasuryPublicAddress } from "@/lib/treasury";
import { DEMO_SETTINGS, DEMO_VENDORS } from "@/lib/demoData";
import { SettingsClient, SerializedSettings, SerializedVendor } from "@/components/settings/SettingsClient";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rules & Settings — Governance & Security Controls | BizFlow Pilot V2",
  description: "Configure policy limits, corporate approval thresholds, approved vendors, and emergency halts.",
};

export default async function SettingsPage() {
  const isMainnet = (process.env.NEXT_PUBLIC_NETWORK_MODE || process.env.NETWORK_MODE) === "mainnet";
  let org: any = null;
  let dbError: string | null = null;

  try {
    org = await withDbTimeout(
      () =>
        prisma.organization.findFirst({
          include: {
            settings: true,
            vendors: true,
          },
        })
    );
  } catch (err: any) {
    if (isMainnet) {
      dbError = err.message || "Failed to load settings from database.";
    } else {
      org = null;
    }
  }

  if (isMainnet && (!org || dbError)) {
    return (
      <DatabaseErrorState
        title="Settings Database Error"
        message={dbError || "No organization configuration found on Arc Mainnet. Please ensure database is seeded."}
      />
    );
  }

  const rawSettings = org?.settings?.[0] || DEMO_SETTINGS;
  const rawVendors = org?.vendors?.length > 0 ? org.vendors : DEMO_VENDORS;
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
