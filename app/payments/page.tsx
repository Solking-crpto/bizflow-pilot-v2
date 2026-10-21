export const dynamic = "force-dynamic";
export const revalidate = 0;

import React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDb, withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { evaluatePolicy, PolicyContext } from "@/lib/policy/engine";
import { getServerActiveNetwork, NETWORKS } from "@/lib/networks";
import { PaymentDeskClient, PayableInvoiceItem } from "@/components/payments/PaymentDeskClient";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";
import { getTreasuryBalances } from "@/lib/balances";
import { getServerSession, getSessionOrg } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreditCard, Wallet } from "lucide-react";

export const metadata: Metadata = {
  title: "Payment Desk — Idempotent Arc Settlement | BizFlow Pilot V2",
  description: "Execute policy-approved USDC settlements on Arc with on-chain audit anchoring.",
};

export default async function PaymentsPage() {
  const cookieStore = cookies();
  const networkMode = getServerActiveNetwork(cookieStore.get("bizflow_network")?.value);
  const session = await getServerSession();

  if (!session || !session.address) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Payment Desk — Idempotent Arc Settlement</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Execute policy-approved USDC settlements on Arc with on-chain audit anchoring.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Wallet}
          title="Connect your wallet to begin"
          description="BizFlow Pilot V2 is strictly non-custodial. Connect your Web3 wallet to authorize policy-approved settlements and anchor audit receipts on Arc."
          action={{
            label: "Explore Public Metrics",
            href: "/metrics",
          }}
          secondaryAction={{
            label: "Judge Guide",
            href: "/judges",
          }}
        />
      </div>
    );
  }

  const networkConfig = NETWORKS[networkMode];
  const db = getDb(networkMode);

  const isDryRun = process.env.DRY_RUN === "true" || process.env.NEXT_PUBLIC_DRY_RUN === "true";
  const treasuryBalances = await getTreasuryBalances(networkMode);

  let invoices: any[] = [];
  let dbError: string | null = null;

  if (session) {
    try {
      const org = await getSessionOrg(session, networkMode);
      if (org) {
        invoices = await withDbTimeout(() =>
          db.invoice.findMany({
            where: {
              orgId: org.id,
            },
            include: {
              vendor: true,
              payments: { orderBy: { initiatedAt: "desc" }, take: 1 },
              organization: { include: { settings: true } },
              deliveryRequests: { orderBy: { createdAt: "desc" }, take: 1 },
            },
            orderBy: { createdAt: "desc" },
          })
        );
      }
    } catch (err: any) {
      dbError = err.message || "Failed to load payment queue from database.";
    }
  }

  if (dbError) {
    return (
      <DatabaseErrorState
        title="Payment Desk Database Error"
        message="Could not load payment records from the database. Please ensure your database is accessible and retry."
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

    // Evaluate policy using live on-chain treasury balance
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
      vendorName: inv.vendor?.name || "Unknown Supplier",
      vendorWallet: inv.vendor?.walletAddress || "",
      amountFormatted: formatUsdc(usdcAtomic(inv.totalUsdc)),
      amountAtomic: inv.totalUsdc.toString(),
      status: inv.status,
      matchStatus: inv.matchStatus,
      duplicateScore: inv.duplicateScore,
      isInjectionSuspect: inv.isInjectionSuspect,
      policyDecision: evaluation.decision,
      policySummary: evaluation.summary,
      deliveryProofMode: inv.deliveryProofMode || "off",
      deliveryStatus: inv.deliveryRequests?.[0]?.status || null,
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
