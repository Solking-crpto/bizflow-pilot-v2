"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Lock,
  Globe,
  Plus,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Users,
  Briefcase,
  AlertCircle,
  Layers,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

export function PilotBusinessesClient() {
  const [passcode, setPasscode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Org Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [newX, setNewX] = useState("");
  const [newLinkedin, setNewLinkedin] = useState("");
  const [newIsPilot, setNewIsPilot] = useState(true);
  const [newPublicConsent, setNewPublicConsent] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showCreateModal) {
        setShowCreateModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCreateModal]);

  const loadOrganizations = async (adminPasscode?: string) => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (adminPasscode) {
        headers["x-owner-passcode"] = adminPasscode;
      }
      const res = await apiFetch(`/api/pilots?all=true`, { headers });
      const data = await res.json();
      if (data.success) {
        setOrgs(data.data || []);
        if (data.isAdminView) {
          setIsAuthenticated(true);
          setAuthError("");
        }
      }
    } catch {
      // Ignore network errors on initial public fetch
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  const handleUnlockAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) {
      setAuthError("Owner passcode is required to manage pilot businesses.");
      return;
    }
    setAuthError("");
    setLoading(true);

    try {
      const res = await apiFetch(`/api/pilots?all=true`, {
        headers: { "x-owner-passcode": passcode },
      });
      const data = await res.json();
      if (data.isAdminView) {
        setIsAuthenticated(true);
        setOrgs(data.data || []);
      } else {
        setAuthError(data.error || "Incorrect owner passcode.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to authenticate.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setCreateError("Business name is required.");
      return;
    }

    setCreateSubmitting(true);
    setCreateError("");
    try {
      const res = await apiFetch("/api/pilots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passcode,
          name: newName.trim(),
          websiteUrl: newWebsite.trim() || undefined,
          xUrl: newX.trim() || undefined,
          linkedinUrl: newLinkedin.trim() || undefined,
          isPilot: newIsPilot,
          publicConsent: newPublicConsent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Organization "${newName}" added successfully.`);
        setShowCreateModal(false);
        setNewName("");
        setNewWebsite("");
        setNewX("");
        setNewLinkedin("");
        loadOrganizations(passcode);
        setTimeout(() => setSuccessMsg(""), 5000);
      } else {
        setCreateError(data.error || "Failed to create organization.");
      }
    } catch (err: any) {
      setCreateError(err.message || "Network error occurred.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleToggleConsent = async (orgId: string, currentConsent: boolean) => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch("/api/pilots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passcode,
          orgId,
          publicConsent: !currentConsent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadOrganizations(passcode);
      }
    } catch {}
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Pilot Businesses Admin</h1>
            <span className="text-xs bg-navy text-white px-2 py-0.5 rounded font-mono font-medium">
              Owner Passcode Protected
            </span>
          </div>
          <p className="text-sm text-ink-muted mt-1">
            Manage multi-tenant pilot organizations, verifiable proof links, and public directory consent.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/pilots"
            className="px-3.5 py-1.5 rounded-md bg-canvas hover:bg-canvas-subtle border border-border text-ink text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5 text-brand-teal" />
            <span>View Public /pilots Directory</span>
          </Link>
          {isAuthenticated && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-1.5 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-brand-teal" />
              <span>Add Pilot Business</span>
            </button>
          )}
        </div>
      </div>

      {/* Custody and Builder-Operated Treasury Disclosure */}
      <div className="rounded-xl border border-border bg-brand-light/30 p-4 text-xs text-navy space-y-1">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="w-4 h-4 text-brand-teal shrink-0" />
          <span>Builder-Operated Treasury, Funded by the Business</span>
        </div>
        <p className="text-ink-muted pl-6 leading-relaxed">
          BizFlow Pilot V2 settles payments via a single builder-managed server treasury funded by participating businesses.
          No third-party private keys or external custody credentials are stored. All inbound invoices are reconciled deterministically
          against corporate budgets before verifiable settlement.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Passcode Unlock Gate */}
      {!isAuthenticated ? (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card max-w-md mx-auto text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-navy/5 mx-auto flex items-center justify-center text-navy">
            <Lock className="w-6 h-6 text-brand-teal" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink">Unlock Pilot Businesses Management</h2>
            <p className="text-xs text-ink-muted mt-1">
              Enter the owner passcode to access administrative controls, add pilot businesses, and manage directory consent.
            </p>
          </div>

          <form onSubmit={handleUnlockAdmin} className="space-y-3">
            <input
              type="password"
              placeholder="Enter OWNER_PASSCODE"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-canvas text-xs font-mono text-ink focus:outline-none focus:ring-1 focus:ring-brand-teal"
            />
            {authError && (
              <div className="text-xs text-danger text-left flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg bg-navy hover:bg-navy-light text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Unlock Management"}
            </button>
          </form>
        </div>
      ) : (
        /* Organizations Management Grid */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-medium text-ink-muted px-1">
            <span>Configured Organizations ({orgs.length})</span>
            <span className="font-mono text-brand-teal">Authenticated as Owner</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orgs.map((org) => (
              <div
                key={org.id}
                className="rounded-xl border border-border bg-surface p-5 shadow-card space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-ink truncate">{org.name}</h3>
                      <div className="text-[11px] text-ink-muted font-mono mt-0.5">ID: {org.id}</div>
                    </div>
                    {org.isPilot && (
                      <span className="text-[10px] bg-brand-light text-brand-teal border border-brand-teal/30 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
                        PILOT
                      </span>
                    )}
                  </div>

                  {/* Proof Links */}
                  <div className="pt-2.5 space-y-1 text-xs">
                    <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Proof Links:</div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {org.websiteUrl ? (
                        <a
                          href={org.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-teal hover:underline flex items-center gap-0.5 font-medium"
                        >
                          <Globe className="w-3 h-3" />
                          <span>Website</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-ink-muted">No website</span>
                      )}
                      {org.xUrl && (
                        <a
                          href={org.xUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-teal hover:underline flex items-center gap-0.5 font-medium"
                        >
                          <span>X/Twitter</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {org.linkedinUrl && (
                        <a
                          href={org.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-teal hover:underline flex items-center gap-0.5 font-medium"
                        >
                          <span>LinkedIn</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Real Org Metrics */}
                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-canvas p-2 rounded">
                      <div className="text-[10px] text-ink-muted">Invoices</div>
                      <div className="font-bold text-ink font-mono">{org.metrics?.invoicesCount ?? 0}</div>
                    </div>
                    <div className="bg-canvas p-2 rounded">
                      <div className="text-[10px] text-ink-muted">Volume</div>
                      <div className="font-bold text-ink font-mono">{org.metrics?.paymentVolumeFormatted ?? "0.00 USDC"}</div>
                    </div>
                  </div>
                </div>

                {/* Consent Toggle & Status */}
                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted">
                    Directory: {org.publicConsent ? "Public (/pilots)" : "Private"}
                  </span>
                  <button
                    onClick={() => handleToggleConsent(org.id, org.publicConsent)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                      org.publicConsent
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                        : "bg-canvas text-ink-muted hover:bg-canvas-subtle border border-border"
                    }`}
                  >
                    {org.publicConsent ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Consented</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-ink-muted" />
                        <span>Private</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-surface border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-base text-ink flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-teal" />
                <span>Add Pilot Business</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-ink-muted hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-ink block mb-1">Company / Organization Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Global Logistics Ltd"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-canvas text-ink focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Official Website URL</label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-canvas text-ink focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-ink block mb-1">X (Twitter) Profile</label>
                  <input
                    type="url"
                    placeholder="https://x.com/company"
                    value={newX}
                    onChange={(e) => setNewX(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-canvas text-ink focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  />
                </div>
                <div>
                  <label className="font-semibold text-ink block mb-1">LinkedIn Profile</label>
                  <input
                    type="url"
                    placeholder="https://linkedin.com/company/..."
                    value={newLinkedin}
                    onChange={(e) => setNewLinkedin(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-canvas text-ink focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-2 border-t border-border">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={newIsPilot}
                    onChange={(e) => setNewIsPilot(e.target.checked)}
                    className="rounded text-brand-teal focus:ring-brand-teal"
                  />
                  <span>Designate as Pilot Enterprise (eligible for Tameion AP pilot metrics)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={newPublicConsent}
                    onChange={(e) => setNewPublicConsent(e.target.checked)}
                    className="rounded text-brand-teal focus:ring-brand-teal"
                  />
                  <span>Public Directory Consent (Publish verifiable proof on /pilots page)</span>
                </label>
              </div>

              {createError && (
                <div className="p-2 bg-danger-light text-danger rounded border border-danger-border flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-border bg-canvas text-ink hover:bg-canvas-subtle transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-navy hover:bg-navy-light text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {createSubmitting ? "Creating..." : "Save Organization"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
