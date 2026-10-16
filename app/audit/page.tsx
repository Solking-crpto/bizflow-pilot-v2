import React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork } from "@/lib/networks";
import { getServerSession, getSessionOrg } from "@/lib/auth/session";
import { AuditLedgerClient } from "@/components/audit/AuditLedgerClient";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileCheck2, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Trust & Audit Ledger — Cryptographic Hash Chain | BizFlow Pilot V2",
  description: "Tamper-evident SHA-256 hash chains linking procurement, AI reasoning, policy approval, and Arc settlement.",
};

export default async function AuditLedgerPage() {
  const cookieStore = cookies();
  const networkMode = getServerActiveNetwork(cookieStore.get("bizflow_network")?.value);
  const session = await getServerSession();

  if (!session || !session.address) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Trust & Audit Ledger</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Tamper-evident activity log cryptographically linked via SHA-256 parent hashes.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Wallet}
          title="Connect your wallet to begin"
          description="Connect your Web3 wallet to inspect your organization's cryptographic audit ledger and verify tamper-evident hash chains."
          action={{
            label: "Explore Live RPC Verification",
            href: "/verify",
          }}
          secondaryAction={{
            label: "Judge Guide",
            href: "/judges",
          }}
        />
      </div>
    );
  }

  const db = getDb(networkMode);
  let org: any = null;
  let dbError: string | null = null;

  try {
    org = await getSessionOrg(session, networkMode);
    if (org) {
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
