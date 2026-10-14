import React from "react";
import type { Metadata } from "next";
import { prisma, withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { runAgentAnalysis } from "@/lib/agent/recommender";
import { AgentDashboardClient } from "@/components/agent/AgentDashboardClient";
import { DEMO_INVOICES } from "@/lib/demoData";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";
import { getTreasuryBalances } from "@/lib/balances";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Finance Agent — Autonomous Treasury Advisory | BizFlow Pilot V2",
  description: "AI Agent proposal engine decoupled from deterministic policy execution.",
};

export default async function AgentPage() {
  const isMainnet = (process.env.NEXT_PUBLIC_NETWORK_MODE || process.env.NETWORK_MODE) === "mainnet";
  const balances = await getTreasuryBalances();

  let invoices: any[] = [];
  let dbError: string | null = null;

  try {
    invoices = await withDbTimeout(
      () =>
        prisma.invoice.findMany({
          where: isMainnet ? { network: "mainnet" } : undefined,
          include: { vendor: true, purchaseOrder: true },
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
        title="AI Agent Advisory Database Error"
        message="Could not load live mainnet invoices from the database. Please verify connectivity and retry."
      />
    );
  }

  if (!isMainnet && invoices.length === 0) {
    invoices = DEMO_INVOICES;
  }

  const treasuryBalance = isMainnet ? balances.usdcAtomicValue : 100000000000n; // Live on mainnet
  const minReserve = isMainnet ? 250000n : 2000000000n; // 0.25 USDC on mainnet demo scale
  const freeCash = treasuryBalance > minReserve ? treasuryBalance - minReserve : 0n;

  const analyzedInvoices = await Promise.all(
    invoices.map(async (inv) => {
      const { recommendation } = await runAgentAnalysis({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        vendorName: inv.vendor?.name || "Northgate Cement Supply (demo vendor)",
        amountFormatted: formatUsdc(usdcAtomic(inv.totalUsdc)),
        amountAtomic: inv.totalUsdc.toString(),
        matchStatus: inv.matchStatus,
        duplicateScore: inv.duplicateScore,
        isInjectionSuspect: inv.isInjectionSuspect,
        untrustedRawText: inv.rawContent,
        cashPosition: {
          availableTreasury: formatUsdc(usdcAtomic(treasuryBalance)),
          minimumReserve: formatUsdc(usdcAtomic(minReserve)),
          netFreeCash: formatUsdc(usdcAtomic(freeCash)),
        },
        obligationsQueue: {
          totalPendingAmount: formatUsdc(usdcAtomic(inv.totalUsdc)),
          itemCount: invoices.length,
        },
      });

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        vendorName: inv.vendor?.name || "Northgate Cement Supply (demo vendor)",
        amountFormatted: formatUsdc(usdcAtomic(inv.totalUsdc)),
        matchStatus: inv.matchStatus,
        duplicateScore: inv.duplicateScore,
        isInjectionSuspect: inv.isInjectionSuspect,
        dueDate: inv.dueDate instanceof Date ? inv.dueDate.toISOString() : null,
        recommendation,
      };
    })
  );

  return (
    <AgentDashboardClient
      invoices={analyzedInvoices}
      treasuryFormatted={formatUsdc(usdcAtomic(treasuryBalance))}
      reserveFormatted={formatUsdc(usdcAtomic(minReserve))}
      freeCashFormatted={formatUsdc(usdcAtomic(freeCash))}
    />
  );
}
