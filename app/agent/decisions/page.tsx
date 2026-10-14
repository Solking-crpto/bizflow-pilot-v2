export const dynamic = "force-dynamic";

import React from "react";
import type { Metadata } from "next";
import { prisma, withDbTimeout } from "@/lib/db";
import { getActiveNetwork } from "@/lib/networks";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { AgentDecisionsClient, DecisionRecord, DecisionMetrics } from "@/components/agent/AgentDecisionsClient";

export const metadata: Metadata = {
  title: "Agent Decisions & Escalations | BizFlow Pilot V2",
  description: "Immutable decision logs, real-time performance metrics, and human escalation queue.",
};

export default async function AgentDecisionsPage() {
  const network = getActiveNetwork();

  let decisions: any[] = [];
  let allDecisions: any[] = [];
  let confirmedPayments: any[] = [];

  try {
    decisions = await withDbTimeout(() =>
      prisma.agentDecision.findMany({
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

    allDecisions = await withDbTimeout(() =>
      prisma.agentDecision.findMany({
        include: { invoice: true },
      })
    );

    confirmedPayments = await withDbTimeout(() =>
      prisma.payment.findMany({
        where: { status: { in: ["confirmed", "anchored"] } },
        select: { amountAtomic: true },
      })
    );
  } catch (err) {
    console.warn("DB query fallback in AgentDecisionsPage:", err);
  }

  // Compute metrics from real rows
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

  const metrics: DecisionMetrics = {
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

  const serializedDecisions: DecisionRecord[] = decisions.map((d) => ({
    id: d.id,
    orgId: d.orgId,
    invoiceId: d.invoiceId,
    timestamp: d.timestamp.toISOString(),
    observationHash: d.observationHash,
    cashPosition: d.cashPosition,
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
    scheduledFor: d.scheduledFor ? d.scheduledFor.toISOString() : null,
    invoice: d.invoice
      ? {
          id: d.invoice.id,
          invoiceNumber: d.invoice.invoiceNumber,
          totalUsdc: d.invoice.totalUsdc.toString(),
          status: d.invoice.status,
          vendor: d.invoice.vendor
            ? {
                name: d.invoice.vendor.name,
                walletAddress: d.invoice.vendor.walletAddress,
              }
            : undefined,
        }
      : undefined,
  }));

  return (
    <AgentDecisionsClient
      initialDecisions={serializedDecisions}
      initialMetrics={metrics}
      explorerBaseUrl={network.explorerUrl}
    />
  );
}
