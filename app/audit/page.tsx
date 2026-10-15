import React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork } from "@/lib/networks";
import { getServerSession, getSessionOrg } from "@/lib/auth/session";
import { AuditLedgerClient } from "@/components/audit/AuditLedgerClient";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Trust & Audit Ledger — Cryptographic Hash Chain | BizFlow Pilot V2",
  description: "Tamper-evident SHA-256 hash chains linking procurement, AI reasoning, policy approval, and Arc settlement.",
};

export default async function AuditLedgerPage() {
  const cookieStore = cookies();
  const networkMode = getServerActiveNetwork(cookieStore.get("bizflow_network")?.value);
  const db = getDb(networkMode);
  const session = await getServerSession();

  let org: any = null;
  let dbError: string | null = null;

  try {
    if (session) {
      org = await getSessionOrg(session, networkMode);
    }
    if (!org) {
      org = await withDbTimeout(
        () =>
          db.organization.findFirst({
            include: {
              auditEvents: { orderBy: { timestamp: "asc" } },
            },
          })
      );
    } else {
      // Load audit events for the session org
      const auditEvents = await withDbTimeout(() =>
        db.auditEvent.findMany({
          where: { orgId: org.id },
          orderBy: { timestamp: "asc" },
        })
      );
      org = { ...org, auditEvents };
    }
  } catch (err: any) {
    dbError = err.message || "Failed to load audit ledger from database.";
  }

  if (dbError) {
    return (
      <DatabaseErrorState
        title="Audit Ledger Database Error"
        message={dbError}
      />
    );
  }

  const orgName = org?.name || "Corporate Treasury Ledger";
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
      : [];

  return <AuditLedgerClient events={events} orgName={orgName} />;
}
