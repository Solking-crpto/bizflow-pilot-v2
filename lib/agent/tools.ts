import { z } from "zod";
import { prisma } from "../db";
import { evaluateThreeWayMatch } from "../matching/threeWayMatch";
import { detectDuplicateInvoice } from "../matching/duplicateDetector";
import { inspectUntrustedInvoiceText } from "./sanitizer";
import { formatUsdc, usdcAtomic } from "../money";

// 1. Tool schemas
export const GetCashPositionSchema = z.object({
  orgId: z.string(),
});

export const ListObligationsSchema = z.object({
  orgId: z.string(),
});

export const GetInvoiceVerificationSchema = z.object({
  invoiceId: z.string(),
});

export const ProposePaymentSchema = z.object({
  invoiceId: z.string(),
  choice: z.enum(["pay_now", "schedule", "hold", "escalate"]),
  reasoning: z.string().min(5),
  confidence: z.number().min(0).max(1),
  suggestedDate: z.string().nullable().optional(),
});

export type ProposePaymentOutput = z.infer<typeof ProposePaymentSchema>;

// Tool definitions for LLM function calling
export const AGENT_TOOLS_DEFINITIONS = [
  {
    name: "get_cash_position",
    description: "Returns the current treasury cash position, minimum reserve buffer, and net free cash.",
    parameters: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Organization ID" },
      },
      required: ["orgId"],
    },
  },
  {
    name: "list_obligations",
    description: "Lists upcoming pending invoice obligations and their due dates.",
    parameters: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Organization ID" },
      },
      required: ["orgId"],
    },
  },
  {
    name: "get_invoice_verification",
    description: "Retrieves 3-way reconciliation match status, duplicate detection risk score, and anti-injection screening for an invoice.",
    parameters: {
      type: "object",
      properties: {
        invoiceId: { type: "string", description: "Invoice ID to inspect" },
      },
      required: ["invoiceId"],
    },
  },
  {
    name: "propose_payment",
    description: "Submits an advisory proposal (pay_now, schedule, hold, or escalate) with reasoning. Note: The AI can only propose; deterministic policy gates decide execution.",
    parameters: {
      type: "object",
      properties: {
        invoiceId: { type: "string", description: "Target invoice ID" },
        choice: {
          type: "string",
          enum: ["pay_now", "schedule", "hold", "escalate"],
          description: "Recommended settlement action",
        },
        reasoning: { type: "string", description: "Financial and security rationale for this proposal" },
        confidence: { type: "number", description: "Confidence score between 0.0 and 1.0" },
        suggestedDate: { type: "string", description: "ISO date if scheduling for later" },
      },
      required: ["invoiceId", "choice", "reasoning", "confidence"],
    },
  },
];

// Tool implementations
export async function getCashPositionTool(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { settings: true },
  });

  const settings = org?.settings[0];
  const minReserve = settings?.minReserveUsdc ?? 2000000000n; // 2,000 USDC
  const availableTreasury = 100000000000n; // 100,000 USDC capacity
  const netFreeCash = availableTreasury > minReserve ? availableTreasury - minReserve : 0n;

  return {
    orgId,
    currency: "USDC",
    availableTreasuryAtomic: availableTreasury.toString(),
    availableTreasuryFormatted: formatUsdc(usdcAtomic(availableTreasury)),
    minReserveAtomic: minReserve.toString(),
    minReserveFormatted: formatUsdc(usdcAtomic(minReserve)),
    netFreeCashAtomic: netFreeCash.toString(),
    netFreeCashFormatted: formatUsdc(usdcAtomic(netFreeCash)),
  };
}

export async function listObligationsTool(orgId: string) {
  const openInvoices = await prisma.invoice.findMany({
    where: {
      orgId,
      status: { in: ["pending_verification", "verified", "review_required", "approved"] },
    },
    select: {
      id: true,
      invoiceNumber: true,
      totalUsdc: true,
      dueDate: true,
      earlyPayDiscountPct: true,
      earlyPayDays: true,
    },
  });

  const totalPendingAtomic = openInvoices.reduce((sum, inv) => sum + BigInt(inv.totalUsdc), 0n);

  return {
    openInvoicesCount: openInvoices.length,
    totalPendingUsdc: formatUsdc(usdcAtomic(totalPendingAtomic)),
    invoices: openInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amountUsdc: formatUsdc(usdcAtomic(inv.totalUsdc)),
      dueDate: inv.dueDate?.toISOString() || null,
      earlyPayDiscountPct: inv.earlyPayDiscountPct,
      earlyPayDays: inv.earlyPayDays,
    })),
  };
}

export async function getInvoiceVerificationTool(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      vendor: true,
      purchaseOrder: {
        include: {
          lines: true,
          goodsReceipts: { include: { lines: true } },
        },
      },
    },
  });

  if (!invoice) {
    return { error: "Invoice not found" };
  }

  // Verification checks
  const vendorActive = invoice.vendor.status === "active";
  const walletMatches = invoice.vendor.walletAddress.length === 42;
  const isInjectionSuspect = invoice.isInjectionSuspect || inspectUntrustedInvoiceText(invoice.rawContent).isSuspicious;

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    vendorName: invoice.vendor.name,
    amountUsdc: formatUsdc(usdcAtomic(invoice.totalUsdc)),
    status: invoice.status,
    matchStatus: invoice.matchStatus,
    duplicateScore: invoice.duplicateScore,
    isInjectionSuspect,
    vendorActive,
    walletMatches,
    dueDate: invoice.dueDate?.toISOString() || null,
    earlyPayDiscountPct: invoice.earlyPayDiscountPct,
    earlyPayDays: invoice.earlyPayDays,
  };
}
