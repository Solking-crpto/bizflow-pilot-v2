import React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork } from "@/lib/networks";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { InvoiceDeskClient, SerializedInvoice } from "@/components/invoices/InvoiceDeskClient";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";
import { getServerSession, getSessionOrg } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Invoice Desk & Match Queue | BizFlow Pilot V2",
  description: "Autonomous 3-way matching and policy gate verification for inbound invoices.",
};

export default async function InvoiceDeskPage() {
  const cookieStore = cookies();
  const networkMode = getServerActiveNetwork(cookieStore.get("bizflow_network")?.value);
  const db = getDb(networkMode);
  const session = await getServerSession();
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
      }
    } catch (err: any) {
      dbError = err.message || "Failed to load invoices from database.";
    }
  }

  if (dbError) {
    return (
      <DatabaseErrorState
        title="Invoice Desk Database Error"
        message="Could not load invoices from the database. Please verify connectivity and retry."
      />
    );
  }

  const serializedInvoices: SerializedInvoice[] = invoices.map((inv) => {
    const po = inv.purchaseOrder;
    const poLine = po?.lines?.[0];
    const gr = po?.goodsReceipts?.[0];
    const grLine = gr?.lines?.[0];

    const isDemo =
      inv.invoiceNumber?.includes("DEMO") ||
      inv.vendor?.name?.includes("demo") ||
      inv.vendor?.name?.includes("DEMO") ||
      inv.rawContent?.includes("DEMO DATA");

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      vendorId: inv.vendorId,
      vendorName: inv.vendor?.name || "Unknown Supplier",
      vendorWallet: inv.vendor?.walletAddress || "",
      poNumber: po?.poNumber || "N/A",
      poQty: poLine?.quantity || 0,
      poUnitPrice: poLine?.unitPriceUsdc ? formatUsdc(usdcAtomic(poLine.unitPriceUsdc)) : "0.00 USDC",
      poTotal: po?.totalUsdc ? formatUsdc(usdcAtomic(po.totalUsdc)) : "0.00 USDC",
      grNumber: gr?.grNumber || "N/A",
      grQty: grLine?.quantity || 0,
      receivedBy: gr?.receivedBy || "Unrecorded",
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
