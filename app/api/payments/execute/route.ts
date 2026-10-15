export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyOwnerPasscodeWithRateLimit, getClientIp } from "@/lib/security/auth";
import { executePaymentTransaction } from "@/lib/payments/executor";
import { getNetworkConfig } from "@/lib/networks";
import { getSessionFromRequest, isAdminWallet } from "@/lib/auth/session";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";

const ExecutePaymentSchema = z.object({
  invoiceId: z.string(),
  hasOwnerConfirmation: z.boolean().optional(),
  passcode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const netCtx = validateApiNetwork(req);
    if (!netCtx.success) return netCtx.response;
    const { network, db } = netCtx;

    // Requirement A.7: Builder/admin features exist on MAINNET only!
    if (network !== "mainnet") {
      return NextResponse.json(
        { error: "Server treasury execution is restricted to Arc Mainnet builder-admin mode only." },
        { status: 403 }
      );
    }

    const clientIp = getClientIp(req);
    const body = await req.json();
    const parsed = ExecutePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload", details: parsed.error }, { status: 400 });
    }

    const { invoiceId, hasOwnerConfirmation, passcode } = parsed.data;

    // Strict Non-Custodial Guard:
    // Public organizations must NEVER use the server treasury private key.
    const session = getSessionFromRequest(req);
    if (session && !isAdminWallet(session.address)) {
      return NextResponse.json(
        { error: "Public organizations must sign payments with their own wallet." },
        { status: 403 }
      );
    }

    const invoice = await withDbTimeout(() =>
      db.invoice.findUnique({
        where: { id: invoiceId },
        include: { organization: true },
      })
    );

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.organization?.walletAddress && !isAdminWallet(invoice.organization.walletAddress)) {
      return NextResponse.json(
        { error: "Public organizations must sign payments with their own wallet." },
        { status: 403 }
      );
    }

    // Enforce owner passcode with rate limiting
    const authCheck = verifyOwnerPasscodeWithRateLimit(passcode, clientIp);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        {
          status: authCheck.status || 401,
          headers: authCheck.retryAfterSeconds
            ? { "Retry-After": authCheck.retryAfterSeconds.toString() }
            : {},
        }
      );
    }

    const result = await executePaymentTransaction({
      invoiceId,
      actor: "human",
      hasOwnerConfirmation: hasOwnerConfirmation ?? true,
      network: "mainnet",
    });

    if (!result.success) {
      const status = result.policyDecision === "block" ? 403 : result.policyDecision === "review" ? 400 : 500;
      return NextResponse.json(
        {
          error: result.error,
          decision: result.policyDecision,
          results: result.policyResults,
          details: result.details,
        },
        { status }
      );
    }

    if (result.isIdempotent) {
      return NextResponse.json({
        message: "Idempotent response: Payment already executed for this invoice on this network.",
        payment: result.payment,
      });
    }

    const networkConfig = getNetworkConfig("mainnet");
    return NextResponse.json({
      success: true,
      network: "mainnet",
      payment: {
        id: result.payment.id,
        status: "anchored",
        txHash: result.txHash,
        anchorTxHash: result.anchorTxHash,
        network: result.payment.network,
        explorerUrl: `${networkConfig.explorerUrl}/tx/${result.txHash}`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
