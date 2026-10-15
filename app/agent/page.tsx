import React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork } from "@/lib/networks";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { runAgentAnalysis } from "@/lib/agent/recommender";
import { AgentDashboardClient } from "@/components/agent/AgentDashboardClient";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";
import { getServerSession, getSessionOrg, isAdminWallet } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "AI Finance Agent — Advisory Treasury Copilot | BizFlow Pilot V2",
  description: "Non-custodial AI Advisory proposing settlements with strict policy and budget bounds.",
};

export default async function AgentPage() {
  const cookieStore = cookies();
  const networkMode = getServerActiveNetwork(cookieStore.get("bizflow_network")?.value);
  const db = getDb(networkMode);
  const session = await getServerSession();

  let invoices: any[] = [];
  let dbError: string | null = null;
  let runsToday = 0;
  let orgName: string | null = null;

  if (session) {
    try {
      const org = await getSessionOrg(session, networkMode);
      if (org) {
        orgName = org.name;
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);

        const [orgInvoices, decisionCount] = await withDbTimeout(() =>
          Promise.all([
            db.invoice.findMany({
              where: {
                orgId: org.id,
                status: { in: ["verified", "review_required", "blocked"] },
              },
              include: { vendor: true, purchaseOrder: true },
              orderBy: { createdAt: "desc" },
            }),
            db.agentDecision.count({
              where: {
                orgId: org.id,
                timestamp: { gte: startOfDay },
              },
            }),
          ])
        );

        invoices = orgInvoices;
        runsToday = decisionCount;
      }
    } catch (err: any) {
      dbError = err.message || "Failed to load invoices from database.";
    }
  }

  if (dbError) {
    return (
      <DatabaseErrorState
        title="AI Agent Advisory Database Error"
        message="Could not load your organization's open invoices. Please verify connectivity and retry."
      />
    );
  }

  // Pre-analyze invoices for immediate display if any exist
  const analyzedInvoices = await Promise.all(
    invoices.map(async (inv) => {
      const { recommendation } = await runAgentAnalysis({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        vendorName: inv.vendor?.name || "Unknown Supplier",
        amountFormatted: formatUsdc(usdcAtomic(inv.totalUsdc)),
        amountAtomic: inv.totalUsdc.toString(),
        matchStatus: inv.matchStatus,
        duplicateScore: inv.duplicateScore,
        isInjectionSuspect: inv.isInjectionSuspect,
        untrustedRawText: inv.rawContent,
        cashPosition: {
          availableTreasury: "Pending Live Query",
          minimumReserve: "2.00 USDC",
          netFreeCash: "Pending Live Query",
        },
        obligationsQueue: {
          totalPendingAmount: formatUsdc(usdcAtomic(inv.totalUsdc)),
          itemCount: invoices.length,
        },
      });

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        vendorName: inv.vendor?.name || "Unknown Supplier",
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
      initialInvoices={analyzedInvoices}
      initialRunsToday={runsToday}
      maxDailyRuns={20}
      orgName={orgName}
      isAdmin={isAdminWallet(session?.address)}
    />
  );
}
