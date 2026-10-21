import React from "react";
import { ShieldCheck, Clock, AlertTriangle, XCircle, MinusCircle } from "lucide-react";

export type DeliveryProofBadgeStatus =
  | "off"
  | "pending"
  | "needs_review"
  | "verified"
  | "approved"
  | "rejected"
  | "revoked";

interface DeliveryProofBadgeProps {
  status?: string | null;
  mode?: string | null;
  className?: string;
  onClick?: () => void;
}

export function DeliveryProofBadge({
  status,
  mode,
  className = "",
  onClick,
}: DeliveryProofBadgeProps) {
  // If delivery proof mode is explicitly off
  if (mode === "off" || (!status && !mode)) {
    return (
      <span
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-muted text-ink-muted border border-border cursor-pointer hover:bg-surface-elevated transition ${className}`}
        title="Delivery proof is not required for this invoice"
      >
        <MinusCircle className="w-3.5 h-3.5" />
        Delivery Proof: Off
      </span>
    );
  }

  const s = (status || "").toLowerCase();

  if (s === "approved" || s === "verified") {
    return (
      <span
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition ${className}`}
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        Delivery Verified
      </span>
    );
  }

  if (s === "needs_review" || s === "more_evidence_required") {
    return (
      <span
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition ${className}`}
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        Delivery Proof: Review Needed
      </span>
    );
  }

  if (s === "rejected") {
    return (
      <span
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20 cursor-pointer hover:bg-rose-500/20 transition ${className}`}
      >
        <XCircle className="w-3.5 h-3.5" />
        Delivery Proof Rejected
      </span>
    );
  }

  // Pending
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition ${className}`}
    >
      <Clock className="w-3.5 h-3.5" />
      Awaiting Delivery Proof
    </span>
  );
}
