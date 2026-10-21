"use client";

import React, { useState } from "react";
import { AlertCircle, RefreshCw, Database } from "lucide-react";
import { useRouter } from "next/navigation";

export function DatabaseErrorState({
  title = "Database Connection Error",
  message = "Failed to load live records from the database. On Arc Mainnet, fallback demo data is strictly disabled to prevent displaying inaccurate information.",
}: {
  title?: string;
  message?: string;
}) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = () => {
    setRetrying(true);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface border border-red-200 rounded-2xl p-8 text-center shadow-card">
        <div className="w-14 h-14 rounded-2xl bg-danger-light border border-danger-border text-danger flex items-center justify-center mx-auto mb-5">
          <Database className="w-7 h-7" />
        </div>

        <h2 className="text-lg font-bold text-ink mb-2">{title}</h2>

        <p className="text-xs text-ink-muted mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-navy hover:bg-navy-light disabled:opacity-50 text-white text-xs font-semibold transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
            <span>{retrying ? "Retrying..." : "Retry Connection"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
