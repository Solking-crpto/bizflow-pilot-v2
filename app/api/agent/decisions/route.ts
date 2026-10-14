export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbTimeout } from "@/lib/db";
import { verifyOwnerPasscodeWithRateLimit, getClientIp } from "@/lib/security/auth";
import { executePaymentTransaction } from "@/lib/payments/executor";
import { formatUsdc, usdcAtomic } from "@/lib/money";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const filterChoice = searchParams.get("choice");
    const filterEscalated = searchParams.get("escalated");
    const filterOutcome = searchParams.get("outcome");

    const whereClause: any = {};
    if (filterChoice) whereClause.choice = filterChoice;
    if (filterEscalated === "true") whereClause.escalated = true;
    if (filterEscalated === "false") whereClause.escalated = false;
    if (filterOutcome) whereClause.outcome = filterOutcome;

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

    // Compute honest metrics strictly from real rows
    const allDecisions = await withDbTimeout(() =>
      prisma.agentDecision.findMany({
        include: {
          invoice: true,
        },
      })
    );

    const confirmedPayments = await withDbTimeout(() =>
      prisma.payment.findMany({
        where: { status: { in: ["confirmed", "anchored"] } },
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

    // Human agreement rate on escalations: approved / total reviewed
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

    const metrics = {
      invoicesProcessed: uniqueInvoices.size > 0 ? uniqueInvoices.size.toString() : "n/a",
      paymentVolumeUsdc:
        confirmedPayments.length > 0
          ? `${formatUsdc(usdcAtomic(totalVolumeAtomic))} USDC`
          : "n/a",
      duplicatesCaught: duplicatesBlocked > 0 ? duplicatesBlocked.toString() : "0",
      injectionAttemptsBlocked: injectionsBlocked > 0 ? injectionsBlocked.toString() : "0",
      decisionsMade: allDecisions.length > 0 ? allDecisions.length.toString() : "n/a",
      autoExecuted: autoExecuted > 0 ? autoExecuted.toString() : allDecisions.length > 0 ? "0" : "n/a",
      escalated: escalated > 0 ? escalated.toString() : allDecisions.length > 0 ? "0" : "n/a",
      humanAgreementRate,
    };

    return NextResponse.json({
      decisions,
      metrics,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load agent decisions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json();
    const { decisionId, action, passcode } = body;

    if (!decisionId || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject' with decisionId." },
        { status: 400 }
      );
    }

    // Require owner passcode to act on escalation
    const authCheck = verifyOwnerPasscodeWithRateLimit(passcode, clientIp);
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

    const decision = await prisma.agentDecision.findUnique({
      where: { id: decisionId },
      include: { invoice: true },
    });

    if (!decision) {
      return NextResponse.json({ error: "Decision not found" }, { status: 404 });
    }

    if (action === "approve") {
      // Execute payment safely through the server-side executor
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
