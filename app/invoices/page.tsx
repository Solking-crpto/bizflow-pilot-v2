import React from "react";
import type { Metadata } from "next";
import { prisma, withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { InvoiceDeskClient, SerializedInvoice } from "@/components/invoices/InvoiceDeskClient";
import { DEMO_INVOICES } from "@/lib/demoData";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invoice Desk & Match Queue | BizFlow Pilot V2",
  description: "Autonomous 3-way matching and policy gate verification for inbound invoices.",
};

export default async function InvoiceDeskPage() {
  const isMainnet = (process.env.NEXT_PUBLIC_NETWORK_MODE || process.env.NETWORK_MODE) === "mainnet";
  let invoices: any[] = [];
  let dbError: string | null = null;

  try {
    invoices = await withDbTimeout(
      () =>
        prisma.invoice.findMany({
          where: isMainnet ? { network: "mainnet" } : undefined,
          include: {
            vendor: true,
            purchaseOrder: {
              include: {
                lines: { include: { item: true } },
                goodsReceipts: {
                  include: { lines: { include: { item: true } } },
                },
              },
            },
          },
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
        title="Invoice Desk Database Error"
        message="Could not load live mainnet invoices from the database. Please verify database connectivity and retry."
      />
    );
  }

  if (!isMainnet && invoices.length === 0) {
    invoices = DEMO_INVOICES;
  }

  const serializedInvoices: SerializedInvoice[] = invoices.map((inv) => {
    const po = inv.purchaseOrder;
    const poLine = po?.lines?.[0];
    const gr = po?.goodsReceipts?.[0];
    const grLine = gr?.lines?.[0];

    const isDemo =
      inv.invoiceNumber.includes("DEMO") ||
      inv.vendor?.name?.includes("demo") ||
      inv.vendor?.name?.includes("DEMO") ||
      inv.rawContent?.includes("DEMO DATA");

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      vendorId: inv.vendorId,
      vendorName: inv.vendor?.name || "Northgate Cement Supply (demo vendor)",
      vendorWallet: inv.vendor?.walletAddress || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      poNumber: po?.poNumber || "PO-2026-0089",
      poQty: poLine?.quantity || 200,
      poUnitPrice: formatUsdc(usdcAtomic(poLine?.unitPriceUsdc || 8500000n)),
      poTotal: formatUsdc(usdcAtomic(po?.totalUsdc || 1700000000n)),
      grNumber: gr?.grNumber || "GR-2026-0089",
      grQty: grLine?.quantity || 200,
      receivedBy: gr?.receivedBy || "Warehouse Receiver",
      amountFormatted: formatUsdc(usdcAtomic(inv.totalUsdc)),
      amountAtomic: inv.totalUsdc.toString(),
      status: inv.status,
      matchStatus: inv.matchStatus,
      duplicateScore: inv.duplicateScore,
      isInjectionSuspect: inv.isInjectionSuspect,
      suspicionNotes: inv.suspicionNotes,
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : null,
      earlyPayDiscountPct: inv.earlyPayDiscountPct ?? null,
      earlyPayDays: inv.earlyPayDays ?? null,
      isDemo: Boolean(isDemo),
      fileHash: inv.fileHash,
      rawContent: inv.rawContent,
      createdAt: (inv.createdAt instanceof Date ? inv.createdAt : new Date()).toISOString(),
    };
  });

  return <InvoiceDeskClient invoices={serializedInvoices} />;
}
