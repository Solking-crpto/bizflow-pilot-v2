import { NextRequest, NextResponse } from "next/server";
import { getDb, withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { NETWORKS, NetworkMode } from "@/lib/networks";

export const dynamic = "force-dynamic";

async function getNetworkMetrics(networkMode: NetworkMode) {
  const network = NETWORKS[networkMode];
  try {
    const db = getDb(networkMode);
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
        db.invoice.count(),
        db.payment.findMany({
          where: { status: { in: ["confirmed", "anchored"] } },
          select: { amountAtomic: true },
        }),
        db.vendor.count({
          where: { status: "active" },
        }),
        db.agentDecision.count(),
        db.invoice.count({
          where: { duplicateScore: { gte: 90 } },
        }),
        db.invoice.count({
          where: { isInjectionSuspect: true },
        }),
        db.payment.count({
          where: { anchorTxHash: { not: null } },
        }),
      ]),
      3000
    );

    const totalVolumeAtomic = confirmedPayments.reduce(
      (sum, p) => sum + BigInt(p.amountAtomic),
      0n
    );

    return {
      network: network.name,
      mode: network.mode,
      chainId: network.chainId,
      available: true,
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
    };
  } catch (err: any) {
    return {
      network: network.name,
      mode: network.mode,
      chainId: network.chainId,
      available: false,
      error: err.message || "Failed to load database schema",
      metrics: null,
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    const [mainnetMetrics, testnetMetrics] = await Promise.all([
      getNetworkMetrics("mainnet"),
      getNetworkMetrics("testnet"),
    ]);

    return NextResponse.json({
      mainnet: mainnetMetrics,
      testnet: testnetMetrics,
      integrity: {
        mode: "100% Real Database & On-Chain Rows",
        syntheticDataAllowed: false,
        crossNetworkAggregation: false,
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
