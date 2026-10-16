"use client";

import React, { useState } from "react";
import {
  Settings,
  ShieldAlert,
  Sliders,
  Users,
  Wallet,
  Lock,
  CheckCircle2,
  Save,
  AlertTriangle,
} from "lucide-react";
import { HashView } from "@/components/ui/StatusChip";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { apiFetch } from "@/lib/apiFetch";

export interface SerializedVendor {
  id: string;
  name: string;
  walletAddress: string;
  status: string;
  perVendorLimitUsdc: string;
}

export interface SerializedSettings {
  killSwitchActive: boolean;
  priceToleranceBps: number;
  requireApprovalAbove: string;
  minReserveUsdc: string;
  dailyLimitUsdc: string;
  agentMode?: string;
  autoApproveLimitUsdc?: string;
  maxDailyAutonomousUsdc?: string;
}

export function SettingsClient({
  initialSettings,
  vendors,
  treasuryPublicAddress,
}: {
  initialSettings: SerializedSettings;
  vendors: SerializedVendor[];
  treasuryPublicAddress: string;
}) {
  const [killSwitchActive, setKillSwitchActive] = useState(initialSettings.killSwitchActive);
  const [priceToleranceBps, setPriceToleranceBps] = useState(initialSettings.priceToleranceBps);
  const [requireApprovalAbove, setRequireApprovalAbove] = useState(
    (Number(BigInt(initialSettings.requireApprovalAbove)) / 1_000_000).toString()
  );
  const [minReserveUsdc, setMinReserveUsdc] = useState(
    (Number(BigInt(initialSettings.minReserveUsdc)) / 1_000_000).toString()
  );
  const [dailyLimitUsdc, setDailyLimitUsdc] = useState(
    (Number(BigInt(initialSettings.dailyLimitUsdc)) / 1_000_000).toString()
  );
  const [agentMode, setAgentMode] = useState<"assisted" | "autonomous">(
    (initialSettings.agentMode as "assisted" | "autonomous") || "assisted"
  );
  const [autoApproveLimitUsdc, setAutoApproveLimitUsdc] = useState(
    (Number(BigInt(initialSettings.autoApproveLimitUsdc || "500000")) / 1_000_000).toString()
  );
  const [maxDailyAutonomousUsdc, setMaxDailyAutonomousUsdc] = useState(
    (Number(BigInt(initialSettings.maxDailyAutonomousUsdc || "1000000")) / 1_000_000).toString()
  );

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [killSwitchPending, setKillSwitchPending] = useState(false);
  const [passcode, setPasscode] = useState("");

  const handleToggleKillSwitch = async () => {
    setKillSwitchPending(true);
    setErrorMessage(null);
    const nextState = !killSwitchActive;

    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ killSwitchActive: nextState, passcode: passcode.trim() || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to update emergency kill switch.");
      } else {
        setKillSwitchActive(nextState);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to contact settings API.");
    } finally {
      setKillSwitchPending(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceToleranceBps: Number(priceToleranceBps),
          requireApprovalAbove: (BigInt(Math.round(Number(requireApprovalAbove) * 1_000_000))).toString(),
          minReserveUsdc: (BigInt(Math.round(Number(minReserveUsdc) * 1_000_000))).toString(),
          dailyLimitUsdc: (BigInt(Math.round(Number(dailyLimitUsdc) * 1_000_000))).toString(),
          agentMode,
          autoApproveLimitUsdc: (BigInt(Math.round(Number(autoApproveLimitUsdc) * 1_000_000))).toString(),
          maxDailyAutonomousUsdc: (BigInt(Math.round(Number(maxDailyAutonomousUsdc) * 1_000_000))).toString(),
          killSwitchActive,
          passcode: passcode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to save settings.");
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <span>Rules & Wallet Settings</span>
          </h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Configure policy limits, corporate approval thresholds, approved vendors, and emergency halts.
          </p>
        </div>
        <div>
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving Changes..." : "Save Settings"}</span>
          </button>
        </div>
      </div>

      {/* Read-only / Visitor Notice */}
      <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
        <Lock className="w-4 h-4 text-navy shrink-0" />
        <span>
          <strong>Read-only for visitors.</strong> Modifying governance parameters or triggering the kill-switch requires the owner passcode on Arc Mainnet.
        </span>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-success-light border border-success-border text-xs text-success font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Policy settings updated and verified. Live guardrails are active.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-danger-light border border-danger-border text-xs text-danger font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Treasury & Emergency Controls (5 Columns) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Treasury Wallet Card */}
          <div className="rounded-xl border border-border bg-surface shadow-card p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Wallet className="w-4 h-4 text-navy" />
              <h2 className="text-sm font-semibold text-ink">Settlement Treasury Account</h2>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-ink-muted">Public EOA Address:</span>
                <HashView hash={treasuryPublicAddress} truncate={true} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ink-muted">Private Key Storage:</span>
                <span className="font-mono text-success font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Server Env Only (Never in LLM / Client)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ink-muted">Gas Asset:</span>
                <span className="font-mono text-ink">Native USDC</span>
              </div>
            </div>
          </div>

          {/* Emergency Kill Switch */}
          <div
            className={`rounded-xl border p-5 space-y-3 transition-colors ${
              killSwitchActive
                ? "border-danger bg-danger-light/30 shadow-card"
                : "border-border bg-surface shadow-card"
            }`}
          >
            <div className="flex items-center gap-2 border-b border-border pb-3 text-danger">
              <ShieldAlert className="w-4 h-4" />
              <h2 className="text-sm font-bold">Global Emergency Kill Switch</h2>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              Instantly pauses all automated and human settlements across the organization.
              Enforced server-side at the policy evaluation gate.
            </p>

            <div className="pt-2 flex items-center justify-between">
              <span
                className={`text-xs font-mono font-bold ${
                  killSwitchActive ? "text-danger" : "text-ink"
                }`}
              >
                Status: {killSwitchActive ? "ARMED (ALL PAYMENTS HALTED)" : "DISARMED (ACTIVE)"}
              </span>
              <button
                onClick={handleToggleKillSwitch}
                disabled={killSwitchPending}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all shadow-xs ${
                  killSwitchActive
                    ? "bg-danger hover:bg-danger/90 text-white"
                    : "bg-navy hover:bg-navy-light text-white"
                }`}
              >
                {killSwitchPending
                  ? "Updating..."
                  : killSwitchActive
                  ? "Disarm Kill Switch"
                  : "Engage Kill Switch"}
              </button>
            </div>
          </div>
        </div>

        {/* Policy Thresholds & Vendors (7 Columns) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Policy Parameters */}
          <form
            onSubmit={handleSaveSettings}
            className="rounded-xl border border-border bg-surface shadow-card p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-navy" />
                <h2 className="text-sm font-semibold text-ink">Deterministic Spending Parameters</h2>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1 rounded-md bg-canvas hover:bg-canvas-subtle border border-border text-xs font-semibold text-ink transition-colors flex items-center gap-1"
              >
                <Save className="w-3 h-3 text-brand-teal" />
                <span>Save</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-canvas border border-border space-y-1">
                <label className="text-ink-muted block font-medium">3-Way Match Price Tolerance</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={priceToleranceBps}
                    onChange={(e) => setPriceToleranceBps(Number(e.target.value))}
                    className="w-24 px-2 py-1 rounded border border-border bg-surface font-mono font-bold text-ink text-sm"
                  />
                  <span className="font-mono text-ink-muted">bps ({(priceToleranceBps / 100).toFixed(2)}%)</span>
                </div>
                <p className="text-[11px] text-ink-muted">Max acceptable variance between PO and Invoice unit price.</p>
              </div>

              <div className="p-3 rounded-lg bg-canvas border border-border space-y-1">
                <label className="text-ink-muted block font-medium">Human Approval Threshold (USDC)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={requireApprovalAbove}
                    onChange={(e) => setRequireApprovalAbove(e.target.value)}
                    className="w-32 px-2 py-1 rounded border border-border bg-surface font-mono font-bold text-ink text-sm"
                  />
                  <span className="font-mono text-ink-muted">USDC</span>
                </div>
                <p className="text-[11px] text-ink-muted">Invoices above this sum require explicit human sign-off.</p>
              </div>

              <div className="p-3 rounded-lg bg-canvas border border-border space-y-1">
                <label className="text-ink-muted block font-medium">Operating Reserve Floor (USDC)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={minReserveUsdc}
                    onChange={(e) => setMinReserveUsdc(e.target.value)}
                    className="w-32 px-2 py-1 rounded border border-border bg-surface font-mono font-bold text-ink text-sm"
                  />
                  <span className="font-mono text-ink-muted">USDC</span>
                </div>
                <p className="text-[11px] text-ink-muted">Minimum treasury balance preserved for ongoing payroll & ops.</p>
              </div>

              <div className="p-3 rounded-lg bg-canvas border border-border space-y-1">
                <label className="text-ink-muted block font-medium">Aggregate Daily Spending Cap (USDC)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={dailyLimitUsdc}
                    onChange={(e) => setDailyLimitUsdc(e.target.value)}
                    className="w-32 px-2 py-1 rounded border border-border bg-surface font-mono font-bold text-ink text-sm"
                  />
                  <span className="font-mono text-ink-muted">USDC</span>
                </div>
                <p className="text-[11px] text-ink-muted">Maximum cumulative settlements permitted per 24h rolling period.</p>
              </div>

              {/* Tameion V2 Autonomous Agency Controls */}
              <div className="p-4 rounded-lg bg-canvas-subtle border border-brand-teal/30 space-y-3 sm:col-span-2">
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-teal animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-navy">
                      Autonomous Agency Controls (Tameion Edition)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-light text-brand-teal font-semibold">
                    Tier 1 Agency
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Agent Mode */}
                  <div className="space-y-1">
                    <label className="text-ink-muted block font-medium">Agent Operating Mode</label>
                    <select
                      value={agentMode}
                      onChange={(e) => setAgentMode(e.target.value as "assisted" | "autonomous")}
                      className="w-full px-2 py-1.5 rounded border border-border bg-surface font-semibold text-ink text-xs focus:ring-1 focus:ring-brand-teal"
                    >
                      <option value="assisted">Assisted (Propose Only)</option>
                      <option value="autonomous">Autonomous (Auto-Execute)</option>
                    </select>
                    <p className="text-[10px] text-ink-muted">
                      {agentMode === "autonomous"
                        ? "Autonomous: Auto-settles invoices within budget caps."
                        : "Assisted: Proposes settlements; human must authorize."}
                    </p>
                  </div>

                  {/* Auto Approve Limit */}
                  <div className="space-y-1">
                    <label className="text-ink-muted block font-medium">Auto-Approve Limit (USDC)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={autoApproveLimitUsdc}
                        onChange={(e) => setAutoApproveLimitUsdc(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-border bg-surface font-mono font-bold text-ink text-xs"
                      />
                      <span className="font-mono text-ink-muted text-xs">USDC</span>
                    </div>
                    <p className="text-[10px] text-ink-muted">Single invoice limit for autonomous execution (Default: 0.50 USDC).</p>
                  </div>

                  {/* Max Daily Autonomous Volume */}
                  <div className="space-y-1">
                    <label className="text-ink-muted block font-medium">Daily Autonomous Cap</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={maxDailyAutonomousUsdc}
                        onChange={(e) => setMaxDailyAutonomousUsdc(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-border bg-surface font-mono font-bold text-ink text-xs"
                      />
                      <span className="font-mono text-ink-muted text-xs">USDC</span>
                    </div>
                    <p className="text-[10px] text-ink-muted">Max 24h autonomous volume before auto-escalating to human (Default: 1.00 USDC).</p>
                  </div>
                </div>
              </div>

              {/* Owner Passcode field for Mainnet */}
              <div className="p-3 rounded-lg bg-canvas border border-border space-y-1 sm:col-span-2">
                <label className="text-ink-muted block font-medium flex items-center justify-between">
                  <span>Owner Passcode</span>
                  <span className="text-[11px] font-mono text-danger font-medium">Required on Arc Mainnet</span>
                </label>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Enter OWNER_PASSCODE"
                  className="w-full max-w-sm px-3 py-1.5 rounded border border-border bg-surface font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
                <p className="text-[11px] text-ink-muted">Required on Arc Mainnet to authorize policy changes or toggle the emergency kill switch.</p>
              </div>
            </div>
          </form>

          {/* Approved Vendors List */}
          <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <div className="px-5 py-3.5 bg-canvas border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-navy" />
                <h2 className="text-sm font-semibold text-ink">Authorized Beneficiaries & Whitelisted Wallets</h2>
              </div>
              <span className="text-xs font-mono text-ink-muted">{vendors.length} Vendors</span>
            </div>

            <div className="divide-y divide-border">
              {vendors.map((vendor) => (
                <div key={vendor.id} className="p-4 hover:bg-canvas/40 transition-colors flex items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{vendor.name}</span>
                      <span className="text-[10px] bg-success-light text-success border border-success-border px-1.5 py-0.2 rounded font-semibold uppercase">
                        {vendor.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-ink-muted font-medium">Authorized Wallet:</span>
                      <HashView hash={vendor.walletAddress} truncate={true} />
                    </div>
                  </div>

                  <div className="text-right whitespace-nowrap">
                    <span className="text-ink-muted block text-[11px]">Vendor Limit:</span>
                    <span className="font-mono font-bold text-ink">
                      {formatUsdc(usdcAtomic(BigInt(vendor.perVendorLimitUsdc)))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
