"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Check,
  ExternalLink,
  ArrowRight,
  Filter,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { EmptyState } from "@/components/ui/EmptyState";

export interface FormattedNotification {
  id: string;
  type: string;
  payload: any;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export function NotificationsClient({
  initialNotifications,
  orgName,
}: {
  initialNotifications: FormattedNotification[];
  orgName: string;
}) {
  const [notifications, setNotifications] = useState<FormattedNotification[]>(initialNotifications);
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "proofs" | "security">("all");
  const [isMarking, setIsMarking] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllRead = async () => {
    setIsMarking(true);
    try {
      const res = await apiFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      }
    } catch {
      // Non-fatal
    } finally {
      setIsMarking(false);
    }
  };

  const markSingleRead = async (id: string) => {
    try {
      const res = await apiFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [id] }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
        );
      }
    } catch {
      // Non-fatal
    }
  };

  const filtered = notifications.filter((n) => {
    if (activeFilter === "unread") return !n.isRead;
    if (activeFilter === "proofs") return n.type.includes("delivery") || n.type.includes("proof");
    if (activeFilter === "security") return n.type.includes("lock") || n.type.includes("fail") || n.type.includes("override");
    return true;
  });

  const renderIcon = (type: string) => {
    switch (type) {
      case "delivery_proof_submitted":
        return <ShieldCheck className="w-5 h-5 text-brand-teal shrink-0" />;
      case "link_locked":
        return <AlertTriangle className="w-5 h-5 text-danger shrink-0" />;
      default:
        return <Clock className="w-5 h-5 text-navy shrink-0" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">In-App Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-brand-light text-brand-teal text-xs font-bold font-mono">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Real-time procurement alerts, field delivery submissions, condition assessments, and security lockouts for{" "}
            <strong>{orgName}</strong>.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={isMarking}
            className="px-3.5 py-1.5 rounded-lg border border-border bg-white text-xs font-semibold text-navy hover:text-brand-teal hover:bg-canvas transition-all shadow-xs flex items-center gap-1.5 shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeFilter === "all" ? "bg-navy text-white font-bold" : "text-ink-muted hover:bg-canvas"
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setActiveFilter("unread")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeFilter === "unread" ? "bg-navy text-white font-bold" : "text-ink-muted hover:bg-canvas"
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setActiveFilter("proofs")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeFilter === "proofs" ? "bg-navy text-white font-bold" : "text-ink-muted hover:bg-canvas"
          }`}
        >
          Delivery Proofs
        </button>
        <button
          onClick={() => setActiveFilter("security")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeFilter === "security" ? "bg-navy text-white font-bold" : "text-ink-muted hover:bg-canvas"
          }`}
        >
          Security & Lockouts
        </button>
      </div>

      {/* Notifications List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={activeFilter === "unread" ? "No Unread Notifications" : "No Notifications Found"}
          description={
            activeFilter === "unread"
              ? "You are all caught up! Verification submissions and lockout alerts will appear here."
              : "No notification events match this filter."
          }
          action={{
            label: "Review Invoices",
            href: "/invoices",
          }}
          secondaryAction={{
            label: "Open Payment Desk",
            href: "/payments",
          }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const p = item.payload;
            return (
              <div
                key={item.id}
                onClick={() => !item.isRead && markSingleRead(item.id)}
                className={`p-4 rounded-xl border transition-all ${
                  item.isRead
                    ? "bg-surface border-border opacity-85 hover:opacity-100"
                    : "bg-brand-light/20 border-brand-teal/30 shadow-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-canvas border border-border mt-0.5">
                      {renderIcon(item.type)}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-ink capitalize">
                          {item.type.replace(/_/g, " ")}
                        </span>
                        {!item.isRead && (
                          <span className="px-1.5 py-0.2 rounded-full bg-brand-teal text-white text-[9px] font-bold uppercase tracking-wider">
                            New
                          </span>
                        )}
                        <span className="text-[10px] text-ink-muted font-mono">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {item.type === "delivery_proof_submitted" ? (
                        <p className="text-xs text-ink leading-relaxed">
                          Field verifier <strong>{p.verifierName || "Staff"}</strong> submitted{" "}
                          <strong>{p.filesCount || 1} evidence file(s)</strong> for order{" "}
                          <strong>{p.poNumber || "PO"}</strong>. Condition assessment evaluated as{" "}
                          <span
                            className={`font-bold font-mono px-1 rounded ${
                              p.overall === "ready"
                                ? "bg-success-light text-success"
                                : p.overall === "needs_review"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-danger-light text-danger"
                            }`}
                          >
                            {p.overall?.toUpperCase() || "SUBMITTED"}
                          </span>
                          .
                        </p>
                      ) : item.type === "link_locked" ? (
                        <p className="text-xs text-danger leading-relaxed">
                          Delivery verification link was locked due to 5 consecutive failed access code attempts.
                          Lockout expires at {new Date(p.lockedUntil).toLocaleTimeString()}.
                        </p>
                      ) : (
                        <p className="text-xs text-ink leading-relaxed">
                          {p.reason || p.text || JSON.stringify(p)}
                        </p>
                      )}

                      <div className="pt-2 flex items-center gap-4 text-xs font-semibold">
                        <Link
                          href="/invoices"
                          className="text-navy hover:text-brand-teal flex items-center gap-1 transition-colors"
                        >
                          <span>Inspect on Invoice Desk</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                        <Link
                          href="/payments"
                          className="text-ink-muted hover:text-ink flex items-center gap-1 transition-colors"
                        >
                          <span>Payment Desk</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markSingleRead(item.id);
                      }}
                      className="text-[11px] text-ink-muted hover:text-brand-teal p-1 shrink-0"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
