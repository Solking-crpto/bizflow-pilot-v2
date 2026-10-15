export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbTimeout } from "@/lib/db";
import { verifyOwnerPasscodeWithRateLimit, getClientIp } from "@/lib/security/auth";
import { executePaymentTransaction } from "@/lib/payments/executor";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { getSessionFromRequest, isAdminWallet, getSessionOrg } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const filterChoice = searchParams.get("choice");
    const filterEscalated = searchParams.get("escalated");
    const filterOutcome = searchParams.get("outcome");

    const session = getSessionFromRequest(req);
    const isAdmin = session ? isAdminWallet(session.address) : false;

    const whereClause: any = {};
    if (filterChoice) whereClause.choice = filterChoice;
    if (filterEscalated === "true") whereClause.escalated = true;
    if (filterEscalated === "false") whereClause.escalated = false;
    if (filterOutcome) whereClause.outcome = filterOutcome;

    // Tenant isolation: public users only see their own org's decisions
    if (session && !isAdmin && session.orgId) {
      whereClause.orgId = session.orgId;
    }

    const decisions = await withDbTimeout(() =>
      prisma.agentDecision.findMany({
        where: whereClause,
        include: {
          invoice: {
            include: {
              vendor: true,
            },
          },
        },
        orderBy: { timestamp: "desc" },
        take: 100,
      })
    );

    // Compute honest metrics strictly from real rows scoped to org if not admin
    const metricsWhere: any = (session && !isAdmin && session.orgId) ? { orgId: session.orgId } : {};

    const allDecisions = await withDbTimeout(() =>
      prisma.agentDecision.findMany({
        where: metricsWhere,
        include: {
          invoice: true,
        },
      })
    );

    const paymentWhere: any = { status: { in: ["confirmed", "anchored"] } };
    if (session && !isAdmin && session.orgId) {
      paymentWhere.orgId = session.orgId;
    }

    const confirmedPayments = await withDbTimeout(() =>
      prisma.payment.findMany({
        where: paymentWhere,
        select: { amountAtomic: true },
      })
    );

    const totalVolumeAtomic = confirmedPayments.reduce(
      (sum, p) => sum + BigInt(p.amountAtomic),
      0n
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

    return NextResponse.json({
      decisions: decisions.map((d) => ({
        id: d.id,
        timestamp: d.timestamp.toISOString(),
        invoiceNumber: d.invoice?.invoiceNumber ?? "Unknown",
        vendorName: d.invoice?.vendor?.name ?? "Unknown",
        amountFormatted: d.invoice?.totalUsdc
          ? `${formatUsdc(usdcAtomic(d.invoice.totalUsdc))} USDC`
          : "n/a",
        choice: d.choice,
        reasoning: d.reasoning,
        source: d.source,
        model: d.model,
        promptVersion: d.promptVersion,
        escalated: d.escalated,
        outcome: d.outcome,
        humanResponse: d.humanResponse,
        txHash: d.txHash,
        conflictWithPolicy: d.conflictWithPolicy,
        policyConflictReason: d.policyConflictReason,
      })),
      metrics: {
        invoicesProcessed: uniqueInvoices.size > 0 ? uniqueInvoices.size.toString() : "n/a",
        paymentVolumeUsdc:
          confirmedPayments.length > 0
            ? `${formatUsdc(usdcAtomic(totalVolumeAtomic))} USDC`
            : "0.00 USDC",
        duplicatesCaught: duplicatesBlocked > 0 ? duplicatesBlocked.toString() : "0",
        injectionAttemptsBlocked: injectionsBlocked > 0 ? injectionsBlocked.toString() : "0",
        decisionsMade: allDecisions.length > 0 ? allDecisions.length.toString() : "n/a",
        autoExecuted: autoExecuted > 0 ? autoExecuted.toString() : "0",
        escalated: escalated > 0 ? escalated.toString() : "0",
        humanAgreementRate,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load decisions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json();
    const { decisionId, action } = body;
    const session = getSessionFromRequest(req);
    const isAdmin = session ? isAdminWallet(session.address) : false;

    if (!decisionId || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid payload: decisionId and action (approve|reject) required" }, { status: 400 });
    }

    if (!session) {
      // Passcode authentication fallback for builder admin
      const authCheck = verifyOwnerPasscodeWithRateLimit(body.passcode, clientIp);
      if (!authCheck.authorized) {
        return NextResponse.json(
          { error: authCheck.error },
          {
            status: authCheck.status || 401,
            headers: authCheck.retryAfterSeconds
              ? { "Retry-After": authCheck.retryAfterSeconds.toString() }
              : {},
          }
        );
      }
    }

    const decision = await prisma.agentDecision.findUnique({
      where: { id: decisionId },
      include: {
        invoice: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!decision) {
      return NextResponse.json({ error: "Decision not found" }, { status: 404 });
    }

    // IDOR protection: user can only act on their own organization's decisions unless admin
    if (session && !isAdmin && session.orgId && decision.orgId !== session.orgId) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to modify decisions for another organization." },
        { status: 403 }
      );
    }

    if (action === "approve") {
      const isPublicOrg = decision.invoice?.organization?.walletAddress && !isAdmin;

      if (isPublicOrg) {
        // Non-custodial requirement: public organizations sign payments with their own wallet
        return NextResponse.json({
          success: true,
          action: "approved_pending_signature",
          requiresWalletSignature: true,
          invoiceId: decision.invoiceId,
          message: "Escalation approved. Please sign the USDC payment transaction with your connected wallet.",
        });
      }

      // Execute builder-operated payment safely through server executor
      const execResult = await executePaymentTransaction({
        invoiceId: decision.invoiceId,
        actor: "human",
        hasOwnerConfirmation: true,
      });

      if (!execResult.success) {
        return NextResponse.json(
          { error: `Payment failed: ${execResult.error}`, details: execResult.details },
          { status: 400 }
        );
      }

      const updated = await prisma.agentDecision.update({
        where: { id: decisionId },
        data: {
          humanResponse: "approved",
          outcome: "executed",
          txHash: execResult.txHash || null,
        },
      });

      return NextResponse.json({
        success: true,
        action: "approved",
        decision: updated,
        txHash: execResult.txHash,
        anchorTxHash: execResult.anchorTxHash,
      });
    } else {
      // Reject escalation
      const updated = await prisma.agentDecision.update({
        where: { id: decisionId },
        data: {
          humanResponse: "rejected",
          outcome: "rejected",
        },
      });

      return NextResponse.json({
        success: true,
        action: "rejected",
        decision: updated,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process escalation" }, { status: 500 });
  }
}
