"use client";

import React, { useEffect, useState } from "react";
import { Building2, ChevronDown, Check, Plus } from "lucide-react";
import Link from "next/link";

interface OrgSummary {
  id: string;
  name: string;
  isPilot: boolean;
}

export function OrgSwitcher() {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read active org from document.cookie
    const match = document.cookie.match(/selected_org_id=([^;]+)/);
    const initialOrgId = match ? decodeURIComponent(match[1]) : "";

    fetch("/api/pilots")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const list: OrgSummary[] = data.data.map((o: any) => ({
            id: o.id,
            name: o.name,
            isPilot: o.isPilot,
          }));
          setOrgs(list);

          if (initialOrgId && list.some((o) => o.id === initialOrgId)) {
            setSelectedOrgId(initialOrgId);
          } else {
            setSelectedOrgId(list[0].id);
            document.cookie = `selected_org_id=${list[0].id}; path=/; max-age=31536000; SameSite=Lax`;
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelectOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    document.cookie = `selected_org_id=${orgId}; path=/; max-age=31536000; SameSite=Lax`;
    setIsOpen(false);
    // Reload page to re-scope all server queries
    window.location.reload();
  };

  const currentOrg = orgs.find((o) => o.id === selectedOrgId) || orgs[0];

  if (loading || orgs.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs text-ink-muted">
        <Building2 className="w-3.5 h-3.5 text-brand-teal" />
        <span className="truncate">Default Org</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface hover:bg-canvas border border-border text-xs font-medium text-ink transition-colors shadow-xs"
        aria-label="Switch organization"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
          <span className="truncate font-semibold">{currentOrg?.name || "Select Organization"}</span>
          {currentOrg?.isPilot && (
            <span className="text-[10px] bg-brand-light text-brand-teal px-1 py-0.2 rounded font-mono font-bold shrink-0">
              PILOT
            </span>
          )}
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-ink-muted shrink-0" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-lg bg-surface border border-border shadow-lg p-1.5 divide-y divide-border">
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
                Active Organization
              </div>
              {orgs.map((org) => {
                const isSelected = org.id === selectedOrgId;
                return (
                  <button
                    key={org.id}
                    onClick={() => handleSelectOrg(org.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-left transition-colors ${
                      isSelected
                        ? "bg-navy text-white font-semibold"
                        : "text-ink hover:bg-canvas"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{org.name}</span>
                      {org.isPilot && (
                        <span
                          className={`text-[9px] px-1 rounded font-mono ${
                            isSelected
                              ? "bg-brand-teal text-navy font-bold"
                              : "bg-brand-light text-brand-teal"
                          }`}
                        >
                          PILOT
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-1.5 mt-1.5">
              <Link
                href="/settings/pilots"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-brand-teal hover:bg-canvas font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Manage Pilot Businesses</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
