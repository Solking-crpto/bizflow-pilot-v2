import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPublicClient, http } from "viem";
import { prisma, withDbTimeout } from "@/lib/db";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { getActiveNetwork } from "@/lib/networks";
import { recordAuditEvent } from "@/lib/audit/ledger";
import { sha256Bytes32 } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const AnchorReceiptSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
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
    const parsed = AnchorReceiptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error }, { status: 400 });
    }

    const { invoiceId, txHash } = parsed.data;
    const normalizedTxHash = txHash.toLowerCase();

    // 1. Fetch invoice and verify organization ownership (IDOR check)
    const invoice = await withDbTimeout(() =>
      prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          payments: {
            orderBy: { initiatedAt: "desc" },
            take: 1,
          },
        },
      })
    );

    if (!invoice || invoice.orgId !== org.id) {
      return NextResponse.json({ error: "Invoice not found or access denied" }, { status: 404 });
    }

    // 2. Query Arc RPC directly from server to verify anchor transaction receipt
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
        { error: `Could not fetch anchor receipt from Arc RPC: ${rpcErr.message}` },
        { status: 400 }
      );
    }

    if (!receipt) {
      return NextResponse.json(
        { error: "Transaction receipt not yet confirmed on Arc network" },
        { status: 202 }
      );
    }

    if (receipt.status !== "success" && receipt.status !== 1) {
      return NextResponse.json(
        { error: "Anchor transaction failed on-chain on Arc network" },
        { status: 400 }
      );
    }

    const blockNumber = Number(receipt.blockNumber);
    const invoiceHashBytes32 = sha256Bytes32(invoice.fileHash);
    const latestPayment = invoice.payments[0];

    // 3. Update DB records
    if (latestPayment) {
      await withDbTimeout(() =>
        Promise.all([
          prisma.payment.update({
            where: { id: latestPayment.id },
            data: {
              status: "anchored",
              anchorTxHash: normalizedTxHash,
              anchoredAt: new Date(),
            },
          }),
          prisma.anchor.upsert({
            where: { paymentId: latestPayment.id },
            update: {
              anchorTxHash: normalizedTxHash,
              blockNumber,
              anchoredAt: new Date(),
            },
            create: {
              paymentId: latestPayment.id,
              invoiceHash: invoiceHashBytes32,
              decisionHash: invoiceHashBytes32,
              paymentRef: invoiceHashBytes32,
              anchorTxHash: normalizedTxHash,
              blockNumber,
              anchoredAt: new Date(),
            },
          }),
        ])
      );
    }

    // 4. Record audit ledger event
    await recordAuditEvent({
      orgId: org.id,
      eventType: "anchor_confirmed",
      referenceId: latestPayment?.id || invoice.id,
      eventData: {
        actor: "user_wallet",
        action: "NON_CUSTODIAL_AUDIT_ANCHOR",
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        anchorTxHash: normalizedTxHash,
        blockNumber,
        network: network.mode,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Audit anchor successfully confirmed and verified on Arc network.",
      anchorTxHash: normalizedTxHash,
      blockNumber,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to verify anchor receipt" },
      { status: 500 }
    );
  }
}
