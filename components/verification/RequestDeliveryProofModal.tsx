"use client";

import React, { useState } from "react";
import {
  X,
  ShieldAlert,
  Copy,
  Check,
  Share2,
  Mail,
  ExternalLink,
  QrCode,
  FileCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useNetwork } from "@/components/network/NetworkContext";
import { apiFetch } from "@/lib/apiFetch";

interface RequestDeliveryProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrderId?: string;
  poNumber?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  defaultVerifierName?: string;
  defaultVerifierContact?: string;
  onSuccess?: (requestId: string) => void;
}

interface CreatedProofResult {
  requestId: string;
  token: string;
  accessCode: string;
  challengeCode: string;
  shareUrl: string;
  waLink: string;
  mailtoLink: string;
  expiresAt: string;
}

export function RequestDeliveryProofModal({
  isOpen,
  onClose,
  purchaseOrderId,
  poNumber,
  invoiceId,
  invoiceNumber,
  defaultVerifierName = "",
  defaultVerifierContact = "",
  onSuccess,
}: RequestDeliveryProofModalProps) {
  const { network } = useNetwork();
  const [verifierName, setVerifierName] = useState(defaultVerifierName);
  const [verifierContact, setVerifierContact] = useState(defaultVerifierContact);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedProofResult | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedChallenge, setCopiedChallenge] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/delivery-proof/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bizflow-Network": network,
        },
        body: JSON.stringify({
          purchaseOrderId: purchaseOrderId || undefined,
          invoiceId: invoiceId || undefined,
          verifierName: verifierName.trim() || undefined,
          verifierContact: verifierContact.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create delivery verification request.");
      }

      setResult(data);
      if (onSuccess) {
        onSuccess(data.requestId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate verification request.");
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string, type: "code" | "challenge" | "link") {
    navigator.clipboard.writeText(text);
    if (type === "code") {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else if (type === "challenge") {
      setCopiedChallenge(true);
      setTimeout(() => setCopiedChallenge(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">Request Delivery Proof</h2>
              <p className="text-xs text-ink-muted">
                {poNumber ? `Purchase Order ${poNumber}` : invoiceNumber ? `Invoice ${invoiceNumber}` : "Goods receipt verification"}
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

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!result ? (
            /* Creation Form */
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
                  Verifier Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Warehouse Receiver, Driver, Site Manager"
                  value={verifierName}
                  onChange={(e) => setVerifierName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-sm text-ink focus:outline-none focus:border-brand-primary transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
                  Verifier Phone / WhatsApp or Email
                </label>
                <input
                  type="text"
                  placeholder="e.g. +1 555 0199 or receiver@supplier.com"
                  value={verifierContact}
                  onChange={(e) => setVerifierContact(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-sm text-ink focus:outline-none focus:border-brand-primary transition"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-surface-muted border border-border text-xs text-ink-muted space-y-1.5">
                <p className="font-medium text-ink">How verification works:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Generates an isolated, single-use mobile portal for the field verifier.</li>
                  <li>Verifier enters the 6-character access code to unlock the portal.</li>
                  <li>Verifier writes the 4-character challenge code on physical paper next to goods in photo/video.</li>
                  <li>Photos are uploaded directly to private storage and assessed against PO items.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50 transition flex items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Generate Secure Link
                </button>
              </div>
            </form>
          ) : (
            /* Creation Success Details */
            <div className="space-y-5">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Single reveal:</strong> The raw access code is shown only once now. Copy or share it before closing.
                </span>
              </div>

              {/* Codes Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* 6-Char Access Code */}
                <div className="p-4 rounded-xl bg-surface-muted border border-border">
                  <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
                    6-Character Access Code
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-mono font-bold tracking-widest text-brand-primary">
                      {result.accessCode}
                    </span>
                    <button
                      onClick={() => copyToClipboard(result.accessCode, "code")}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition"
                      title="Copy access code"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 4-Char Challenge Code */}
                <div className="p-4 rounded-xl bg-surface-muted border border-border">
                  <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
                    Physical Challenge Code
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-mono font-bold tracking-widest text-emerald-500">
                      {result.challengeCode}
                    </span>
                    <button
                      onClick={() => copyToClipboard(result.challengeCode, "challenge")}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition"
                      title="Copy challenge code"
                    >
                      {copiedChallenge ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-xs text-ink-muted bg-surface-muted/50 p-2.5 rounded-lg border border-border/50">
                💡 <strong>Instructions for receiver:</strong> Write code <code>{result.challengeCode}</code> on a piece of paper and place it next to the delivered items when taking photos.
              </div>

              {/* Share actions */}
              <div className="space-y-2">
                <a
                  href={result.waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/30 flex items-center justify-center gap-2 transition"
                >
                  <Share2 className="w-4 h-4" />
                  Share via WhatsApp
                </a>

                <a
                  href={result.mailtoLink}
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-surface-muted text-ink hover:bg-surface-elevated border border-border flex items-center justify-center gap-2 transition"
                >
                  <Mail className="w-4 h-4" />
                  Send Email Draft
                </a>

                <button
                  onClick={() => copyToClipboard(result.shareUrl, "link")}
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-medium bg-surface-muted text-ink hover:bg-surface-elevated border border-border flex items-center justify-center gap-2 transition"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? "Link Copied!" : "Copy Direct Portal Link"}
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 transition"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
