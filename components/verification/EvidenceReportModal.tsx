"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  FileText,
  Image as ImageIcon,
  Video,
  KeyRound,
  RotateCcw,
  Ban,
  CheckCircle,
  Clock,
  Loader2,
  ExternalLink,
  Sparkles,
  Info,
} from "lucide-react";
import { useNetwork } from "@/components/network/NetworkContext";
import { apiFetch } from "@/lib/apiFetch";

interface EvidenceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  onStatusChange?: () => void;
}

export function EvidenceReportModal({
  isOpen,
  onClose,
  requestId,
  onStatusChange,
}: EvidenceReportModalProps) {
  const { network } = useNetwork();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [newAccessCode, setNewAccessCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !requestId) return;
    loadRequest();
  }, [isOpen, requestId]);

  async function loadRequest() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/delivery-proof/${requestId}`, {
        headers: { "X-Bizflow-Network": network },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load delivery request details.");
      setData(json.deliveryRequest);
    } catch (err: any) {
      setError(err.message || "Failed to load verification details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(action: "approve" | "reject" | "request_more_evidence") {
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/delivery-proof/${requestId}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bizflow-Network": network,
        },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record decision.");
      await loadRequest();
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      alert(err.message || "Action failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevoke() {
    if (!confirm("Are you sure you want to revoke this delivery verification link? It will be immediately invalidated.")) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/delivery-proof/${requestId}/revoke`, {
        method: "POST",
        headers: { "X-Bizflow-Network": network },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to revoke link.");
      await loadRequest();
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      alert(err.message || "Revoke failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRegenerateCode() {
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/delivery-proof/${requestId}/regenerate-code`, {
        method: "POST",
        headers: { "X-Bizflow-Network": network },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to regenerate access code.");
      setNewAccessCode(json.accessCode);
      await loadRequest();
    } catch (err: any) {
      alert(err.message || "Failed to regenerate code.");
    } finally {
      setActionLoading(false);
    }
  }

  if (!isOpen) return null;

  const po = data?.purchaseOrder;
  const poItems = po?.lines || [];
  const submission = data?.submission;
  const receivedQtys = submission?.receivedQuantitiesJson
    ? JSON.parse(submission.receivedQuantitiesJson)
    : {};
  const report = data?.reports?.[0];
  const ruleResults = report?.resultsJson ? JSON.parse(report.resultsJson) : [];
  const aiResults = report?.aiResultsJson ? JSON.parse(report.aiResultsJson) : null;
  const files = data?.evidenceFiles || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-surface border border-border rounded-2xl max-w-4xl w-full my-8 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink">Delivery Proof & Condition Report</h2>
                <span className="text-xs font-mono uppercase px-2 py-0.5 rounded-full bg-surface-muted border border-border text-ink-muted">
                  Status: {data?.status || "Loading..."}
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                Challenge code: <span className="font-mono font-bold text-emerald-500">{data?.challengeCode}</span>
                {data?.verifierName ? ` • Verifier: ${data.verifierName}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-ink-muted">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              <p className="text-sm">Loading delivery evidence and verification report...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {error}
            </div>
          ) : (
            <>
              {/* New Access Code Alert if regenerated */}
              {newAccessCode && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center justify-between">
                  <div>
                    <strong>New Access Code Generated:</strong>{" "}
                    <span className="font-mono font-bold text-lg text-white ml-2 tracking-widest">
                      {newAccessCode}
                    </span>
                    <p className="text-xs text-emerald-400/80 mt-0.5">
                      Share this code with the field verifier. Any previous lockout has been reset.
                    </p>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(newAccessCode)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-xs font-medium transition"
                  >
                    Copy Code
                  </button>
                </div>
              )}

              {/* 3-Way Reconciliation Comparison: PO vs Verifier vs AI */}
              <div className="border border-border rounded-xl overflow-hidden bg-surface-muted/30">
                <div className="px-4 py-3 border-b border-border bg-surface-elevated flex items-center justify-between">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                    Item Reconciliation Matrix (PO vs Verifier vs AI)
                  </h3>
                  <span className="text-[11px] text-ink-muted">3-way delivery alignment</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/50 text-ink-muted bg-surface-muted/50">
                        <th className="p-3">Line Item</th>
                        <th className="p-3 text-right">PO Expected Qty</th>
                        <th className="p-3 text-right">Verifier Reported Qty</th>
                        <th className="p-3 text-right">AI Observed Qty</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {poItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-ink-muted">
                            No PO line items linked to this delivery request.
                          </td>
                        </tr>
                      ) : (
                        poItems.map((line: any, idx: number) => {
                          const desc = line.item?.description || line.description;
                          const expected = line.quantity;
                          const reported = receivedQtys[desc] ?? "-";
                          const isAiAssessed = Boolean(report?.aiUsed && aiResults);
                          const aiItem = isAiAssessed
                            ? aiResults?.itemsObserved?.find(
                                (i: any) =>
                                  i.description.toLowerCase().includes(desc.toLowerCase()) ||
                                  desc.toLowerCase().includes(i.description.toLowerCase())
                              )
                            : null;
                          const aiQty = isAiAssessed
                            ? (aiItem ? aiItem.estimatedQuantity : "-")
                            : "not evaluated";
                          const isMatch = reported !== "-" && Number(reported) >= Number(expected);

                          return (
                            <tr key={idx} className="hover:bg-surface-elevated/40 transition">
                              <td className="p-3 font-medium text-ink">{desc}</td>
                              <td className="p-3 text-right font-mono">{expected}</td>
                              <td className="p-3 text-right font-mono font-semibold text-brand-primary">
                                {reported}
                              </td>
                              <td className="p-3 text-right font-mono">
                                {isAiAssessed ? (
                                  <span className="text-emerald-400">{aiQty}</span>
                                ) : (
                                  <span className="text-ink-muted italic text-[11px]">not evaluated</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {isMatch ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                                    <CheckCircle className="w-3.5 h-3.5" /> Matched
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Check
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Conditions Engine Results Card */}
              {ruleResults.length > 0 && (
                <div className="border border-border rounded-xl p-4 bg-surface-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                      Conditions Engine Rule Results
                    </h3>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        report?.overall === "ready"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : report?.overall === "needs_review"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      Overall: {report?.overall || "Pending"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {ruleResults.map((r: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                          r.passed
                            ? "bg-emerald-500/5 border-emerald-500/20 text-ink"
                            : r.severity === "block"
                            ? "bg-rose-500/5 border-rose-500/20 text-rose-300"
                            : "bg-amber-500/5 border-amber-500/20 text-amber-300"
                        }`}
                      >
                        {r.passed ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : r.severity === "block" ? (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-semibold text-ink">{r.name}</div>
                          <div className="text-ink-muted mt-0.5">{r.reason}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Visual Assessment Card */}
              <div className="border border-border rounded-xl p-4 bg-surface-muted/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-ink uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    AI Evidence Assessment (Advisory Only)
                  </div>
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                      report?.aiUsed && aiResults
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}
                  >
                    {report?.aiUsed && aiResults ? "Assessed" : "AI not configured"}
                  </span>
                </div>

                {report?.aiUsed && aiResults ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-surface-elevated rounded-lg border border-border">
                        <div className="text-ink-muted">Extracted Challenge Code</div>
                        <div className="font-mono font-bold text-ink text-sm mt-0.5">
                          {aiResults.extractedChallengeCode || "None detected"}
                        </div>
                        <div className="text-[10px] text-ink-muted mt-1">
                          Confidence: {(aiResults.challengeCodeConfidence * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="p-3 bg-surface-elevated rounded-lg border border-border">
                        <div className="text-ink-muted">Overall Match Confidence</div>
                        <div className="font-bold text-emerald-400 text-sm mt-0.5">
                          {(aiResults.overallMatchConfidence * 100).toFixed(0)}%
                        </div>
                        <div className="text-[10px] text-ink-muted mt-1">
                          Packaging: {aiResults.packagingNotes || "Standard"}
                        </div>
                      </div>
                    </div>
                    {/* Disclaimer banner */}
                    <div className="p-2.5 rounded-lg bg-surface-muted border border-border text-[11px] text-ink-muted flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>{aiResults.disclaimer}</span>
                    </div>
                  </>
                ) : (
                  <div className="p-3.5 rounded-lg bg-surface-elevated border border-border/80 text-xs space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-400 font-medium">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>AI not configured</span>
                    </div>
                    <p className="text-ink-muted text-[11px] leading-relaxed">
                      No vision LLM API key (<code className="text-ink font-mono text-[10px]">GOOGLE_API_KEY</code>, <code className="text-ink font-mono text-[10px]">GEMINI_API_KEY</code>, or <code className="text-ink font-mono text-[10px]">ANTHROPIC_API_KEY</code>) is configured in the environment. Visual match and physical challenge code detection were <span className="font-semibold text-ink">not evaluated</span> by AI.
                    </p>
                    <p className="text-ink-muted text-[11px] leading-relaxed">
                      Please inspect the uploaded delivery evidence photos and documents manually in the gallery below.
                    </p>
                  </div>
                )}
              </div>

              {/* Evidence Files Gallery */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                    Evidence Files Gallery ({files.length} attached)
                  </h3>
                  <span className="text-[10px] text-ink-muted">
                    SHA-256 exact-match check (catches exact byte duplicates only; does not detect modified/re-photographed images)
                  </span>
                </div>
                {files.length === 0 ? (
                  <div className="p-6 text-center text-xs text-ink-muted border border-dashed border-border rounded-xl">
                    No evidence photos or documents submitted yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {files.map((file: any) => (
                      <div
                        key={file.id}
                        className="group relative rounded-xl border border-border bg-surface-muted overflow-hidden flex flex-col hover:border-brand-primary transition cursor-pointer"
                        onClick={() => file.downloadUrl && setPreviewUrl(file.downloadUrl)}
                      >
                        <div className="h-28 w-full bg-surface-elevated flex items-center justify-center overflow-hidden">
                          {file.mime.startsWith("image/") && file.downloadUrl ? (
                            <img
                              src={file.downloadUrl}
                              alt="Evidence"
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                          ) : file.mime.startsWith("video/") ? (
                            <Video className="w-8 h-8 text-ink-muted" />
                          ) : (
                            <FileText className="w-8 h-8 text-ink-muted" />
                          )}
                        </div>
                        <div className="p-2 text-[10px] text-ink-muted bg-surface-muted truncate">
                          <span className="font-semibold text-ink">{file.kind}</span> • {(file.size / 1024).toFixed(0)} KB
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-surface-elevated flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerateCode}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface transition flex items-center gap-1.5"
              title="Generate new 6-char access code and clear lockouts"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Regen Code
            </button>
            <button
              onClick={handleRevoke}
              disabled={actionLoading || data?.status === "revoked"}
              className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition flex items-center gap-1.5"
              title="Revoke and invalidate link"
            >
              <Ban className="w-3.5 h-3.5" />
              Revoke
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDecision("request_more_evidence")}
              disabled={actionLoading}
              className="px-3 py-2 rounded-xl border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/10 transition"
            >
              Request More Proof
            </button>
            <button
              onClick={() => handleDecision("reject")}
              disabled={actionLoading}
              className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold hover:bg-rose-500/20 transition"
            >
              Reject
            </button>
            <button
              onClick={() => handleDecision("approve")}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              Approve Delivery
            </button>
          </div>
        </div>
      </div>

      {/* Full Preview Modal for clicked image */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-surface rounded-xl overflow-hidden p-2">
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewUrl} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
