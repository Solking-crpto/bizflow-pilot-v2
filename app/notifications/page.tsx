import React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork } from "@/lib/networks";
import { getServerSession, getSessionOrg } from "@/lib/auth/session";
import { NotificationsClient, FormattedNotification } from "@/components/notifications/NotificationsClient";
import { DatabaseErrorState } from "@/components/common/DatabaseErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bell, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "In-App Notifications — Procurement & Delivery Proofs | BizFlow Pilot V2",
  description: "Real-time alerts for delivery submissions, condition assessments, and access lockouts.",
};

export default async function NotificationsPage() {
  const cookieStore = cookies();
  const networkMode = getServerActiveNetwork(cookieStore.get("bizflow_network")?.value);
  const session = await getServerSession();

  if (!session || !session.address) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">In-App Notifications</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Real-time delivery verification alerts and policy condition updates.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Wallet}
          title="Connect your wallet to view notifications"
          description="Connect your Web3 wallet to access your organization's real-time alerts, field verifications, and security events."
          action={{
            label: "Review Invoices",
            href: "/invoices",
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
  let notifications: FormattedNotification[] = [];
  let orgName = "Your Organization";
  let dbError: string | null = null;

  try {
    const org = await getSessionOrg(session, networkMode);
    if (org) {
      orgName = org.name;
      const rawNotifications = await withDbTimeout(
        () =>
          db.notification.findMany({
            where: { orgId: org.id },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        30000
      );

      notifications = rawNotifications.map((n) => {
        let parsedPayload: any = {};
        try {
          parsedPayload = JSON.parse(n.payloadJson);
        } catch {
          parsedPayload = { text: n.payloadJson };
        }

        return {
          id: n.id,
          type: n.type,
          payload: parsedPayload,
          isRead: !!n.readAt,
          readAt: n.readAt?.toISOString() || null,
          createdAt: n.createdAt.toISOString(),
        };
      });
    }
  } catch (err: any) {
    dbError = err.message || "Could not retrieve notifications from the database.";
  }

  if (dbError) {
    return (
      <DatabaseErrorState
        title="Notifications Database Error"
        message="Could not load notifications from the database. Please ensure your database is accessible and retry."
      />
    );
  }

  return <NotificationsClient initialNotifications={notifications} orgName={orgName} />;
}
