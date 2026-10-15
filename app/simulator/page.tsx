import React from "react";
import type { Metadata } from "next";
import { prisma, withDbTimeout } from "@/lib/db";
import { PolicySimulatorClient } from "@/components/simulator/PolicySimulatorClient";
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

  const defaultNetwork = (process.env.NEXT_PUBLIC_NETWORK_MODE || "testnet") as "testnet" | "mainnet";

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
