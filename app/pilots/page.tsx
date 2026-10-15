export const dynamic = "force-dynamic";
export const revalidate = 0;

import React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork } from "@/lib/networks";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { PilotsClient, PilotOrgData } from "@/components/pilots/PilotsClient";

export const metadata: Metadata = {
  title: "Pilot Businesses & Real Production Traction | BizFlow Pilot V2",
  description: "Verified enterprise organizations running autonomous AP reconciliation and USDC settlement on Arc.",
};

export default async function PilotsPage() {
  const cookieStore = cookies();
  const networkMode = getServerActiveNetwork(cookieStore.get("bizflow_network")?.value);
  const db = getDb(networkMode);

  let orgs: any[] = [];

  try {
    orgs = await withDbTimeout(() =>
      db.organization.findMany({
        where: { publicConsent: true },
        include: {
          invoices: {
            select: {
              id: true,
              totalUsdc: true,
              status: true,
              duplicateScore: true,
              isInjectionSuspect: true,
            },
          },
          payments: {
            where: { status: "confirmed" },
            select: {
              id: true,
              amountAtomic: true,
              txHash: true,
              confirmedAt: true,
            },
          },
          agentDecisions: {
            select: {
              id: true,
              choice: true,
              outcome: true,
              escalated: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    );
  } catch {
    orgs = [];
  }

  const serialized: PilotOrgData[] = orgs.map((org) => {
    const totalVolumeAtomic = org.payments.reduce(
      (sum: bigint, p: any) => sum + BigInt(p.amountAtomic.toString()),
      0n
    );
    const autoExecutedCount = org.agentDecisions.filter((d: any) => d.outcome === "executed").length;
    const escalatedCount = org.agentDecisions.filter((d: any) => d.escalated).length;
    const duplicatesCaught = org.invoices.filter((i: any) => i.duplicateScore >= 50).length;
    const injectionsBlocked = org.invoices.filter((i: any) => i.isInjectionSuspect).length;

    return {
      id: org.id,
      name: org.name,
      currency: org.currency,
      isPilot: org.isPilot,
      websiteUrl: org.websiteUrl,
      xUrl: org.xUrl,
      linkedinUrl: org.linkedinUrl,
      publicConsent: org.publicConsent,
      createdAt: org.createdAt.toISOString(),
      treasuryModel: "builder-operated treasury, funded by the business",
      metrics: {
        invoicesCount: org.invoices.length,
        paymentVolumeFormatted:
          org.payments.length > 0 ? formatUsdc(usdcAtomic(totalVolumeAtomic)) : "0.00 USDC",
        confirmedPaymentsCount: org.payments.length,
        decisionsCount: org.agentDecisions.length,
        autoExecutedCount,
        escalatedCount,
        threatsBlocked: duplicatesCaught + injectionsBlocked,
        recentSettlements: org.payments.slice(0, 3).map((p: any) => ({
          id: p.id,
          amount: formatUsdc(usdcAtomic(p.amountAtomic)),
          txHash: p.txHash,
          confirmedAt: p.confirmedAt ? p.confirmedAt.toISOString() : null,
        })),
      },
    };
  });

  return <PilotsClient pilots={serialized} />;
}
