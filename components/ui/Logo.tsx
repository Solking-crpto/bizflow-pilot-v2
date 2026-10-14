import React from "react";

export function Logo({ className = "w-8 h-8", textClassName = "text-lg" }: { className?: string; textClassName?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`relative flex items-center justify-center rounded-lg bg-navy shadow-sm overflow-hidden p-1.5 ${className}`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-brand-teal w-full h-full transform -rotate-12 translate-x-0.5"
        >
          {/* Paper-plane / Pilot motif */}
          <path d="M22 2L11 13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" fill="rgba(14, 159, 142, 0.25)" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className={`font-semibold tracking-tight text-ink leading-tight flex items-center gap-1.5 ${textClassName}`}>
          BizFlow <span className="text-brand-teal font-bold">Pilot V2</span>
        </span>
        <span className="text-[10px] uppercase font-mono tracking-wider text-ink-muted">
          Autonomous Settlement
        </span>
      </div>
    </div>
  );
}
