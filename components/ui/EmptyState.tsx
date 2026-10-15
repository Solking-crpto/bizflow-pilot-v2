import React from "react";
import Link from "next/link";
import { LucideIcon, ArrowRight, Plus } from "lucide-react";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  badge,
  action,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  const ActionIcon = action?.icon || Plus;

  return (
    <div
      className={`rounded-2xl border border-dashed border-border bg-surface p-8 sm:p-12 text-center flex flex-col items-center justify-center max-w-xl mx-auto ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-canvas border border-border flex items-center justify-center text-navy shadow-xs mb-4">
        <Icon className="w-7 h-7 text-brand-teal" />
      </div>

      {badge && (
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-teal bg-brand-light px-2.5 py-0.5 rounded-full mb-2">
          {badge}
        </span>
      )}

      <h3 className="text-lg font-bold text-ink tracking-tight mb-1.5">{title}</h3>
      <p className="text-xs sm:text-sm text-ink-muted leading-relaxed max-w-md mb-6">
        {description}
      </p>

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action &&
            (action.href ? (
              <Link
                href={action.href}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-xs"
              >
                <ActionIcon className="w-4 h-4" />
                <span>{action.label}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-xs"
              >
                <ActionIcon className="w-4 h-4" />
                <span>{action.label}</span>
              </button>
            ))}

          {secondaryAction &&
            (secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-canvas text-ink hover:bg-surface text-xs font-medium transition-colors"
              >
                <span>{secondaryAction.label}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-canvas text-ink hover:bg-surface text-xs font-medium transition-colors"
              >
                <span>{secondaryAction.label}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
