"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Wallet,
  ArrowRight,
  Anchor,
  FileCheck,
} from "lucide-react";
import { createPublicClient, createWalletClient, custom, http, erc20Abi, formatUnits } from "viem";
import { useWallet } from "@/components/auth/WalletContext";
import { ANCHOR_ABI } from "@/lib/contracts/auditAnchorAbi";
import { sha256Bytes32 } from "@/lib/crypto";

interface NonCustodialPaymentModalProps {
  isOpen: boolean;
  invoiceId: string;
  onClose: () => void;
  onSuccess: (payment: any) => void;
}

type PaymentStep =
  | "CREATING_INTENT"
  | "READY"
  | "AWAITING_SIGNATURE"
  | "AWAITING_CONFIRMATION"
  | "VERIFYING_RECEIPT"
  | "SETTLED"
  | "ANCHORING"
  | "ANCHORED"
  | "ERROR";

export function NonCustodialPaymentModal({
  isOpen,
  invoiceId,
  onClose,
  onSuccess,
}: NonCustodialPaymentModalProps) {
  const { address, isConnected, isCorrectNetwork, switchNetwork, connect, activeNetwork } = useWallet();

  const [step, setStep] = useState<PaymentStep>("CREATING_INTENT");
  const [intentData, setIntentData] = useState<any>(null);
  const [policyData, setPolicyData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [policyReasons, setPolicyReasons] = useState<string[]>([]);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [anchorTxHash, setAnchorTxHash] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [hasSufficientBalance, setHasSufficientBalance] = useState<boolean>(true);
  const [confirmedPayment, setConfirmedPayment] = useState<any>(null);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState<boolean>(false);

  // Initialize and create intent when modal opens
  useEffect(() => {
    if (!isOpen || !invoiceId) return;

    let isMounted = true;
    setStep("CREATING_INTENT");
    setErrorMessage(null);
    setPolicyReasons([]);
    setTxHash(null);
    setAnchorTxHash(null);
    setConfirmedPayment(null);
    setIsPaymentConfirmed(false);

    async function initIntent() {
      try {
        const res = await fetch("/api/payments/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId }),
        });

        const data = await res.json();
        if (!isMounted) return;

        if (!res.ok || !data.allowed) {
          setStep("ERROR");
          setErrorMessage(data.error || "Policy engine rejected this payment");
          setPolicyReasons(data.reasons || []);
          return;
        }

        setIntentData(data.intent);
        setPolicyData(data.policy);
        setStep("READY");

        // Check USDC Balance if wallet connected
        if (address && window.ethereum) {
          try {
            const publicClient = createPublicClient({
              chain: activeNetwork.chain,
              transport: custom(window.ethereum),
            });

            const bal = await publicClient.readContract({
              address: data.intent.tokenAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address as `0x${string}`],
            });

            const formattedBal = formatUnits(bal, 6);
            setUsdcBalance(formattedBal);
            setHasSufficientBalance(bal >= BigInt(data.intent.amountAtomic));
          } catch {
            // Balance read error ignored
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        setStep("ERROR");
        setErrorMessage(err.message || "Failed to initialize payment intent");
      }
    }

    initIntent();

    return () => {
      isMounted = false;
    };
  }, [isOpen, invoiceId, address, activeNetwork]);

  if (!isOpen) return null;

  const handleSignPayment = async () => {
    if (!intentData || !window.ethereum || !address) return;

    try {
      if (!isCorrectNetwork) {
        const switched = await switchNetwork();
        if (!switched) {
          setErrorMessage(`Please switch your wallet to ${activeNetwork.name}`);
          return;
        }
      }

      setStep("AWAITING_SIGNATURE");
      setErrorMessage(null);

      const walletClient = createWalletClient({
        chain: activeNetwork.chain,
        transport: custom(window.ethereum),
      });

      const publicClient = createPublicClient({
        chain: activeNetwork.chain,
        transport: custom(window.ethereum),
      });

      // 1. Send ERC-20 transfer
      const hash = await walletClient.writeContract({
        address: intentData.tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "transfer",
        args: [intentData.recipientAddress as `0x${string}`, BigInt(intentData.amountAtomic)],
        account: address as `0x${string}`,
      });

      setTxHash(hash);
      setStep("AWAITING_CONFIRMATION");

      // 2. Wait for confirmation on Arc
      await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      setStep("VERIFYING_RECEIPT");

      // 3. Post to verify-receipt
      const verifyRes = await fetch("/api/payments/verify-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentId: intentData.id,
          txHash: hash,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setStep("ERROR");
        setErrorMessage(verifyData.error || "Server verification of transaction receipt failed.");
        return;
      }

      setConfirmedPayment(verifyData.payment);
      setStep("SETTLED");
      onSuccess(verifyData.payment);
    } catch (err: any) {
      setStep("ERROR");
      if (err.message?.includes("User rejected") || err.message?.includes("denied")) {
        setErrorMessage("Transaction signing was rejected by user.");
      } else {
        setErrorMessage(err.message || "Payment execution failed");
      }
    }
  };

  const handleAnchorProof = async () => {
    if (!confirmedPayment || !window.ethereum || !address) return;
    const anchorAddress = activeNetwork.anchorAddress || (process.env.NEXT_PUBLIC_AUDIT_ANCHOR_ADDRESS as `0x${string}`);

    setStep("ANCHORING");
    try {
      if (anchorAddress && anchorAddress.startsWith("0x")) {
        const walletClient = createWalletClient({
          chain: activeNetwork.chain,
          transport: custom(window.ethereum),
        });

        const publicClient = createPublicClient({
          chain: activeNetwork.chain,
          transport: custom(window.ethereum),
        });

        const invoiceHashBytes32 = sha256Bytes32(intentData.invoiceNumber || invoiceId);
        const ledgerRootBytes32 = sha256Bytes32(confirmedPayment.txHash || invoiceId);

        const aHash = await walletClient.writeContract({
          address: anchorAddress,
          abi: ANCHOR_ABI,
          functionName: "anchorProof",
          args: [invoiceHashBytes32, ledgerRootBytes32],
          account: address as `0x${string}`,
        });

        await publicClient.waitForTransactionReceipt({ hash: aHash });

        // Record anchor on server
        await fetch("/api/payments/anchor-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId,
            txHash: aHash,
          }),
        });

        setAnchorTxHash(aHash);
        setStep("ANCHORED");
      } else {
        // Deterministic server anchor
        const aRes = await fetch("/api/payments/anchor-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId,
            txHash: confirmedPayment.txHash,
          }),
        });
        const aData = await aRes.json();
        setAnchorTxHash(aData.anchorTxHash || confirmedPayment.txHash);
        setStep("ANCHORED");
      }
    } catch (err: any) {
      setStep("SETTLED");
      setErrorMessage("Anchor proof signing cancelled or failed.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-dark/60 backdrop-blur-xs">
      <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-canvas/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-light flex items-center justify-center text-brand-teal">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Non-Custodial USDC Settlement</h2>
              <p className="text-[11px] text-ink-muted">Sign and pay directly from your connected EVM wallet on Arc</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink p-1 rounded-md hover:bg-canvas transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {step === "CREATING_INTENT" && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-brand-teal animate-spin" />
              <p className="text-xs text-ink-muted">Evaluating 10-point deterministic corporate policy...</p>
            </div>
          )}

          {step === "ERROR" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-danger-light border border-danger-border flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs font-bold text-danger">Payment Intent Refused</div>
                  <div className="text-xs text-danger/90">{errorMessage}</div>
                </div>
              </div>

              {policyReasons.length > 0 && (
                <div className="bg-canvas rounded-lg p-3 border border-border space-y-1.5">
                  <div className="text-[11px] font-semibold text-ink-muted uppercase">Policy Check Failures:</div>
                  <ul className="list-disc list-inside text-xs text-danger space-y-1">
                    {policyReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-md bg-canvas border border-border text-xs font-semibold text-ink hover:bg-white"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {step === "READY" && intentData && (
            <div className="space-y-4">
              {/* Payment Summary Box */}
              <div className="p-4 rounded-xl border border-border bg-canvas/50 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="text-xs text-ink-muted">Invoice Number:</span>
                  <span className="font-mono text-xs font-bold text-ink">{intentData.invoiceNumber}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="text-xs text-ink-muted">Supplier:</span>
                  <span className="text-xs font-semibold text-ink">{intentData.supplierName}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="text-xs text-ink-muted">Payout EVM Address:</span>
                  <span className="font-mono text-[11px] text-ink">
                    {intentData.recipientAddress.slice(0, 10)}...{intentData.recipientAddress.slice(-6)}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="text-xs text-ink-muted">Network:</span>
                  <span className="font-mono text-xs font-semibold text-navy">{intentData.networkName}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold text-ink">Total Settlement:</span>
                  <span className="font-mono text-lg font-bold text-navy">{intentData.amountFormatted}</span>
                </div>
              </div>

              {/* Policy Passed Badge */}
              <div className="p-2.5 rounded-lg bg-success-light border border-success-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-success font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Deterministic Policy Engine: Approved</span>
                </div>
                <span className="text-[10px] text-ink-muted font-mono">10/10 Passed</span>
              </div>

              {/* Wallet & Balance Status */}
              {!isConnected ? (
                <div className="p-3 rounded-lg bg-warning-light border border-warning-border flex items-center justify-between text-xs">
                  <div className="text-warning">Wallet not connected</div>
                  <button
                    onClick={connect}
                    className="px-3 py-1 bg-navy text-white text-xs font-semibold rounded hover:bg-navy-light"
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : !isCorrectNetwork ? (
                <div className="p-3 rounded-lg bg-warning-light border border-warning-border flex items-center justify-between text-xs">
                  <div className="text-warning">Wallet on incorrect network</div>
                  <button
                    onClick={switchNetwork}
                    className="px-3 py-1 bg-brand-teal text-white text-xs font-semibold rounded hover:bg-brand-hover"
                  >
                    Switch to {activeNetwork.name}
                  </button>
                </div>
              ) : !hasSufficientBalance ? (
                <div className="p-3 rounded-lg bg-danger-light border border-danger-border space-y-1 text-xs text-danger">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Insufficient USDC Balance
                  </div>
                  <div>
                    Your wallet holds {usdcBalance || "0"} USDC, but this settlement requires{" "}
                    {intentData.amountFormatted}.
                  </div>
                </div>
              ) : null}

              {/* Explicit User Confirmation Step */}
              <div className="p-3 rounded-lg border border-border bg-canvas/40 space-y-2 text-xs">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPaymentConfirmed}
                    onChange={(e) => setIsPaymentConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-border text-navy focus:ring-navy h-4 w-4"
                  />
                  <span className="text-ink text-[11px] leading-relaxed">
                    I confirm that I am authorizing an on-chain transfer of{" "}
                    <strong>{intentData.amountFormatted}</strong> to{" "}
                    <strong>{intentData.supplierName}</strong> on {intentData.networkName}.
                    {activeNetwork.mode === "mainnet" && (
                      <span className="block text-amber-800 font-medium mt-0.5">
                        Notice: Arc Mainnet settlements are final, non-custodial, and irreversible.
                      </span>
                    )}
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-md bg-canvas border border-border text-xs font-semibold text-ink hover:bg-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignPayment}
                  disabled={!isConnected || !isCorrectNetwork || !hasSufficientBalance || !isPaymentConfirmed}
                  className="px-4 py-2 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Wallet className="w-3.5 h-3.5 text-brand-teal" />
                  <span>Confirm & Sign in Wallet</span>
                </button>
              </div>
            </div>
          )}

          {step === "AWAITING_SIGNATURE" && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-9 h-9 text-brand-teal animate-spin" />
              <div>
                <h3 className="text-sm font-bold text-ink">Awaiting Wallet Signature</h3>
                <p className="text-xs text-ink-muted mt-1">
                  Please review and approve the USDC transfer transaction in your browser wallet...
                </p>
              </div>
            </div>
          )}

          {step === "AWAITING_CONFIRMATION" && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-9 h-9 text-brand-teal animate-spin" />
              <div>
                <h3 className="text-sm font-bold text-ink">Confirming on Arc Blockchain</h3>
                <p className="text-xs text-ink-muted mt-1">
                  Transaction broadcasted. Awaiting block receipt confirmation on Arc network...
                </p>
              </div>
              {txHash && (
                <a
                  href={`${activeNetwork.explorerUrl}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-brand-teal hover:underline flex items-center gap-1"
                >
                  <span>{txHash.slice(0, 14)}...{txHash.slice(-10)}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {step === "VERIFYING_RECEIPT" && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-9 h-9 text-navy animate-spin" />
              <div>
                <h3 className="text-sm font-bold text-ink">Verifying RPC Receipt & Hash-Chaining</h3>
                <p className="text-xs text-ink-muted mt-1">
                  Server fetching on-chain receipt from Arc RPC node, verifying Transfer events, and appending to audit ledger...
                </p>
              </div>
            </div>
          )}

          {(step === "SETTLED" || step === "ANCHORING" || step === "ANCHORED") && confirmedPayment && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-success-light/60 border border-success-border flex flex-col items-center text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-success" />
                <h3 className="text-sm font-bold text-success">Settlement Confirmed on Arc</h3>
                <p className="text-xs text-ink-muted">
                  Funds transferred non-custodially from your wallet. Hash-chained audit event committed.
                </p>
              </div>

              <div className="bg-canvas rounded-lg p-3 border border-border space-y-2 text-xs font-mono">
                <div className="flex justify-between text-ink">
                  <span className="text-ink-muted font-sans">Tx Hash:</span>
                  <a
                    href={`${activeNetwork.explorerUrl}/tx/${confirmedPayment.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-teal hover:underline flex items-center gap-1"
                  >
                    <span>{confirmedPayment.txHash?.slice(0, 10)}...{confirmedPayment.txHash?.slice(-6)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex justify-between text-ink">
                  <span className="text-ink-muted font-sans">Block Height:</span>
                  <span className="font-bold">{confirmedPayment.blockNumber || "Confirmed"}</span>
                </div>
                <div className="flex justify-between text-ink">
                  <span className="text-ink-muted font-sans">Amount:</span>
                  <span className="font-bold">{confirmedPayment.amountFormatted}</span>
                </div>
              </div>

              {step === "ANCHORED" ? (
                <div className="p-3 rounded-lg bg-brand-light border border-brand-teal/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-brand-teal font-semibold">
                    <Anchor className="w-4 h-4" />
                    <span>Audit Proof Permanently Anchored</span>
                  </div>
                  {anchorTxHash && (
                    <a
                      href={`${activeNetwork.explorerUrl}/tx/${anchorTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] text-brand-teal hover:underline flex items-center gap-0.5"
                    >
                      <span>{anchorTxHash.slice(0, 6)}...</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ) : step === "ANCHORING" ? (
                <div className="p-3 rounded-lg bg-canvas border border-border flex items-center justify-center gap-2 text-xs text-ink-muted">
                  <Loader2 className="w-4 h-4 text-brand-teal animate-spin" />
                  <span>Signing AuditAnchor proof with wallet...</span>
                </div>
              ) : (
                <div className="pt-2 flex items-center justify-between gap-2 border-t border-border">
                  <button
                    onClick={handleAnchorProof}
                    className="px-3.5 py-2 rounded-md bg-white border border-border text-navy text-xs font-semibold hover:bg-canvas transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <Anchor className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Anchor Proof on Arc (Gas &lt; $0.001)</span>
                  </button>

                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}

              {step === "ANCHORED" && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-md bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
