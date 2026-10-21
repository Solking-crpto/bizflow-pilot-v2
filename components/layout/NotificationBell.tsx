"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, Check, ShieldCheck, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useWallet } from "@/components/auth/WalletContext";

interface NotificationItem {
  id: string;
  type: string;
  payload: any;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const { isAuthenticated } = useWallet();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
        setNotifications((data.notifications || []).slice(0, 5));
      }
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const markAllRead = async () => {
    try {
      const res = await apiFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch {
      // Non-fatal
    }
  };

  if (!isAuthenticated) return null;

  const renderIcon = (type: string) => {
    switch (type) {
      case "delivery_proof_submitted":
        return <ShieldCheck className="w-3.5 h-3.5 text-brand-teal shrink-0" />;
      case "link_locked":
        return <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-navy shrink-0" />;
    }
  };

  const renderText = (item: NotificationItem) => {
    const p = item.payload;
    switch (item.type) {
      case "delivery_proof_submitted":
        return `Delivery proof submitted by ${p.verifierName || "verifier"} (${p.filesCount || 1} file${p.filesCount === 1 ? "" : "s"}). Status: ${p.overall?.toUpperCase() || "SUBMITTED"}.`;
      case "link_locked":
        return `Security alert: Link #${p.requestId?.slice(0, 8) || "..."} locked for 30m after 5 failed access attempts.`;
      default:
        return p.reason || p.text || item.type.replace(/_/g, " ");
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-canvas transition-colors focus:outline-none"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-teal text-white text-[10px] font-bold flex items-center justify-center shadow-xs animate-fade-in">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-surface shadow-2xl z-50 overflow-hidden animate-fade-in">
          <div className="p-3 bg-canvas/70 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-ink">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-brand-light text-brand-teal font-semibold">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-medium text-brand-teal hover:underline flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-muted">
                No notifications yet.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 text-xs flex items-start gap-2.5 transition-colors ${
                    item.isRead ? "bg-surface opacity-80" : "bg-brand-light/20 font-medium"
                  }`}
                >
                  <div className="mt-0.5">{renderIcon(item.type)}</div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="text-ink leading-relaxed break-words">{renderText(item)}</p>
                    <p className="text-[10px] text-ink-muted font-mono">
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {!item.isRead && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-teal shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>

          <div className="p-2.5 bg-canvas/40 border-t border-border flex items-center justify-between text-xs">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-navy hover:text-brand-teal font-semibold text-xs flex items-center gap-1"
            >
              <span>View all notifications</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
