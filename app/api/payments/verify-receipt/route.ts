import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPublicClient, http } from "viem";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { getNetworkConfig } from "@/lib/networks";
import { recordAuditEvent } from "@/lib/audit/ledger";
import { getClientIp, checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { verifyArcTransferReceiptLogs } from "@/lib/payment/receipt-verifier";
import { withRpcRetry } from "@/lib/rpc/client";
import { safeDbErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

const VerifyReceiptSchema = z.object({
  intentId: z.string().min(1, "Payment intent ID is required"),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash format"),
});

export async function POST(req: NextRequest) {
  try {
    const netCtx = validateApiNetwork(req);
    if (!netCtx.success) return netCtx.response;
    const { network, db } = netCtx;

    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Please connect your wallet" }, { status: 401 });
    }

    const ip = getClientIp(req);
    const rlIp = checkRateLimit(`payment:verify:ip:${ip}`, 30, 60_000);
    if (!rlIp.allowed) return rateLimitExceededResponse(rlIp.retryAfterSeconds);

    const rlWallet = checkRateLimit(`payment:verify:wallet:${session.address}`, 20, 60_000);
    if (!rlWallet.allowed) return rateLimitExceededResponse(rlWallet.retryAfterSeconds);

    const org = await getSessionOrg(session, network);
    if (!org) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = VerifyReceiptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error }, { status: 400 });
    }

    const { intentId, txHash } = parsed.data;
    const normalizedTxHash = txHash.toLowerCase();

    // 1. Fetch PaymentIntent and verify multi-tenant isolation
    const intent = await withDbTimeout(() =>
      db.paymentIntent.findUnique({
        where: { id: intentId },
        include: {
          invoice: {
            include: {
              vendor: true,
            },
          },
        },
      })
    );

    if (!intent || intent.orgId !== org.id) {
      return NextResponse.json({ error: "Payment intent not found or access denied" }, { status: 404 });
    }

    // 2. Check if already completed (idempotent return)
    if (intent.status === "completed" && intent.txHash?.toLowerCase() === normalizedTxHash) {
      const existingPayment = await withDbTimeout(() =>
        db.payment.findFirst({
          where: { txHash: { equals: normalizedTxHash, mode: "insensitive" } },
        })
      );
      return NextResponse.json({
        success: true,
        isIdempotent: true,
        network,
        message: "Payment already verified and confirmed on Arc.",
        payment: existingPayment
          ? {
              id: existingPayment.id,
              invoiceId: existingPayment.invoiceId,
              txHash: existingPayment.txHash,
              amountFormatted: formatUsdc(usdcAtomic(existingPayment.amountAtomic)),
              destination: existingPayment.destination,
              confirmedAt: existingPayment.confirmedAt,
            }
          : null,
      });
    }

    // 3. Check expiration
    if (new Date() > intent.expiresAt) {
      return NextResponse.json(
        { error: "Payment intent has expired. Please initiate a new payment intent." },
        { status: 400 }
      );
    }

    // 4. Replay Prevention: Ensure txHash has not been used anywhere else
    const duplicatePayment = await withDbTimeout(() =>
      db.payment.findFirst({
        where: {
          txHash: { equals: normalizedTxHash, mode: "insensitive" },
        },
      })
    );

    if (duplicatePayment) {
      return NextResponse.json(
        { error: "Replay violation: This transaction hash has already been recorded for a payment." },
        { status: 409 }
      );
    }

    // 5. Connect to Arc RPC directly from the server to fetch and verify the receipt
    const networkConfig = getNetworkConfig(network);
    const publicClient = createPublicClient({
      chain: networkConfig.chain,
      transport: http(networkConfig.rpcUrl, { timeout: 15000 }),
    });

    let receipt: any;
    try {
      receipt = await withRpcRetry(() =>
        publicClient.getTransactionReceipt({
          hash: normalizedTxHash as `0x${string}`,
        })
      );
    } catch (rpcErr: any) {
      return NextResponse.json(
        { error: `Could not fetch transaction receipt from Arc RPC: ${rpcErr.message}` },
        { status: 400 }
      );
    }

    if (!receipt) {
      return NextResponse.json(
        { error: "Transaction receipt not yet available on Arc network. Please retry in a few moments." },
        { status: 202 }
      );
    }

    // Verify transaction status (1 or 'success')
    if (receipt.status !== "success" && receipt.status !== 1) {
      return NextResponse.json(
        { error: "Blockchain transaction failed on-chain on Arc network." },
        { status: 400 }
      );
    }

    // Verify recipient contract is Arc USDC for this network
    if (receipt.to?.toLowerCase() !== networkConfig.usdcAddress.toLowerCase()) {
      return NextResponse.json(
        { error: `Transaction target is not the Arc USDC token contract (${networkConfig.usdcAddress})` },
        { status: 400 }
      );
    }

    // 6. Verify Transfer event in logs with Arc dual-emitter disambiguation
    const verification = verifyArcTransferReceiptLogs({
      logs: receipt.logs,
      payerAddress: intent.payerAddress,
      recipientAddress: intent.recipientAddress,
      expectedAmountAtomic6: intent.amountAtomic,
      expectedErc20Address: networkConfig.usdcAddress,
    });

    if (!verification.valid) {
      return NextResponse.json(
        {
          error:
            verification.error ||
            "Receipt verification failed: No matching USDC Transfer event found matching payer, recipient, and atomic amount.",
        },
        { status: 400 }
      );
    }

    // 7. Atomic DB updates: Payment record, invoice status, payment intent, and audit ledger
    const blockNumber = Number(receipt.blockNumber);
    const idempotencyKey = `noncustodial-${intent.id}-${normalizedTxHash}`;

    const [payment] = await withDbTimeout(() =>
      db.$transaction([
        db.payment.create({
          data: {
            orgId: org.id,
            invoiceId: intent.invoiceId,
            vendorId: intent.vendorId,
            network,
            provider: "direct",
            idempotencyKey,
            amountAtomic: intent.amountAtomic,
            destination: intent.recipientAddress,
            status: "confirmed",
            txHash: normalizedTxHash,
            isOverridden: intent.isOverridden,
            overrideReason: intent.overrideReason,
            receiptJson: JSON.stringify({
              blockNumber,
              gasUsed: receipt.gasUsed?.toString(),
              effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
              from: receipt.from,
              to: receipt.to,
              isOverridden: intent.isOverridden,
              overrideReason: intent.overrideReason,
            }),
            confirmedAt: new Date(),
          },
        }),
        db.invoice.update({
          where: { id: intent.invoiceId },
          data: { status: "paid" },
        }),
        db.paymentIntent.update({
          where: { id: intent.id },
          data: {
            status: "completed",
            txHash: normalizedTxHash,
          },
        }),
      ])
    );

    // If intent had an owner override, record delivery_overridden in audit chain
    if (intent.isOverridden) {
      await recordAuditEvent({
        orgId: org.id,
        eventType: "delivery_overridden",
        referenceId: intent.invoiceId,
        eventData: {
          invoiceId: intent.invoiceId,
          intentId: intent.id,
          reason: intent.overrideReason,
          actor: "owner",
        },
        network,
      });
    }

    // 8. Cryptographic hash-chained audit event recording
    await recordAuditEvent({
      orgId: org.id,
      eventType: "payment_confirmed",
      referenceId: payment.id,
      eventData: {
        actor: "user_wallet",
        action: "NON_CUSTODIAL_SETTLEMENT",
        payerAddress: intent.payerAddress,
        recipientAddress: intent.recipientAddress,
        amountAtomic: intent.amountAtomic.toString(),
        amountFormatted: formatUsdc(usdcAtomic(intent.amountAtomic)),
        txHash: normalizedTxHash,
        blockNumber,
        network,
        intentId: intent.id,
        isOverridden: intent.isOverridden,
      },
      network,
    });

    return NextResponse.json({
      success: true,
      network,
      message: "Non-custodial payment successfully confirmed and verified on Arc network.",
      payment: {
        id: payment.id,
        invoiceId: payment.invoiceId,
        txHash: payment.txHash,
        blockNumber,
        amountFormatted: formatUsdc(usdcAtomic(payment.amountAtomic)),
        destination: payment.destination,
        confirmedAt: payment.confirmedAt,
      },
    });
  } catch (error: any) {
    return safeDbErrorResponse(error);
  }
}
