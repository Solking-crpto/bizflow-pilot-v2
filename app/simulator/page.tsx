import React from "react";
import type { Metadata } from "next";
import { prisma, withDbTimeout } from "@/lib/db";
import { PolicySimulatorClient } from "@/components/simulator/PolicySimulatorClient";
import { DEMO_INVOICES } from "@/lib/demoData";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Policy Simulator — Governance & Guardrail Playground | BizFlow Pilot V2",
  description: "Interactive simulator for policy thresholds, anomaly injection testing, and kill-switch verification.",
};

export default async function PolicySimulatorPage() {
  const isMainnet = (process.env.NEXT_PUBLIC_NETWORK_MODE || process.env.NETWORK_MODE) === "mainnet";
  let invoices: any[] = [];
  let dbError: string | null = null;

  try {
    invoices = await withDbTimeout(
      () =>
        prisma.invoice.findMany({
          where: isMainnet ? { network: "mainnet" } : undefined,
          include: { vendor: true },
          orderBy: { createdAt: "desc" },
        })
    );
  } catch (err: any) {
    if (isMainnet) {
      dbError = err.message || "Failed to load invoices from database.";
    } else {
      invoices = [];
    }
  }

  if (isMainnet && dbError) {
    return (
      <DatabaseErrorState
        title="Policy Simulator Database Error"
        message="Could not load live mainnet invoices for simulation. Please verify connectivity and retry."
      />
    );
  }

  if (!isMainnet && invoices.length === 0) {
    invoices = DEMO_INVOICES;
  }

  const defaultNetwork = (process.env.NEXT_PUBLIC_NETWORK_MODE || "testnet") as "testnet" | "mainnet";

  const options = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    vendorName: inv.vendor?.name || "Northgate Cement Supply (demo vendor)",
    amountAtomic: inv.totalUsdc.toString(),
    wallet: inv.vendor?.walletAddress || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    matchStatus: inv.matchStatus,
    duplicateScore: inv.duplicateScore,
    isInjectionSuspect: inv.isInjectionSuspect,
  }));

  return <PolicySimulatorClient invoices={options} defaultNetwork={defaultNetwork} />;
}
