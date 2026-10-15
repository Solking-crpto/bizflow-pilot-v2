import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";
import { parseUsdc, formatUsdc, usdcAtomic } from "@/lib/money";
import { sha256 } from "@/lib/crypto";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { inspectUntrustedInvoiceText } from "@/lib/agent/sanitizer";
import { detectDuplicateInvoice } from "@/lib/matching/duplicateDetector";
import { evaluateThreeWayMatch } from "@/lib/matching/threeWayMatch";
import { recordAuditEvent } from "@/lib/audit/ledger";
import { parseInvoiceRawText } from "@/lib/invoices/parser";
import { getClientIp, checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

const CreateInvoiceSchema = z.object({
  vendorId: z.string().min(1, "Supplier is required"),
  purchaseOrderId: z.string().optional().or(z.literal("")),
  invoiceNumber: z.string().min(2, "Invoice number required"),
  totalUsdc: z.string().min(1, "Total amount in USDC required"),
  dueDate: z.string().optional(),
  earlyPayDiscountPct: z.number().optional(),
  earlyPayDays: z.number().int().optional(),
  rawContent: z.string().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().optional(),
        sku: z.string().optional(),
        description: z.string().optional(),
        quantity: z.number().int().positive(),
        unitPriceUsdc: z.string(),
        totalUsdc: z.string(),
      })
    )
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const netCtx = validateApiNetwork(req);
    if (!netCtx.success) return netCtx.response;
    const { network, db } = netCtx;

    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getSessionOrg(session, network);
    if (!org) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const invoices = await withDbTimeout(() =>
      db.invoice.findMany({
        where: { orgId: org.id },
        include: {
          vendor: true,
          purchaseOrder: true,
          payments: {
            where: { status: "confirmed" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      })
    );

    return NextResponse.json({
      success: true,
      network,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        vendorName: inv.vendor.name,
        vendorId: inv.vendorId,
        poNumber: inv.purchaseOrder?.poNumber || null,
        totalUsdc: formatUsdc(usdcAtomic(inv.totalUsdc)),
        status: inv.status,
        matchStatus: inv.matchStatus,
        duplicateScore: inv.duplicateScore,
        isInjectionSuspect: inv.isInjectionSuspect,
        suspicionNotes: inv.suspicionNotes,
        dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
        confirmedTxHash: inv.payments[0]?.txHash || null,
        createdAt: inv.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const netCtx = validateApiNetwork(req);
    if (!netCtx.success) return netCtx.response;
    const { network, db } = netCtx;

    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Please sign in" }, { status: 401 });
    }

    const ip = getClientIp(req);
    const rlIp = checkRateLimit(`invoice:create:ip:${ip}`, 30, 60_000);
    if (!rlIp.allowed) return rateLimitExceededResponse(rlIp.retryAfterSeconds);

    const org = await getSessionOrg(session, network);
    if (!org) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const body = await req.json();

    // If paste-text mode is used, parse raw text first
    if (body.rawText && typeof body.rawText === "string") {
      const parsedFromText = parseInvoiceRawText(body.rawText);
      body.invoiceNumber = body.invoiceNumber || parsedFromText.invoiceNumber;
      body.totalUsdc = body.totalUsdc || parsedFromText.totalUsdc;
      body.rawContent = body.rawText;
    }

    const parsed = CreateInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      vendorId,
      purchaseOrderId,
      invoiceNumber,
      totalUsdc,
      dueDate,
      earlyPayDiscountPct,
      earlyPayDays,
      rawContent,
      items = [],
    } = parsed.data;

    // 1. Verify vendor belongs to this organization (IDOR check)
    const vendor = await withDbTimeout(() =>
      db.vendor.findUnique({
        where: { id: vendorId },
      })
    );

    if (!vendor || vendor.orgId !== org.id) {
      return NextResponse.json(
        { error: "Supplier not found or access forbidden" },
        { status: 403 }
      );
    }

    // 2. Validate PO belongs to org if specified
    let po: any = null;
    if (purchaseOrderId) {
      po = await withDbTimeout(() =>
        db.purchaseOrder.findUnique({
          where: { id: purchaseOrderId },
          include: {
            lines: { include: { item: true } },
            goodsReceipts: {
              include: { lines: { include: { item: true } } },
            },
          },
        })
      );

      if (!po || po.orgId !== org.id) {
        return NextResponse.json(
          { error: "Purchase order reference not found or access forbidden" },
          { status: 403 }
        );
      }
    }

    const totalAtomic = parseUsdc(totalUsdc);
    const contentToHash = rawContent || JSON.stringify({ invoiceNumber, vendorId, totalUsdc, items });
    const fileHash = sha256(contentToHash);

    // 3. Prompt Injection Screening
    const injectionCheck = inspectUntrustedInvoiceText(rawContent || contentToHash);
    const isInjectionSuspect = injectionCheck.isSuspicious;
    const suspicionNotes = isInjectionSuspect
      ? `SECURITY THREAT DETECTED: Prompt injection markers found: ${injectionCheck.detectedThreats.join("; ")}`
      : null;

    // 4. Duplicate Detection (scoped strictly to this organization)
    const existingInvoices = await withDbTimeout(() =>
      db.invoice.findMany({
        where: { orgId: org.id },
        select: {
          id: true,
          invoiceNumber: true,
          vendorId: true,
          purchaseOrderId: true,
          fileHash: true,
          totalUsdc: true,
        },
      })
    );

    const duplicateCheck = detectDuplicateInvoice(
      {
        invoiceNumber,
        vendorId,
        purchaseOrderId: po?.id,
        fileHash,
        totalUsdc: totalAtomic,
      },
      existingInvoices
    );

    const duplicateScore = duplicateCheck.score;

    // 5. Deterministic Three-Way Match against PO and Goods Receipts
    let matchStatus = "unmatched";
    let matchPassed = true;

    if (po && po.lines.length > 0) {
      const poLines = po.lines.map((l: any) => ({
        itemId: l.itemId,
        sku: l.item.sku,
        quantity: l.quantity,
        unitPriceUsdc: usdcAtomic(l.unitPriceUsdc),
      }));

      const allGrLines: any[] = [];
      for (const gr of po.goodsReceipts) {
        for (const grl of gr.lines) {
          allGrLines.push({
            itemId: grl.itemId,
            quantity: grl.quantity,
          });
        }
      }

      const invoiceLines = items.map((itm) => ({
        itemId: itm.itemId,
        sku: itm.sku,
        quantity: itm.quantity,
        unitPriceUsdc: parseUsdc(itm.unitPriceUsdc),
        totalUsdc: parseUsdc(itm.totalUsdc),
      }));

      const matchResult = evaluateThreeWayMatch({
        poLines,
        grLines: allGrLines,
        invoiceLines: invoiceLines.length > 0 ? invoiceLines : poLines.map((l: any) => ({ ...l, totalUsdc: l.unitPriceUsdc * BigInt(l.quantity) })),
        toleranceBps: 100, // 1%
      });

      matchStatus = matchResult.matchStatus;
      matchPassed = matchResult.passed;
    }

    // 6. Overall Status Evaluation
    let invoiceStatus = "verified";
    if (isInjectionSuspect) {
      invoiceStatus = "blocked";
    } else if (duplicateScore >= 90) {
      invoiceStatus = "blocked";
    } else if (!matchPassed && po) {
      invoiceStatus = "review_required";
    }

    // 7. Store Invoice in Database
    const invoice = await withDbTimeout(() =>
      db.invoice.create({
        data: {
          orgId: org.id,
          vendorId: vendor.id,
          purchaseOrderId: po ? po.id : null,
          invoiceNumber: invoiceNumber.trim().toUpperCase(),
          totalUsdc: totalAtomic,
          fileHash,
          rawContent: rawContent || null,
          extractedData: JSON.stringify({
            invoiceNumber,
            vendorName: vendor.name,
            totalUsdc,
            items,
          }),
          status: invoiceStatus,
          matchStatus,
          duplicateScore,
          isInjectionSuspect,
          suspicionNotes,
          dueDate: dueDate ? new Date(dueDate) : null,
          earlyPayDiscountPct: earlyPayDiscountPct || null,
          earlyPayDays: earlyPayDays || null,
        },
      })
    );

    // 8. Record in Cryptographic Audit Ledger
    await recordAuditEvent({
      orgId: org.id,
      eventType: "invoice_received",
      referenceId: invoice.id,
      eventData: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        vendorId: vendor.id,
        vendorName: vendor.name,
        totalUsdc,
        duplicateScore,
        isInjectionSuspect,
        matchStatus,
        status: invoiceStatus,
      },
      network,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      network,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        vendorName: vendor.name,
        totalUsdc: formatUsdc(usdcAtomic(invoice.totalUsdc)),
        status: invoice.status,
        matchStatus: invoice.matchStatus,
        duplicateScore: invoice.duplicateScore,
        isInjectionSuspect: invoice.isInjectionSuspect,
        suspicionNotes: invoice.suspicionNotes,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
