import React from "react";
import type { Metadata } from "next";
import { prisma, withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { evaluatePolicy, PolicyContext } from "@/lib/policy/engine";
import { getActiveNetwork } from "@/lib/networks";
import { PaymentDeskClient, PayableInvoiceItem } from "@/components/payments/PaymentDeskClient";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";
import { getTreasuryBalances } from "@/lib/balances";

import { getServerSession, getSessionOrg } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment Desk — Idempotent Arc Settlement | BizFlow Pilot V2",
  description: "Execute policy-approved USDC settlements on Arc with on-chain audit anchoring.",
};

export default async function PaymentsPage() {
  const networkConfig = getActiveNetwork();
  const isMainnet = networkConfig.mode === "mainnet";
  const isDryRun = process.env.DRY_RUN === "true" || process.env.NEXT_PUBLIC_DRY_RUN === "true";
  const treasuryBalances = await getTreasuryBalances();

  const session = await getServerSession();
  let invoices: any[] = [];
  let dbError: string | null = null;

  if (session) {
    try {
      const org = await getSessionOrg(session);
      if (org) {
        invoices = await withDbTimeout(() =>
          prisma.invoice.findMany({
            where: {
              orgId: org.id,
              ...(isMainnet ? { network: "mainnet" } : {}),
            },
            include: {
              vendor: true,
              payments: { orderBy: { initiatedAt: "desc" }, take: 1 },
              organization: { include: { settings: true } },
            },
            orderBy: { createdAt: "desc" },
          })
        );
      }
    } catch (err: any) {
      if (isMainnet) {
        dbError = err.message || "Failed to load payment queue from database.";
      } else {
        invoices = [];
      }
    }
  }

  if (isMainnet && dbError) {
    return (
      <DatabaseErrorState
        title="Payment Desk Database Error"
        message="Could not load live mainnet payment records from the database. Please ensure your database is accessible and retry."
      />
    );
  }

  const payableItems: PayableInvoiceItem[] = invoices.map((inv) => {
    const settings = inv.organization?.settings?.[0] || {
      killSwitchActive: false,
      priceToleranceBps: 100,
      requireApprovalAbove: 5000000000n,
      minReserveUsdc: 2000000000n,
      dailyLimitUsdc: 20000000000n,
    };
    const latestPayment = inv.payments?.[0];

    // Evaluate policy using live on-chain treasury balance on mainnet
    const policyContext: PolicyContext = {
      network: networkConfig.mode,
      killSwitchActive: settings.killSwitchActive,
      availableTreasuryUsdc: usdcAtomic(treasuryBalances.usdcAtomicValue),
      minReserveUsdc: usdcAtomic(settings.minReserveUsdc),
      dailySpentUsdc: usdcAtomic(0n),
      dailyLimitUsdc: usdcAtomic(settings.dailyLimitUsdc),
      approvalThresholdUsdc: usdcAtomic(settings.requireApprovalAbove),
      maxMainnetPaymentUsdc: usdcAtomic(25000000n), // 25.00 USDC Beta Cap
      hasOwnerConfirmation: true,

      vendor: {
        id: inv.vendor?.id || inv.vendorId,
        name: inv.vendor?.name || "Unknown Supplier",
        status: inv.vendor?.status || "active",
        recordedWallet: inv.vendor?.walletAddress || "",
        perVendorLimitUsdc: usdcAtomic(inv.vendor?.perVendorLimitUsdc || 10000000000n),
        walletCooldownUntil: inv.vendor?.walletCooldownUntil || null,
      },

      invoice: {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        totalUsdc: usdcAtomic(inv.totalUsdc),
        remittanceWallet: inv.vendor?.walletAddress || "",
        matchStatus: inv.matchStatus,
        duplicateScore: inv.duplicateScore,
        isInjectionSuspect: inv.isInjectionSuspect,
        hasExistingPaymentForNetwork: !!latestPayment,
        isHumanApproved: true,
      },
    };

    const evaluation = evaluatePolicy(policyContext);

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      vendorName: inv.vendor?.name || "Northgate Cement Supply (demo vendor)",
      vendorWallet: inv.vendor?.walletAddress || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      amountFormatted: formatUsdc(usdcAtomic(inv.totalUsdc)),
      amountAtomic: inv.totalUsdc.toString(),
      status: inv.status,
      matchStatus: inv.matchStatus,
      duplicateScore: inv.duplicateScore,
      isInjectionSuspect: inv.isInjectionSuspect,
      policyDecision: evaluation.decision,
      policySummary: evaluation.summary,
      paymentRecord: latestPayment
        ? {
            id: latestPayment.id,
            txHash: latestPayment.txHash,
            anchorTxHash: latestPayment.anchorTxHash,
            status: latestPayment.status,
            confirmedAt: latestPayment.confirmedAt ? (latestPayment.confirmedAt instanceof Date ? latestPayment.confirmedAt.toISOString() : latestPayment.confirmedAt) : null,
          }
        : null,
    };
  });

  const isPublicSandbox =
    networkConfig.mode === "testnet" &&
    (process.env.PUBLIC_SANDBOX === "true" || process.env.NEXT_PUBLIC_PUBLIC_SANDBOX === "true");

  return (
    <PaymentDeskClient
      items={payableItems}
      networkMode={networkConfig.mode}
      explorerUrl={networkConfig.explorerUrl}
      maxMainnetPayment={networkConfig.maxPaymentUsdc}
      isDryRun={isDryRun}
      isPublicSandbox={isPublicSandbox}
    />
  );
}
