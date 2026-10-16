"use client";

import React, { useState } from "react";
import { SlidersHorizontal, ShieldCheck, AlertOctagon, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { evaluatePolicy, PolicyContext } from "@/lib/policy/engine";
import { parseUsdc, formatUsdc, usdcAtomic } from "@/lib/money";

interface SeededInvoiceOption {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  amountAtomic: string;
  wallet: string;
  matchStatus: string;
  duplicateScore: number;
  isInjectionSuspect: boolean;
}

export function PolicySimulatorClient({
  invoices,
  defaultNetwork,
}: {
  invoices: SeededInvoiceOption[];
  defaultNetwork: "testnet" | "mainnet";
}) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(invoices[0]?.id || "");
  const [customAmount, setCustomAmount] = useState("1700.00");
  const [customWallet, setCustomWallet] = useState("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  const [vendorStatus, setVendorStatus] = useState("active");
  const [matchStatus, setMatchStatus] = useState("exact_match");
  const [duplicateScore, setDuplicateScore] = useState(0);
  const [isInjectionSuspect, setIsInjectionSuspect] = useState(false);
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const [network, setNetwork] = useState<"testnet" | "mainnet">(defaultNetwork);

  const selectedInv = invoices.find((i) => i.id === selectedInvoiceId);

  const handleSelectInvoice = (id: string) => {
    setSelectedInvoiceId(id);
    const inv = invoices.find((i) => i.id === id);
    if (inv) {
      const parsed = formatUsdc(usdcAtomic(BigInt(inv.amountAtomic)), false);
      setCustomAmount(parsed);
      setCustomWallet(inv.wallet);
      setMatchStatus(inv.matchStatus);
      setDuplicateScore(inv.duplicateScore);
      setIsInjectionSuspect(inv.isInjectionSuspect);
    }
  };

  // Run policy evaluation live in client
  let amountAtomic = parseUsdc("1700.00");
  try {
    amountAtomic = parseUsdc(customAmount);
  } catch (err) {
    // Keep last valid
  }

  const context: PolicyContext = {
    network,
    killSwitchActive,
    availableTreasuryUsdc: parseUsdc("100000.00"),
    minReserveUsdc: parseUsdc("2000.00"),
    dailySpentUsdc: parseUsdc("1000.00"),
    dailyLimitUsdc: parseUsdc("20000.00"),
    approvalThresholdUsdc: parseUsdc("5000.00"),
    maxMainnetPaymentUsdc: parseUsdc("1.00"),
    hasOwnerConfirmation: true,

    vendor: {
      id: "vendor-sim",
      name: selectedInv?.vendorName || "Verified Equipment & Logistics Supplier",
      status: vendorStatus,
      recordedWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      perVendorLimitUsdc: parseUsdc("15000.00"),
      walletCooldownUntil: null,
    },

    invoice: {
      id: selectedInv?.id || "sim-inv",
      invoiceNumber: selectedInv?.invoiceNumber || "SIM-INV-01",
      totalUsdc: amountAtomic,
      remittanceWallet: customWallet,
      matchStatus,
      duplicateScore,
      isInjectionSuspect,
      hasExistingPaymentForNetwork: false,
      isHumanApproved: false,
    },
  };

  const evaluation = evaluatePolicy(context);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <span>Policy Simulator</span>
            <span className="text-xs font-mono font-medium bg-canvas text-navy px-2 py-0.5 rounded-full border border-border">
              Sandbox
            </span>
          </h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Test "what-if" policy outcomes by tweaking parameters in real-time with zero side-effects.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Controls */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-surface shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-brand-teal" />
              <span>Simulation Parameters</span>
            </h2>
          </div>

          {/* Quick Preset Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-muted">Load Scenario Preset</label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => handleSelectInvoice(e.target.value)}
              className="w-full text-xs font-mono rounded-md border border-border bg-canvas px-3 py-2 text-ink focus:outline-none focus:border-navy"
            >
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} — {inv.vendorName}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Tweak */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-ink-muted">Invoice Amount (USDC)</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setCustomAmount("1700.00")}
                  className="text-[10px] bg-canvas hover:bg-canvas-subtle px-1.5 py-0.5 rounded border border-border font-mono"
                >
                  Agreed ($1.7k)
                </button>
                <button
                  onClick={() => setCustomAmount("6000.00")}
                  className="text-[10px] bg-canvas hover:bg-canvas-subtle px-1.5 py-0.5 rounded border border-border font-mono text-warning"
                >
                  Above Cap ($6k)
                </button>
                <button
                  onClick={() => setCustomAmount("1.00")}
                  className="text-[10px] bg-canvas hover:bg-canvas-subtle px-1.5 py-0.5 rounded border border-border font-mono text-brand-teal"
                >
                  Mainnet ($1)
                </button>
              </div>
            </div>
            <input
              type="text"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full text-xs font-mono font-bold rounded-md border border-border bg-canvas px-3 py-2 text-ink focus:outline-none focus:border-navy"
            />
          </div>

          {/* Remittance Wallet */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-ink-muted">Remittance Destination Wallet</label>
              <button
                onClick={() => setCustomWallet("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC")}
                className="text-[10px] text-danger hover:underline font-mono"
              >
                Tamper Wallet
              </button>
            </div>
            <input
              type="text"
              value={customWallet}
              onChange={(e) => setCustomWallet(e.target.value)}
              className="w-full text-xs font-mono rounded-md border border-border bg-canvas px-3 py-2 text-ink focus:outline-none focus:border-navy"
            />
          </div>

          {/* Network Selection */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs font-medium text-ink-muted">Simulate Network</label>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value as any)}
                className="w-full text-xs font-mono rounded-md border border-border bg-canvas px-3 py-1.5 text-ink focus:outline-none focus:border-navy mt-1"
              >
                <option value="testnet">Arc Testnet (5042002)</option>
                <option value="mainnet">Arc Mainnet (5042)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-muted">Vendor Status</label>
              <select
                value={vendorStatus}
                onChange={(e) => setVendorStatus(e.target.value)}
                className="w-full text-xs rounded-md border border-border bg-canvas px-3 py-1.5 text-ink focus:outline-none focus:border-navy mt-1"
              >
                <option value="active">Active & Approved</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Threat & Anomaly Toggles */}
          <div className="pt-3 border-t border-border space-y-2 text-xs">
            <label className="flex items-center justify-between cursor-pointer p-2 rounded bg-canvas hover:bg-canvas-subtle">
              <span className="text-ink font-medium">Global Kill Switch Armed</span>
              <input
                type="checkbox"
                checked={killSwitchActive}
                onChange={(e) => setKillSwitchActive(e.target.checked)}
                className="rounded text-danger focus:ring-danger"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-2 rounded bg-canvas hover:bg-canvas-subtle">
              <span className="text-ink font-medium">Prompt-Injection Attack Payload</span>
              <input
                type="checkbox"
                checked={isInjectionSuspect}
                onChange={(e) => setIsInjectionSuspect(e.target.checked)}
                className="rounded text-danger focus:ring-danger"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-2 rounded bg-canvas hover:bg-canvas-subtle">
              <span className="text-ink font-medium">Duplicate Risk Score (95%)</span>
              <input
                type="checkbox"
                checked={duplicateScore >= 90}
                onChange={(e) => setDuplicateScore(e.target.checked ? 95 : 0)}
                className="rounded text-warning focus:ring-warning"
              />
            </label>
          </div>
        </div>

        {/* Right Column: Live Policy Evaluation Results */}
        <div className="lg:col-span-7 space-y-4">
          {/* Decision Outcome Banner */}
          <div
            className={`p-5 rounded-xl border flex items-center justify-between shadow-card ${
              evaluation.decision === "approve"
                ? "bg-emerald-50 border-emerald-300"
                : evaluation.decision === "block"
                ? "bg-red-50 border-red-300"
                : "bg-amber-50 border-amber-300"
            }`}
          >
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Engine Decision Outcome
              </div>
              <div className="text-2xl font-bold font-mono text-ink uppercase mt-0.5 flex items-center gap-2">
                {evaluation.decision === "approve" && <CheckCircle2 className="w-6 h-6 text-success" />}
                {evaluation.decision === "block" && <XCircle className="w-6 h-6 text-danger" />}
                {evaluation.decision === "review" && <AlertTriangle className="w-6 h-6 text-warning" />}
                <span>{evaluation.decision}</span>
              </div>
              <p className="text-xs text-ink-muted mt-1 max-w-md">{evaluation.summary}</p>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-xs font-medium text-ink-muted">Decision Hash</span>
              <div className="text-xs font-mono font-bold text-ink mt-0.5">
                {evaluation.decisionHash.slice(0, 10)}…{evaluation.decisionHash.slice(-8)}
              </div>
            </div>
          </div>

          {/* Rule-by-Rule Breakdown */}
          <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <div className="px-5 py-3.5 bg-canvas border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-ink uppercase tracking-wider">
                10-Rule Deterministic Evaluation
              </span>
              <span className="text-xs font-mono text-ink-muted">
                Passed: {evaluation.results.filter((r) => r.passed).length}/10
              </span>
            </div>

            <div className="divide-y divide-border">
              {evaluation.results.map((rule) => (
                <div key={rule.ruleCode} className="p-4 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{rule.ruleName}</span>
                      <span className="font-mono text-[10px] text-ink-muted bg-canvas px-1 py-0.2 rounded border">
                        {rule.ruleCode}
                      </span>
                    </div>
                    <p className="text-ink-muted leading-relaxed">{rule.reason}</p>
                  </div>

                  <div className="shrink-0">
                    {rule.passed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-light text-success border border-success-border font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                          rule.severity === "block"
                            ? "bg-danger-light text-danger border border-danger-border"
                            : "bg-warning-light text-warning border border-warning-border"
                        }`}
                      >
                        {rule.severity === "block" ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        {rule.severity === "block" ? "Blocked" : "Review"}
                      </span>
                    )}
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
