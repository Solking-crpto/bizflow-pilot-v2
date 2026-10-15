import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPublicClient, http, parseEventLogs, erc20Abi } from "viem";
import { prisma, withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { getActiveNetwork } from "@/lib/networks";
import { recordAuditEvent } from "@/lib/audit/ledger";

export const dynamic = "force-dynamic";

const VerifyReceiptSchema = z.object({
  intentId: z.string().min(1, "Payment intent ID is required"),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash format"),
});

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Please connect your wallet" }, { status: 401 });
    }

    const org = await getSessionOrg(session);
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
      prisma.paymentIntent.findUnique({
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
        prisma.payment.findFirst({
          where: { txHash: { equals: normalizedTxHash, mode: "insensitive" } },
        })
      );
      return NextResponse.json({
        success: true,
        isIdempotent: true,
        message: "Payment already verified and confirmed on Arc.",
        payment: existingPayment,
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
      prisma.payment.findFirst({
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
    const network = getActiveNetwork();
    const publicClient = createPublicClient({
      chain: network.chain,
      transport: http(network.rpcUrl, { timeout: 15000 }),
    });

    let receipt: any;
    try {
      receipt = await publicClient.getTransactionReceipt({
        hash: normalizedTxHash as `0x${string}`,
      });
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

    // Verify recipient contract is Arc USDC
    if (receipt.to?.toLowerCase() !== network.usdcAddress.toLowerCase()) {
      return NextResponse.json(
        { error: `Transaction target is not the Arc USDC token contract (${network.usdcAddress})` },
        { status: 400 }
      );
    }

    // 6. Verify Transfer event in logs
    let matchingTransferFound = false;
    try {
      const transferLogs = parseEventLogs({
        abi: erc20Abi,
        logs: receipt.logs,
        eventName: "Transfer",
      });

      for (const log of transferLogs) {
        const isCorrectToken = log.address.toLowerCase() === network.usdcAddress.toLowerCase();
        const isPayer = log.args.from.toLowerCase() === intent.payerAddress.toLowerCase();
        const isRecipient = log.args.to.toLowerCase() === intent.recipientAddress.toLowerCase();
        const isCorrectAmount = log.args.value === intent.amountAtomic;

        if (isCorrectToken && isPayer && isRecipient && isCorrectAmount) {
          matchingTransferFound = true;
          break;
        }
      }
    } catch (parseErr) {
      // Fallback manual topics parsing if parseEventLogs encounters custom log structures
      const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      const expectedPayerTopic = `0x000000000000000000000000${intent.payerAddress.toLowerCase().replace("0x", "")}`;
      const expectedRecipientTopic = `0x000000000000000000000000${intent.recipientAddress.toLowerCase().replace("0x", "")}`;

      for (const log of receipt.logs) {
        if (
          log.address.toLowerCase() === network.usdcAddress.toLowerCase() &&
          log.topics[0]?.toLowerCase() === TRANSFER_TOPIC.toLowerCase() &&
          log.topics[1]?.toLowerCase() === expectedPayerTopic &&
          log.topics[2]?.toLowerCase() === expectedRecipientTopic
        ) {
          const val = BigInt(log.data);
          if (val === intent.amountAtomic) {
            matchingTransferFound = true;
            break;
          }
        }
      }
    }

    if (!matchingTransferFound) {
      return NextResponse.json(
        {
          error:
            "Receipt verification failed: No matching USDC Transfer event found matching payer, recipient, and atomic amount.",
        },
        { status: 400 }
      );
    }

    // 7. Atomic DB updates: Payment record, invoice status, payment intent, and audit ledger
    const blockNumber = Number(receipt.blockNumber);
    const idempotencyKey = `noncustodial-${intent.id}-${normalizedTxHash}`;

    const [payment] = await withDbTimeout(() =>
      prisma.$transaction([
        prisma.payment.create({
          data: {
            orgId: org.id,
            invoiceId: intent.invoiceId,
            vendorId: intent.vendorId,
            network: network.mode,
            provider: "direct",
            idempotencyKey,
            amountAtomic: intent.amountAtomic,
            destination: intent.recipientAddress,
            status: "confirmed",
            txHash: normalizedTxHash,
            receiptJson: JSON.stringify({
              blockNumber,
              gasUsed: receipt.gasUsed?.toString(),
              effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
              from: receipt.from,
              to: receipt.to,
            }),
            confirmedAt: new Date(),
          },
        }),
        prisma.invoice.update({
          where: { id: intent.invoiceId },
          data: { status: "paid" },
        }),
        prisma.paymentIntent.update({
          where: { id: intent.id },
          data: {
            status: "completed",
            txHash: normalizedTxHash,
          },
        }),
      ])
    );

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
        network: network.mode,
        intentId: intent.id,
      },
    });

    return NextResponse.json({
      success: true,
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
    return NextResponse.json(
      { error: error.message || "Failed to verify transaction receipt" },
      { status: 500 }
    );
  }
}
