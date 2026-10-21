"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import {
  ShieldCheck,
  Camera,
  Upload,
  CheckCircle2,
  Lock,
  AlertTriangle,
  FileText,
  Video,
  X,
  Loader2,
  ChevronRight,
  Info,
  Calendar,
  Package,
} from "lucide-react";

interface OrderItem {
  id: string;
  description: string;
  quantity: number;
}

interface OrderSummary {
  vendorName: string;
  poNumber: string;
  items: OrderItem[];
}

interface UploadedFileState {
  id: string;
  name: string;
  size: number;
  kind: string;
  progress: number;
  previewUrl?: string;
}

export default function MobileVerifierPortalPage() {
  const params = useParams();
  const rawToken = typeof params.token === "string" ? params.token : "";

  // Step state: "loading" | "access_code" | "verification" | "submitted"
  const [step, setStep] = useState<"loading" | "access_code" | "verification" | "submitted">("loading");
  const [accessCode, setAccessCode] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number>(5);
  const [countdown, setCountdown] = useState<string>("");

  // Portal data
  const [challengeCode, setChallengeCode] = useState("");
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [submissionReceipt, setSubmissionReceipt] = useState<any>(null);

  // Form inputs
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});
  const [itemConditions, setItemConditions] = useState<Record<string, string>>({});
  const [verifierName, setVerifierName] = useState("");
  const [verifierContact, setVerifierContact] = useState("");
  const [notes, setNotes] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);

  // Files
  const [files, setFiles] = useState<UploadedFileState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rawToken) return;
    checkPortalStatus();
  }, [rawToken]);

  // Lockout countdown timer
  useEffect(() => {
    if (!isLocked || !lockedUntil) return;

    const interval = setInterval(() => {
      const diff = new Date(lockedUntil).getTime() - Date.now();
      if (diff <= 0) {
        setIsLocked(false);
        setLockedUntil(null);
        setCountdown("");
        clearInterval(interval);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setCountdown(`${mins}m ${secs < 10 ? "0" : ""}${secs}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLocked, lockedUntil]);

  async function checkPortalStatus() {
    try {
      const res = await fetch(`/api/verifier/portal?token=${encodeURIComponent(rawToken)}`);
      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || "Failed to load portal.");
        setStep("access_code");
        return;
      }

      if (data.alreadySubmitted) {
        setSubmissionReceipt(data);
        setStep("submitted");
        return;
      }

      if (data.locked) {
        setIsLocked(true);
        setLockedUntil(data.lockedUntil);
        setStep("access_code");
        return;
      }

      if (data.authenticated) {
        setChallengeCode(data.challengeCode);
        setOrderSummary(data.orderSummary);

        // Pre-fill quantities
        const initialQtys: Record<string, number> = {};
        const initialConds: Record<string, string> = {};
        data.orderSummary?.items?.forEach((it: OrderItem) => {
          initialQtys[it.description] = it.quantity;
          initialConds[it.description] = "Good";
        });
        setReceivedQtys(initialQtys);
        setItemConditions(initialConds);

        setStep("verification");
      } else {
        setRemainingAttempts(data.remainingAttempts ?? 5);
        setStep("access_code");
      }
    } catch (err: any) {
      setAuthError("Failed to reach verification server.");
      setStep("access_code");
    }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);

    const cleanCode = accessCode.trim().toUpperCase();
    if (cleanCode.length === 0) {
      setAuthError("Please enter the 6-character access code.");
      return;
    }

    try {
      const res = await fetch("/api/verifier/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken, accessCode: cleanCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.locked) {
          setIsLocked(true);
          setLockedUntil(data.lockedUntil);
        }
        setRemainingAttempts(data.remainingAttempts ?? 0);
        throw new Error(data.error || "Authentication failed.");
      }

      // Unlocked successfully: load portal data
      await checkPortalStatus();
    } catch (err: any) {
      setAuthError(err.message || "Invalid access code.");
    }
  }

  async function extractVideoKeyframes(videoFile: File): Promise<Blob[]> {
    return new Promise((resolve) => {
      try {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = URL.createObjectURL(videoFile);
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = async () => {
          const duration = video.duration || 10;
          const timestamps = [
            Math.min(1, duration * 0.2),
            Math.min(duration * 0.5, duration - 1),
            Math.min(duration * 0.8, duration - 0.5),
          ];

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = Math.min(video.videoWidth || 640, 1280);
          canvas.height = Math.min(video.videoHeight || 480, 720);

          const frames: Blob[] = [];

          for (const t of timestamps) {
            video.currentTime = t;
            await new Promise((r) => {
              video.onseeked = r;
            });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              await new Promise<void>((r) => {
                canvas.toBlob((blob) => {
                  if (blob) frames.push(blob);
                  r();
                }, "image/jpeg", 0.85);
              });
            }
          }

          URL.revokeObjectURL(video.src);
          resolve(frames);
        };

        video.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    setIsUploading(true);
    setSubmitError(null);

    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      if (files.length >= 12) {
        alert("Maximum 12 files allowed per delivery proof.");
        break;
      }

      let kind: "photo" | "video" | "document" | "pdf" = "photo";
      if (file.type.startsWith("video/")) kind = "video";
      else if (file.type === "application/pdf") kind = "pdf";

      try {
        // 1. Get signed upload URL
        const urlRes = await fetch("/api/verifier/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: rawToken,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            kind,
          }),
        });

        const urlData = await urlRes.json();
        if (!urlRes.ok) {
          throw new Error(urlData.error || `Upload rejected for ${file.name}`);
        }

        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;

        // Add to state with 0% progress
        const fileState: UploadedFileState = {
          id: urlData.fileId,
          name: file.name,
          size: file.size,
          kind,
          progress: 50,
          previewUrl,
        };

        setFiles((prev) => [...prev, fileState]);

        // 2. Direct upload to storage
        const uploadRes = await fetch(urlData.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Direct upload failed for ${file.name}`);
        }

        // Update progress to 100%
        setFiles((prev) =>
          prev.map((f) => (f.id === urlData.fileId ? { ...f, progress: 100 } : f))
        );

        // 3. If video, extract canvas keyframes and upload as 'keyframe'
        if (kind === "video") {
          const keyframes = await extractVideoKeyframes(file);
          for (let k = 0; k < keyframes.length; k++) {
            const kBlob = keyframes[k];
            const kRes = await fetch("/api/verifier/upload-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: rawToken,
                fileName: `keyframe_${k + 1}_${file.name}.jpg`,
                mimeType: "image/jpeg",
                sizeBytes: kBlob.size,
                kind: "keyframe",
              }),
            });
            const kData = await kRes.json();
            if (kRes.ok) {
              await fetch(kData.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": "image/jpeg" },
                body: kBlob,
              });
              setFiles((prev) => [
                ...prev,
                {
                  id: kData.fileId,
                  name: `Keyframe #${k + 1}`,
                  size: kBlob.size,
                  kind: "keyframe",
                  progress: 100,
                  previewUrl: URL.createObjectURL(kBlob),
                },
              ]);
            }
          }
        }
      } catch (err: any) {
        setSubmitError(err.message || "Failed to upload file.");
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmitProof(e: React.FormEvent) {
    e.preventDefault();
    if (!consentGiven) {
      setSubmitError("Please confirm your consent before submitting delivery proof.");
      return;
    }

    if (files.length === 0) {
      setSubmitError("Please take at least one photo or upload evidence.");
      return;
    }

    if (!verifierName.trim() || !verifierContact.trim()) {
      setSubmitError("Please enter your name and phone number or email.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/verifier/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: rawToken,
          receivedQuantities: receivedQtys,
          verifierName: verifierName.trim(),
          verifierContact: verifierContact.trim(),
          note: notes.trim() || undefined,
          consentGiven: true,
          fileIds: files.map((f) => f.id),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit verification proof.");
      }

      setSubmissionReceipt(data);
      setStep("submitted");
    } catch (err: any) {
      setSubmitError(err.message || "Submission failed. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between max-w-[440px] mx-auto px-4 py-6 font-sans">
      {/* Top Banner Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-brand-primary/10 rounded-xl text-brand-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-ink tracking-tight">BizFlow Proof Desk</div>
            <div className="text-[10px] text-ink-muted uppercase tracking-wider">
              Field Receiver Portal
            </div>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-muted text-ink-muted border border-border">
          Secure Portal
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 my-6 space-y-5">
        {step === "loading" && (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-ink-muted">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            <p className="text-xs">Connecting to secure delivery session...</p>
          </div>
        )}

        {/* STEP 1: ACCESS CODE ENTRY */}
        {step === "access_code" && (
          <div className="space-y-6">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 bg-surface-muted border border-border rounded-2xl flex items-center justify-center mx-auto text-ink">
                <Lock className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-ink">Enter Access Code</h1>
              <p className="text-xs text-ink-muted max-w-xs mx-auto">
                Enter the 6-character access code provided by the business owner to view delivery items and submit proof.
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {isLocked ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
                <div className="text-rose-400 font-bold text-sm">Portal Temporarily Locked</div>
                <div className="text-xs text-ink-muted">
                  Too many incorrect attempts. Link is locked for security.
                </div>
                {countdown && (
                  <div className="text-base font-mono font-bold text-rose-400">
                    Unlocks in: {countdown}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleUnlock} className="space-y-4">
                <div>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 7K2M9P"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    autoComplete="off"
                    autoFocus
                    className="w-full text-center text-2xl font-mono font-bold tracking-widest py-3.5 px-4 rounded-2xl bg-surface-muted border border-border text-ink focus:outline-none focus:border-brand-primary uppercase transition"
                  />
                  <div className="text-[11px] text-ink-muted text-center mt-2">
                    {remainingAttempts < 5 ? (
                      <span className="text-amber-400 font-medium">
                        {remainingAttempts} attempt{remainingAttempts === 1 ? "" : "s"} remaining before temporary lock
                      </span>
                    ) : (
                      "Case-insensitive • 6 characters"
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={accessCode.trim().length === 0}
                  className="w-full py-3.5 px-4 rounded-2xl bg-brand-primary text-white font-bold text-sm hover:bg-brand-primary/90 disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2"
                >
                  <span>Unlock Delivery Portal</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* STEP 2: VERIFICATION & EVIDENCE CAPTURE */}
        {step === "verification" && (
          <form onSubmit={handleSubmitProof} className="space-y-6">
            {submitError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Physical Challenge Code Banner */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1.5">
              <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                Physical Challenge Code
              </div>
              <div className="text-3xl font-mono font-black tracking-widest text-emerald-400">
                {challengeCode}
              </div>
              <p className="text-xs text-emerald-300/80 leading-relaxed">
                ✍️ Write this code on paper and hold it next to the goods in your photo/video.
              </p>
            </div>

            {/* Order Summary (Strictly no confidential prices or org bank secrets) */}
            <div className="p-4 rounded-2xl bg-surface-muted border border-border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink uppercase tracking-wider">Delivery Summary</span>
                <span className="font-mono text-ink-muted">{orderSummary?.poNumber}</span>
              </div>

              <div className="text-xs text-ink-muted">
                Supplier: <span className="font-semibold text-ink">{orderSummary?.vendorName}</span>
              </div>

              {/* Items & Received Quantities Inputs */}
              <div className="space-y-2.5 pt-1">
                {orderSummary?.items?.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-surface border border-border space-y-2 text-xs"
                  >
                    <div className="font-semibold text-ink">{item.description}</div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-ink-muted">
                        Expected: <span className="font-mono font-bold text-ink">{item.quantity}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-ink-muted text-[11px]">Received:</label>
                        <input
                          type="number"
                          min="0"
                          value={receivedQtys[item.description] ?? item.quantity}
                          onChange={(e) =>
                            setReceivedQtys((prev) => ({
                              ...prev,
                              [item.description]: parseInt(e.target.value, 10) || 0,
                            }))
                          }
                          className="w-16 py-1 px-2 rounded-lg bg-surface-muted border border-border font-mono text-center font-bold text-ink text-sm focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Photo & Video Evidence Upload Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink uppercase tracking-wider">
                  Evidence Photos & Videos
                </span>
                <span className="text-[11px] text-ink-muted font-mono">{files.length}/12 files</span>
              </div>

              {/* Take Photo / Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || files.length >= 12}
                className="w-full py-3.5 px-4 rounded-2xl border-2 border-dashed border-border hover:border-brand-primary bg-surface-muted/50 hover:bg-surface-muted transition flex items-center justify-center gap-2 text-xs font-semibold text-ink"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                ) : (
                  <Camera className="w-4 h-4 text-brand-primary" />
                )}
                <span>{isUploading ? "Uploading direct to secure storage..." : "Take Photo or Upload Evidence"}</span>
              </button>

              {/* Uploaded Files Gallery */}
              {files.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="relative rounded-xl border border-border bg-surface-muted overflow-hidden flex flex-col h-24"
                    >
                      {f.previewUrl ? (
                        <img src={f.previewUrl} alt={f.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink-muted">
                          {f.kind === "video" ? <Video className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 p-1 bg-black/60 text-white text-[9px] truncate">
                        {f.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Receiver Contact Details */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-ink uppercase tracking-wider">
                Receiver Details
              </span>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Your Full Name"
                  value={verifierName}
                  onChange={(e) => setVerifierName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-xs text-ink focus:outline-none focus:border-brand-primary"
                />
                <input
                  type="text"
                  placeholder="Your Phone / WhatsApp or Email"
                  value={verifierContact}
                  onChange={(e) => setVerifierContact(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-xs text-ink focus:outline-none focus:border-brand-primary"
                />
                <textarea
                  placeholder="Delivery notes or damage remarks (optional)..."
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-xs text-ink focus:outline-none focus:border-brand-primary resize-none"
                />
              </div>
            </div>

            {/* Privacy Consent Notice */}
            <div className="p-3.5 rounded-xl bg-surface-muted border border-border text-xs space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-0.5 rounded border-border text-brand-primary focus:ring-0"
                />
                <span className="text-ink-muted text-[11px] leading-relaxed">
                  I consent to uploading photos and delivery confirmation. No GPS location or personal identity documents are collected or stored.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !consentGiven || files.length === 0}
              className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              <span>{isSubmitting ? "Submitting Proof..." : "Submit Delivery Proof"}</span>
            </button>
          </form>
        )}

        {/* STEP 3: SUBMITTED CONFIRMATION & RECEIPT */}
        {step === "submitted" && (
          <div className="text-center space-y-5 py-6">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-bold text-ink">Proof Submitted Successfully</h1>
              <p className="text-xs text-ink-muted max-w-xs mx-auto">
                Thank you. Your delivery verification photos and confirmation have been recorded securely.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface-muted border border-border text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-muted">Submission Status:</span>
                <span className="font-semibold text-emerald-400 uppercase">Received & Verified</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Timestamp:</span>
                <span className="font-mono text-ink">
                  {new Date(submissionReceipt?.submittedAt || Date.now()).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Files Recorded:</span>
                <span className="font-mono text-ink">{submissionReceipt?.filesCount || files.length} files</span>
              </div>
            </div>

            <div className="text-[11px] text-ink-muted bg-surface-muted/50 p-3 rounded-xl border border-border/50">
              🔒 <strong>Lock enforced:</strong> This verification portal is now locked against further modifications. The business owner has received notification of your submission.
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-border text-center text-[10px] text-ink-muted">
        Powered by BizFlow Pilot V2 • Non-Custodial Verification Architecture
      </div>
    </div>
  );
}
