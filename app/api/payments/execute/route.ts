export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyOwnerPasscodeWithRateLimit, getClientIp } from "@/lib/security/auth";
import { executePaymentTransaction } from "@/lib/payments/executor";
import { getActiveNetwork } from "@/lib/networks";

const ExecutePaymentSchema = z.object({
  invoiceId: z.string(),
  hasOwnerConfirmation: z.boolean().optional(),
  passcode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json();
    const parsed = ExecutePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload", details: parsed.error }, { status: 400 });
    }

    const { invoiceId, hasOwnerConfirmation, passcode } = parsed.data;

    // Enforce owner passcode with rate limiting on Mainnet
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

    const networkConfig = getActiveNetwork();
    return NextResponse.json({
      success: true,
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
