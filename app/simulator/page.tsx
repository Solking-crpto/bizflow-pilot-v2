export const dynamic = "force-dynamic";
export const revalidate = 0;

import React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork } from "@/lib/networks";
import { PolicySimulatorClient } from "@/components/simulator/PolicySimulatorClient";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";

export const metadata: Metadata = {
  title: "Policy Simulator — Governance & Guardrail Playground | BizFlow Pilot V2",
  description: "Interactive simulator for policy thresholds, anomaly injection testing, and kill-switch verification.",
};

export default async function PolicySimulatorPage() {
  const cookieStore = cookies();
  const networkMode = getServerActiveNetwork(cookieStore.get("bizflow_network")?.value);
  const db = getDb(networkMode);

  let invoices: any[] = [];
  let dbError: string | null = null;

  try {
    invoices = await withDbTimeout(
      () =>
        db.invoice.findMany({
          include: { vendor: true },
          orderBy: { createdAt: "desc" },
        })
    );
  } catch (err: any) {
    dbError = err.message || "Failed to load invoices from database.";
  }

  if (dbError) {
    return (
      <DatabaseErrorState
        title="Policy Simulator Database Error"
        message="Could not load invoices for simulation. Please verify connectivity and retry."
      />
    );
  }

  const defaultNetwork = networkMode;

  const options =
    invoices.length > 0
      ? invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          vendorName: inv.vendor?.name || "Supplier",
          amountAtomic: inv.totalUsdc.toString(),
          wallet: inv.vendor?.walletAddress || "",
          matchStatus: inv.matchStatus,
          duplicateScore: inv.duplicateScore,
          isInjectionSuspect: inv.isInjectionSuspect,
        }))
      : [
          {
            id: "preset-clean",
            invoiceNumber: "PRESET-CLEAN-01",
            vendorName: "Active Supplier (Simulation Preset)",
            amountAtomic: "500000", // 0.50 USDC
            wallet: "0x1111111111111111111111111111111111111111",
            matchStatus: "exact_match",
            duplicateScore: 0,
            isInjectionSuspect: false,
          },
          {
            id: "preset-threat",
            invoiceNumber: "PRESET-INJECTION-02",
            vendorName: "Adversarial Threat (Simulation Preset)",
            amountAtomic: "1000000", // 1.00 USDC
            wallet: "0x2222222222222222222222222222222222222222",
            matchStatus: "exact_match",
            duplicateScore: 0,
            isInjectionSuspect: true,
          },
          {
            id: "preset-duplicate",
            invoiceNumber: "PRESET-DUPLICATE-03",
            vendorName: "Duplicate Billing (Simulation Preset)",
            amountAtomic: "800000", // 0.80 USDC
            wallet: "0x3333333333333333333333333333333333333333",
            matchStatus: "exact_match",
            duplicateScore: 95,
            isInjectionSuspect: false,
          },
        ];

  return <PolicySimulatorClient invoices={options} defaultNetwork={defaultNetwork} />;
}
