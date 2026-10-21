"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  Check,
  Copy,
} from "lucide-react";
import { StatusChip, HashView } from "@/components/ui/StatusChip";
import { truncateHash } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { useWallet } from "@/components/auth/WalletContext";
import { NonCustodialPaymentModal } from "./NonCustodialPaymentModal";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiFetch";
import { ZeroBalanceNotice } from "@/components/common/ZeroBalanceNotice";

export interface PayableInvoiceItem {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  vendorWallet: string;
  amountFormatted: string;
  amountAtomic: string;
  status: string;
  matchStatus: string;
  duplicateScore: number;
  isInjectionSuspect: boolean;
  policyDecision: "approve" | "review" | "block";
  policySummary: string;
  deliveryProofMode?: string;
  deliveryStatus?: string | null;
  paymentRecord?: {
    id: string;
    txHash?: string | null;
    anchorTxHash?: string | null;
    status: string;
    confirmedAt?: string | null;
  } | null;
}

import { DeliveryProofBadge } from "@/components/verification/DeliveryProofBadge";

export function PaymentDeskClient({
  items,
  networkMode,
  explorerUrl,
  maxMainnetPayment,
  isDryRun = false,
  isPublicSandbox = false,
}: {
  items: PayableInvoiceItem[];
  networkMode: "testnet" | "mainnet";
  explorerUrl: string;
  maxMainnetPayment: string;
  isDryRun?: boolean;
  isPublicSandbox?: boolean;
}) {
  const router = useRouter();
  const { isAdmin } = useWallet();
  const [selectedId, setSelectedId] = useState<string>(items[0]?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMainnetModalOpen, setIsMainnetModalOpen] = useState(false);
  const [isNonCustodialModalOpen, setIsNonCustodialModalOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selected = items.find((i) => i.id === selectedId) || items[0];

  const handleExecutePayment = async (hasOwnerConfirmation = false) => {
    if (!selected) return;

    if (networkMode === "mainnet" && !hasOwnerConfirmation) {
      setIsMainnetModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setPasscodeError(null);
    setExecutionResult(null);

    try {
      const res = await apiFetch("/api/payments/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: selected.id,
          hasOwnerConfirmation: true,
          passcode: passcode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setPasscodeError(data.error || "Invalid owner passcode");
        } else {
          setErrorMsg(data.error || data.summary || "Payment failed");
        }
      } else {
        setExecutionResult(data.payment);
        setIsMainnetModalOpen(false);
        setPasscode("");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to execute payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMainnetModalOpen) {
        setIsMainnetModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMainnetModalOpen]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <span>Payment Desk</span>
            <span className="text-xs font-mono font-medium bg-canvas text-navy px-2 py-0.5 rounded-full border border-border">
              Idempotent Settlement
            </span>
          </h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Executes policy-approved USDC settlements on Arc with on-chain audit anchoring.
          </p>
        </div>
        {isDryRun && (
          <div className="flex items-center">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>DRY RUN: no transactions are sent</span>
            </span>
          </div>
        )}
      </div>

      <ZeroBalanceNotice />

      {/* Non-Custodial Architecture Notice */}
      <div className="p-3 rounded-lg bg-surface border border-border text-xs text-ink flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand-teal shrink-0" />
          <span>
            <strong>Non-Custodial Architecture.</strong> Settlements execute directly from your connected EVM wallet on Arc. BizFlow never requests, receives, or holds your private keys.
          </span>
        </div>
        <span className="text-[10px] bg-canvas text-ink-muted border border-border px-1.5 py-0.5 rounded font-mono shrink-0">
          non-custodial
        </span>
      </div>

      {/* Sandbox Banner vs Visitor Passcode Notice */}
      {isPublicSandbox ? (
        <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Sandbox: test USDC only.</strong> Visitors can test execution without a passcode. Rate-limited with a 0.05 USDC sandbox settlement cap via Circle Wallets.
            </span>
          </div>
          <span className="text-[10px] bg-amber-500/20 text-amber-800 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold shrink-0">
            PUBLIC_SANDBOX
          </span>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
          <Lock className="w-4 h-4 text-navy shrink-0" />
          <span>
            <strong>Read-only for visitors.</strong> Payments require the owner passcode. Reviewers can freely inspect the verified matching records, AI decision trails, and on-chain settlement proofs without any login.
          </span>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No Payments in Settlement Queue"
          description="Invoices verified and approved by the 10-rule corporate policy engine appear here for non-custodial settlement signed by your connected wallet."
          action={{
            label: "Review Invoices",
            href: "/invoices",
          }}
          secondaryAction={{
            label: "Configure Policy Rules",
            href: "/settings",
          }}
        />
      ) : (
        /* Main Split: Queue on Left, Payment Drawer on Right */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Payable Queue */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="px-4 py-3 bg-canvas border-b border-border text-xs font-semibold text-ink-muted uppercase tracking-wider flex items-center justify-between">
            <span>Settlement Queue</span>
            <span>{items.length} Items</span>
          </div>

          <div className="divide-y divide-border">
            {items.map((item) => {
              const isSelected = item.id === selectedId;
              const isPaid = item.status === "paid" || !!item.paymentRecord;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    setExecutionResult(null);
                    setErrorMsg(null);
                  }}
                  className={`p-4 cursor-pointer transition-all ${
                    isSelected ? "bg-brand-light/40 border-l-4 border-l-brand-teal" : "hover:bg-canvas/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-ink">{item.invoiceNumber}</span>
                    <span className="font-mono text-xs font-bold text-ink tabular-nums">{item.amountFormatted}</span>
                  </div>

                  <div className="mt-1 text-xs text-ink-muted">{item.vendorName}</div>

                  <div className="mt-2.5 flex items-center justify-between flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success-light border border-success-border px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Settled on Arc
                        </span>
                      ) : item.policyDecision === "approve" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-teal bg-brand-light border border-brand-teal/30 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3 h-3" /> Policy Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-danger bg-danger-light border border-danger-border px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> Policy Blocked
                        </span>
                      )}
                      <DeliveryProofBadge mode={item.deliveryProofMode} status={item.deliveryStatus} />
                    </div>

                    <span className="text-[11px] font-mono text-ink-muted">
                      {truncateHash(item.vendorWallet)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Payment Detail & Action Panel */}
        <div className="lg:col-span-7 space-y-4">
          {selected ? (
            <div className="rounded-xl border border-border bg-surface shadow-card p-6 space-y-5">
              {/* Payment Heading */}
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-navy text-white">
                    <CreditCard className="w-5 h-5 text-brand-teal" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ink">Settlement Proposal</h2>
                    <span className="font-mono text-xs text-ink-muted">{selected.invoiceNumber}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-mono font-bold text-ink tabular-nums">{selected.amountFormatted}</div>
                  <span className="text-[11px] text-ink-muted uppercase font-mono">Asset: USDC</span>
                </div>
              </div>

              {/* Settlement Parameters */}
              <div className="space-y-2.5 p-4 rounded-lg bg-canvas border border-border text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted">Beneficiary:</span>
                  <span className="font-semibold text-ink">{selected.vendorName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted">Destination Address:</span>
                  <HashView hash={selected.vendorWallet} truncate={false} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted">Network Target:</span>
                  <span className="font-mono font-bold text-navy uppercase">
                    {networkMode} ({networkMode === "mainnet" ? "5042" : "5042002"})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted">Settlement Engine:</span>
                  <span className="font-mono text-brand-teal font-semibold">DirectEvmProvider / Viem</span>
                </div>
              </div>

              {/* Policy Engine Gate Status */}
              <div
                className={`p-4 rounded-lg border text-xs ${
                  selected.policyDecision === "approve"
                    ? "bg-emerald-50/70 border-emerald-200 text-ink"
                    : "bg-red-50/70 border-red-200 text-danger"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {selected.policyDecision === "approve" ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-danger" />
                  )}
                  <span>Policy Gate Evaluation: {selected.policyDecision.toUpperCase()}</span>
                </div>
                <p className="mt-1 text-ink-muted leading-relaxed">{selected.policySummary}</p>
              </div>

              {/* Delivery Proof Gate Status */}
              <div className="p-3.5 rounded-lg border border-border bg-surface-muted/40 text-xs flex items-center justify-between">
                <div>
                  <div className="font-semibold text-ink">Field Delivery Verification</div>
                  <div className="text-ink-muted text-[11px] mt-0.5">
                    {selected.deliveryProofMode === "required"
                      ? "Mandatory physical proof required before payout"
                      : "Optional delivery proof verification"}
                  </div>
                </div>
                <DeliveryProofBadge mode={selected.deliveryProofMode} status={selected.deliveryStatus} />
              </div>

              {/* Error Message if any */}
              {errorMsg && (
                <div className="p-3.5 rounded-lg bg-danger-light border border-danger-border text-xs text-danger font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Completed Settlement / Receipt Box */}
              {(executionResult || selected.paymentRecord) && (
                <div className="p-4 rounded-xl border border-success-border bg-success-light/40 space-y-3 text-xs">
                  <div className="flex items-center gap-2 text-success font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Payment Confirmed & Anchored on Arc</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-ink-muted font-medium">Arc Transfer Tx:</span>
                      <HashView
                        hash={executionResult?.txHash || selected.paymentRecord?.txHash}
                        explorerUrl={`${explorerUrl}/tx/${executionResult?.txHash || selected.paymentRecord?.txHash}`}
                        truncate={false}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-ink-muted font-medium">AuditAnchor Contract Tx:</span>
                      <HashView
                        hash={executionResult?.anchorTxHash || selected.paymentRecord?.anchorTxHash}
                        explorerUrl={`${explorerUrl}/tx/${executionResult?.anchorTxHash || selected.paymentRecord?.anchorTxHash}`}
                        truncate={false}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-success-border/60 flex justify-between items-center">
                    <span className="text-[11px] text-ink-muted">Public Proof Passport:</span>
                    <Link
                      href={`/verify/${executionResult?.id || selected.paymentRecord?.id || selected.id}`}
                      className="px-2.5 py-1 rounded bg-white border border-border text-xs font-semibold text-navy hover:text-brand-teal transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <span>Open Verified Passport</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-ink-muted font-mono">
                  Idempotency: PAY-{selected.id}-{networkMode}
                </span>

                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      onClick={() => handleExecutePayment(false)}
                      disabled={
                        isSubmitting ||
                        selected.policyDecision === "block" ||
                        selected.status === "paid" ||
                        !!selected.paymentRecord
                      }
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-border text-ink hover:bg-canvas disabled:opacity-50 transition-all shadow-xs"
                      title="Builder-operated admin treasury route"
                    >
                      <span>Server Treasury</span>
                    </button>
                  )}

                  {(() => {
                    const isBlockedByDelivery =
                      selected.policyDecision === "block" &&
                      selected.deliveryProofMode === "required" &&
                      selected.deliveryStatus !== "approved";

                    return (
                      <button
                        onClick={() => setIsNonCustodialModalOpen(true)}
                        disabled={
                          selected.status === "paid" ||
                          !!selected.paymentRecord ||
                          (selected.policyDecision === "block" && !isBlockedByDelivery)
                        }
                        className={`px-5 py-2.5 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-2 transition-all ${
                          selected.status === "paid" || selected.paymentRecord
                            ? "bg-canvas text-ink-muted cursor-not-allowed border border-border"
                            : selected.policyDecision === "block" && !isBlockedByDelivery
                            ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                            : isBlockedByDelivery
                            ? "bg-amber-600 text-white hover:bg-amber-700 shadow-card"
                            : "bg-navy text-white hover:bg-navy-light shadow-card"
                        }`}
                      >
                        <CreditCard className="w-4 h-4 text-brand-teal" />
                        <span>
                          {selected.status === "paid" || selected.paymentRecord
                            ? "Already Settled"
                            : isBlockedByDelivery
                            ? `Override Delivery & Pay`
                            : selected.policyDecision === "block"
                            ? "Settlement Blocked"
                            : `Pay ${selected.amountFormatted} with Wallet`}
                        </span>
                      </button>
                    );
                  })()}
                </div>
              </div>

              <NonCustodialPaymentModal
                isOpen={isNonCustodialModalOpen}
                invoiceId={selected.id}
                onClose={() => {
                  setIsNonCustodialModalOpen(false);
                  router.refresh();
                }}
                onSuccess={(payment) => {
                  setExecutionResult(payment);
                  router.refresh();
                }}
              />
            </div>
          ) : (
            <div className="p-8 text-center text-ink-muted border rounded-xl bg-surface">
              Select an invoice from the settlement queue.
            </div>
          )}
        </div>
      </div>
      )}

      {/* Mainnet Safety Confirmation Modal */}
      {isMainnetModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-xl bg-surface border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-warning border-b border-border pb-3">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <h3 className="text-sm font-bold text-ink">Arc Mainnet Settlement Confirmation</h3>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              You are about to execute a real USDC payment on <strong>Arc Mainnet (Chain ID 5042)</strong>.
              All transfers are permanent and irreversible.
            </p>

            <div className="p-3.5 rounded-lg bg-canvas border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-muted">Network:</span>
                <span className="font-mono font-bold text-navy">Arc Mainnet (5042)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Settlement Amount:</span>
                <span className="font-mono font-bold text-ink tabular-nums">{selected.amountFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Safety Cap:</span>
                <span className="font-mono text-ink">{maxMainnetPayment} USDC max</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Beneficiary:</span>
                <span className="font-semibold text-ink">{selected.vendorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Destination:</span>
                <span className="font-mono text-ink text-[11px]">{truncateHash(selected.vendorWallet)}</span>
              </div>
            </div>

            {isDryRun && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>Simulation Active: Parameters will be validated via Arc RPC, but zero funds will be broadcast.</span>
              </div>
            )}

            {/* Owner Passcode Input (Required on Arc Mainnet) */}
            <div className="space-y-1.5 text-left pt-1">
              <label className="text-xs font-semibold text-ink flex items-center justify-between">
                <span>Owner Passcode</span>
                <span className="text-[11px] font-mono text-danger font-medium">Required for Mainnet</span>
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setPasscodeError(null);
                }}
                placeholder="Enter OWNER_PASSCODE"
                className="w-full px-3 py-2 rounded-lg border border-border bg-canvas font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand-teal"
              />
              {passcodeError && (
                <p className="text-xs text-danger font-semibold mt-1">{passcodeError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsMainnetModalOpen(false)}
                className="px-3.5 py-2 rounded-md bg-canvas hover:bg-canvas-subtle border border-border text-xs font-semibold text-ink"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExecutePayment(true)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light flex items-center gap-1.5 shadow-xs"
              >
                <Lock className="w-3.5 h-3.5 text-brand-teal" />
                <span>Confirm & Authorize Settlement</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
