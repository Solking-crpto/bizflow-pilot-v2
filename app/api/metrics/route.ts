import { NextResponse } from "next/server";
import { prisma, withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { getActiveNetwork } from "@/lib/networks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const network = getActiveNetwork();

    const [
      invoicesCount,
      confirmedPayments,
      vendorsCount,
      agentDecisionsCount,
      duplicatesCount,
      injectionsCount,
      anchoredCount,
    ] = await withDbTimeout(() =>
      Promise.all([
        prisma.invoice.count(),
        prisma.payment.findMany({
          where: { status: { in: ["confirmed", "anchored"] } },
          select: { amountAtomic: true },
        }),
        prisma.vendor.count({
          where: { status: "active" },
        }),
        prisma.agentDecision.count(),
        prisma.invoice.count({
          where: { duplicateScore: { gte: 90 } },
        }),
        prisma.invoice.count({
          where: { isInjectionSuspect: true },
        }),
        prisma.payment.count({
          where: { anchorTxHash: { not: null } },
        }),
      ])
    );

    const totalVolumeAtomic = confirmedPayments.reduce(
      (sum, p) => sum + BigInt(p.amountAtomic),
      0n
    );

    return NextResponse.json({
      network: network.name,
      chainId: network.chainId,
      metrics: {
        invoicesProcessed: invoicesCount,
        settledVolumeUsdc: formatUsdc(usdcAtomic(totalVolumeAtomic)),
        confirmedPaymentsCount: confirmedPayments.length,
        verifiedSuppliersCount: vendorsCount,
        duplicatesBlocked: duplicatesCount,
        injectionsNeutralized: injectionsCount,
        agentDecisionsLogged: agentDecisionsCount,
        auditProofsAnchored: anchoredCount,
      },
      integrity: {
        mode: "100% Real Database & On-Chain Rows",
        syntheticDataAllowed: false,
        lastComputedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to compute real-time metrics" },
      { status: 500 }
    );
  }
}
