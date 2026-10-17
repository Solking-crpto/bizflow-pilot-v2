import { NextRequest, NextResponse } from "next/server";
import { getDb, withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { NETWORKS, NetworkMode } from "@/lib/networks";
import { isTestOrganization } from "@/lib/builder-wallets";

export const dynamic = "force-dynamic";

async function getNetworkMetrics(networkMode: NetworkMode) {
  const network = NETWORKS[networkMode];
  try {
    const db = getDb(networkMode);

    // Fetch all organizations in this network schema to partition external vs builder/test activity
    const orgs = await withDbTimeout(
      () =>
        db.organization.findMany({
          select: { id: true, name: true, walletAddress: true, isTest: true },
        }),
      2500,
      []
    );

    const externalOrgIds = orgs.filter((o) => !isTestOrganization(o)).map((o) => o.id);
    const testOrgIds = orgs.filter((o) => isTestOrganization(o)).map((o) => o.id);

    async function queryMetricsForOrgIds(orgIds: string[]) {
      if (orgIds.length === 0) {
        return {
          organizationsCount: 0,
          invoicesProcessed: 0,
          settledVolumeUsdc: "0.00",
          confirmedPaymentsCount: 0,
          verifiedSuppliersCount: 0,
          duplicatesBlocked: 0,
          injectionsNeutralized: 0,
          agentDecisionsLogged: 0,
          auditProofsAnchored: 0,
        };
      }

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
          db.invoice.count({ where: { orgId: { in: orgIds } } }),
          db.payment.findMany({
            where: {
              orgId: { in: orgIds },
              status: { in: ["confirmed", "anchored"] },
            },
            select: { amountAtomic: true },
          }),
          db.vendor.count({
            where: { orgId: { in: orgIds }, status: "active" },
          }),
          db.agentDecision.count({ where: { orgId: { in: orgIds } } }),
          db.invoice.count({
            where: { orgId: { in: orgIds }, duplicateScore: { gte: 90 } },
          }),
          db.invoice.count({
            where: { orgId: { in: orgIds }, isInjectionSuspect: true },
          }),
          db.payment.count({
            where: { orgId: { in: orgIds }, anchorTxHash: { not: null } },
          }),
        ]),
        3500
      );

      const totalVolumeAtomic = confirmedPayments.reduce(
        (sum, p) => sum + BigInt(p.amountAtomic),
        0n
      );

      return {
        organizationsCount: orgIds.length,
        invoicesProcessed: invoicesCount,
        settledVolumeUsdc: formatUsdc(usdcAtomic(totalVolumeAtomic)),
        confirmedPaymentsCount: confirmedPayments.length,
        verifiedSuppliersCount: vendorsCount,
        duplicatesBlocked: duplicatesCount,
        injectionsNeutralized: injectionsCount,
        agentDecisionsLogged: agentDecisionsCount,
        auditProofsAnchored: anchoredCount,
      };
    }

    const [externalMetrics, testMetrics] = await Promise.all([
      queryMetricsForOrgIds(externalOrgIds),
      queryMetricsForOrgIds(testOrgIds),
    ]);

    return {
      network: network.name,
      mode: network.mode,
      chainId: network.chainId,
      available: true,
      external: externalMetrics,
      testActivity: testMetrics,
      // Default metrics property reports external usage only for honest traction
      metrics: externalMetrics,
    };
  } catch (err: any) {
    return {
      network: network.name,
      mode: network.mode,
      chainId: network.chainId,
      available: false,
      error: err.message || "Failed to load database schema",
      external: null,
      testActivity: null,
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
        builderTestSeparation: true,
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
