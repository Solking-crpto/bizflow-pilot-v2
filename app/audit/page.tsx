import React from "react";
import type { Metadata } from "next";
import { prisma, withDbTimeout } from "@/lib/db";
import { AuditLedgerClient } from "@/components/audit/AuditLedgerClient";
import { DEMO_AUDIT_EVENTS, DEMO_ORG } from "@/lib/demoData";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trust & Audit Ledger — Cryptographic Hash Chain | BizFlow Pilot V2",
  description: "Tamper-evident SHA-256 hash chains linking procurement, AI reasoning, policy approval, and Arc settlement.",
};

export default async function AuditLedgerPage() {
  const isMainnet = (process.env.NEXT_PUBLIC_NETWORK_MODE || process.env.NETWORK_MODE) === "mainnet";
  let org: any = null;
  let dbError: string | null = null;

  try {
    org = await withDbTimeout(
      () =>
        prisma.organization.findFirst({
          include: {
            auditEvents: { orderBy: { timestamp: "asc" } },
          },
        })
    );
  } catch (err: any) {
    if (isMainnet) {
      dbError = err.message || "Failed to load audit ledger from database.";
    } else {
      org = null;
    }
  }

  if (isMainnet && (dbError || !org)) {
    return (
      <DatabaseErrorState
        title="Audit Ledger Database Error"
        message={dbError || "No organization audit ledger records found on Arc Mainnet."}
      />
    );
  }

  const orgName = org?.name || (isMainnet ? "BizFlow Mainnet" : DEMO_ORG.name);
  const events =
    org && org.auditEvents?.length > 0
      ? org.auditEvents.map((ev: any) => ({
          id: ev.id,
          eventType: ev.eventType,
          referenceId: ev.referenceId,
          eventData: ev.eventData,
          prevHash: ev.prevHash,
          eventHash: ev.eventHash,
          timestamp: ev.timestamp.toISOString(),
        }))
      : isMainnet
      ? []
      : DEMO_AUDIT_EVENTS;

  return <AuditLedgerClient events={events} orgName={orgName} />;
}
