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

    const network = getActiveNetwork();
    const isMainnet = network.mode === "mainnet";
    const isPublicSandbox =
      process.env.PUBLIC_SANDBOX === "true" || process.env.NEXT_PUBLIC_PUBLIC_SANDBOX === "true";

    if (isMainnet && isPublicSandbox) {
      return NextResponse.json(
        { error: "FATAL SECURITY REFUSAL: PUBLIC_SANDBOX cannot be enabled on Arc Mainnet!" },
        { status: 500 }
      );
    }

    if (isPublicSandbox && !isMainnet) {
      // In sandbox mode: rate limit visitor IP and cap invoice amount
      const { checkRateLimit } = await import("@/lib/security/auth");
      const rateLimitCheck = checkRateLimit(`sandbox:${clientIp}`);
      if (!rateLimitCheck.allowed) {
        return NextResponse.json(
          { error: "Sandbox rate limit reached. Please wait before testing another payment." },
          {
            status: 429,
            headers: { "Retry-After": (rateLimitCheck.retryAfterSeconds || 60).toString() },
          }
        );
      }

      // Check tiny sandbox cap (<= 0.05 USDC = 50,000 atomic)
      const { prisma } = await import("@/lib/db");
      const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (inv && inv.totalUsdc > 50000n) {
        return NextResponse.json(
          { error: "Sandbox cap exceeded: Public sandbox testing is restricted to <= 0.05 USDC." },
          { status: 403 }
        );
      }
    } else {
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
    }

    const result = await executePaymentTransaction({
      invoiceId,
      actor: isPublicSandbox && !isMainnet ? "sandbox_visitor" : "human",
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
