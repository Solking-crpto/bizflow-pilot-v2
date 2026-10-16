import { getDb, withDbTimeout } from "./db";
import { formatUsdc, usdcAtomic } from "./money";
import { NetworkMode } from "./networks";

export async function getCommandCenterData(networkMode?: NetworkMode, walletAddressOrOrgId?: string) {
  if (!walletAddressOrOrgId) return null;

  const mode = networkMode || "mainnet";
  const db = getDb(mode);

  try {
    const isWallet = walletAddressOrOrgId.startsWith("0x");
    const whereClause = isWallet
      ? {
          OR: [
            { walletAddress: { equals: walletAddressOrOrgId, mode: "insensitive" as const } },
            { members: { some: { walletAddress: { equals: walletAddressOrOrgId, mode: "insensitive" as const } } } },
          ],
        }
      : { id: walletAddressOrOrgId };

    const org = await withDbTimeout(
      () =>
        db.organization.findFirst({
          where: whereClause,
          include: {
            settings: true,
            invoices: {
              include: { vendor: true, purchaseOrder: true },
              orderBy: { createdAt: "desc" },
            },
            payments: {
              include: { vendor: true, invoice: true },
              orderBy: { initiatedAt: "desc" },
              take: 5,
            },
            purchaseOrders: true,
            vendors: true,
          },
        })
    );

    if (org) {
      const settings = org.settings[0] || {
        killSwitchActive: false,
        priceToleranceBps: 100,
        requireApprovalAbove: 5000000000n,
        minReserveUsdc: 2000000000n,
        dailyLimitUsdc: 20000000000n,
      };

      let upcomingBillsAtomic = 0n;
      let awaitingSettlementCount = 0;
      let settledAtomic = 0n;
      let settledCount = 0;
      let reviewRequiredCount = 0;
      let blockedCount = 0;

      for (const p of org.payments) {
        if (p.status === "confirmed") {
          settledAtomic += p.amountAtomic;
          settledCount++;
        }
      }

      for (const inv of org.invoices) {
        const hasConfirmedPayment = org.payments.some(
          (p) => p.invoiceId === inv.id && p.status === "confirmed"
        );
        if (inv.status === "paid" || inv.status === "settled" || hasConfirmedPayment) {
          if (!hasConfirmedPayment) {
            settledAtomic += inv.totalUsdc;
            settledCount++;
          }
        } else if (inv.status === "verified" || inv.status === "pending_verification") {
          upcomingBillsAtomic += inv.totalUsdc;
          awaitingSettlementCount++;
        } else if (inv.status === "review_required") {
          reviewRequiredCount++;
        } else if (inv.status === "blocked") {
          blockedCount++;
        }
      }

      const actionRequiredCount = reviewRequiredCount + blockedCount;

      const allDecisions = await withDbTimeout(
        () => db.agentDecision.findMany({ where: { orgId: org.id }, include: { invoice: true } }),
        2500,
        []
      );

      const uniqueInvoices = new Set(allDecisions.map((d) => d.invoiceId));
      const duplicatesBlocked = allDecisions.filter(
        (d) => d.invoice?.duplicateScore && d.invoice.duplicateScore >= 90
      ).length;
      const injectionsBlocked = allDecisions.filter(
        (d) => d.invoice?.isInjectionSuspect
      ).length;
      const autoExecuted = allDecisions.filter((d) => d.outcome === "executed").length;
      const escalated = allDecisions.filter((d) => d.escalated).length;

      const reviewedEscalations = allDecisions.filter(
        (d) => d.escalated && d.humanResponse !== null
      );
      const agreedCount = reviewedEscalations.filter(
        (d) => d.humanResponse === "approved"
      ).length;

      const humanAgreementRate =
        reviewedEscalations.length > 0
          ? `${((agreedCount / reviewedEscalations.length) * 100).toFixed(0)}%`
          : "n/a";

      const decisionMetrics = {
        invoicesProcessed: uniqueInvoices.size > 0 ? uniqueInvoices.size.toString() : "0",
        paymentVolumeUsdc:
          settledCount > 0
            ? `${formatUsdc(usdcAtomic(settledAtomic))} USDC`
            : "0.00 USDC",
        duplicatesCaught: duplicatesBlocked > 0 ? duplicatesBlocked.toString() : "0",
        injectionAttemptsBlocked: injectionsBlocked > 0 ? injectionsBlocked.toString() : "0",
        decisionsMade: allDecisions.length > 0 ? allDecisions.length.toString() : "0",
        autoExecuted: autoExecuted > 0 ? autoExecuted.toString() : "0",
        escalated: escalated > 0 ? escalated.toString() : "0",
        humanAgreementRate,
      };

      return {
        org: {
          id: org.id,
          name: org.name,
          currency: org.currency,
        },
        settings: {
          killSwitchActive: settings.killSwitchActive,
          priceToleranceBps: settings.priceToleranceBps,
          requireApprovalAbove: settings.requireApprovalAbove.toString(),
          minReserveUsdc: settings.minReserveUsdc.toString(),
          dailyLimitUsdc: settings.dailyLimitUsdc.toString(),
        },
        metrics: {
          upcomingBillsFormatted: formatUsdc(usdcAtomic(upcomingBillsAtomic)),
          upcomingBillsAtomic: upcomingBillsAtomic.toString(),
          settledFormatted: formatUsdc(usdcAtomic(settledAtomic)),
          settledAtomic: settledAtomic.toString(),
          awaitingSettlementCount,
          settledCount,
          actionRequiredCount,
          reviewRequiredCount,
          blockedCount,
          pendingApprovalsCount: actionRequiredCount,
          totalInvoicesCount: org.invoices.length,
          vendorCount: org.vendors.length,
        },
        decisionMetrics,
        recentInvoices: org.invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          vendorName: inv.vendor.name,
          amountFormatted: formatUsdc(usdcAtomic(inv.totalUsdc)),
          amountAtomic: inv.totalUsdc.toString(),
          status: inv.status,
          matchStatus: inv.matchStatus,
          isInjectionSuspect: inv.isInjectionSuspect,
          duplicateScore: inv.duplicateScore,
          createdAt: inv.createdAt.toISOString(),
        })),
        recentPayments: org.payments.map((p) => ({
          id: p.id,
          invoiceNumber: p.invoice.invoiceNumber,
          vendorName: p.vendor.name,
          amountFormatted: formatUsdc(usdcAtomic(p.amountAtomic)),
          destination: p.destination,
          network: p.network,
          provider: p.provider,
          status: p.status,
          txHash: p.txHash,
          anchorTxHash: p.anchorTxHash,
          initiatedAt: p.initiatedAt.toISOString(),
          confirmedAt: p.confirmedAt ? p.confirmedAt.toISOString() : null,
        })),
      };
    }
  } catch (err) {
    // Database query error handled gracefully
  }

  // Production and testnet start empty when no org is registered
  return null;
}
