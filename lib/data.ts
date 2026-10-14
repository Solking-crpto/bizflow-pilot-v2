import { cache } from "react";
import { prisma, withDbTimeout } from "./db";
import { formatUsdc, usdcAtomic } from "./money";
import { DEMO_ORG, DEMO_SETTINGS, DEMO_INVOICES, DEMO_VENDORS } from "./demoData";

export const getCommandCenterData = cache(async () => {
  try {
    const org = await withDbTimeout(
      () =>
        prisma.organization.findFirst({
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

    if (org && org.invoices.length > 0) {
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
        () => prisma.agentDecision.findMany({ include: { invoice: true } }),
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
        invoicesProcessed: uniqueInvoices.size > 0 ? uniqueInvoices.size.toString() : "n/a",
        paymentVolumeUsdc:
          settledCount > 0
            ? `${formatUsdc(usdcAtomic(settledAtomic))} USDC`
            : "n/a",
        duplicatesCaught: duplicatesBlocked > 0 ? duplicatesBlocked.toString() : "0",
        injectionAttemptsBlocked: injectionsBlocked > 0 ? injectionsBlocked.toString() : "0",
        decisionsMade: allDecisions.length > 0 ? allDecisions.length.toString() : "n/a",
        autoExecuted: autoExecuted > 0 ? autoExecuted.toString() : allDecisions.length > 0 ? "0" : "n/a",
        escalated: escalated > 0 ? escalated.toString() : allDecisions.length > 0 ? "0" : "n/a",
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
    // Graceful fallback to seeded corporate demo scenario on testnet
  }

  const isMainnet = (process.env.NEXT_PUBLIC_NETWORK_MODE || process.env.NETWORK_MODE) === "mainnet";
  if (isMainnet) {
    return null; // Strictly no demo data fallback on mainnet!
  }

  // Fallback demo state (testnet only)
  const upcomingBills = 1700000000n;
  return {
    org: DEMO_ORG,
    settings: {
      killSwitchActive: DEMO_SETTINGS.killSwitchActive,
      priceToleranceBps: DEMO_SETTINGS.priceToleranceBps,
      requireApprovalAbove: DEMO_SETTINGS.requireApprovalAbove.toString(),
      minReserveUsdc: DEMO_SETTINGS.minReserveUsdc.toString(),
      dailyLimitUsdc: DEMO_SETTINGS.dailyLimitUsdc.toString(),
    },
    metrics: {
      upcomingBillsFormatted: formatUsdc(usdcAtomic(upcomingBills)),
      upcomingBillsAtomic: upcomingBills.toString(),
      settledFormatted: formatUsdc(usdcAtomic(500000n)),
      settledAtomic: "500000",
      awaitingSettlementCount: 1,
      settledCount: 1,
      actionRequiredCount: 3,
      reviewRequiredCount: 1,
      blockedCount: 2,
      pendingApprovalsCount: 3,
      totalInvoicesCount: DEMO_INVOICES.length,
      vendorCount: DEMO_VENDORS.length,
    },
    decisionMetrics: {
      invoicesProcessed: "n/a",
      paymentVolumeUsdc: "n/a",
      duplicatesCaught: "0",
      injectionAttemptsBlocked: "0",
      decisionsMade: "n/a",
      autoExecuted: "n/a",
      escalated: "n/a",
      humanAgreementRate: "n/a",
    },
    recentInvoices: DEMO_INVOICES.map((inv) => ({
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
    recentPayments: [],
  };
});
