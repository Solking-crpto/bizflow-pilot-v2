import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { evaluatePolicy, PolicyContext } from "@/lib/policy/engine";
import { getNetworkConfig } from "@/lib/networks";
import { getClientIp, checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { safeDbErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

const CreateIntentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  ownerOverrideReason: z.string().optional(),
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
    const rlIp = checkRateLimit(`payment:intent:ip:${ip}`, 30, 60_000);
    if (!rlIp.allowed) return rateLimitExceededResponse(rlIp.retryAfterSeconds);

    const rlWallet = checkRateLimit(`payment:intent:wallet:${session.address}`, 20, 60_000);
    if (!rlWallet.allowed) return rateLimitExceededResponse(rlWallet.retryAfterSeconds);

    const org = await getSessionOrg(session, network);
    if (!org) {
      return NextResponse.json({ error: "No organization found for this wallet" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = CreateIntentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error }, { status: 400 });
    }

    const { invoiceId, ownerOverrideReason } = parsed.data;

    // 1. Fetch invoice and verify organization ownership (IDOR check)
    const invoice = await withDbTimeout(
      () =>
        db.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            vendor: true,
            deliveryRequests: {
              include: { reports: true },
              orderBy: { createdAt: "desc" },
            },
            purchaseOrder: {
              include: {
                deliveryRequests: {
                  include: { reports: true },
                  orderBy: { createdAt: "desc" },
                },
              },
            },
            organization: {
              include: { settings: true },
            },
          },
        }),
      30000
    );

    if (!invoice || invoice.orgId !== org.id) {
      return NextResponse.json({ error: "Invoice not found or access denied" }, { status: 404 });
    }

    if (invoice.status === "paid") {
      return NextResponse.json({ error: "Invoice is already paid and settled" }, { status: 400 });
    }

    const networkConfig = getNetworkConfig(network);
    const settings = invoice.organization.settings[0] || {
      killSwitchActive: false,
      priceToleranceBps: 100,
      requireApprovalAbove: 25_000_000n,
      minReserveUsdc: 2_000_000n,
      dailyLimitUsdc: 25_000_000n,
    };

    // 2. Calculate daily payment total for this org
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const todaysPayments = await withDbTimeout(() =>
      db.payment.findMany({
        where: {
          orgId: org.id,
          status: "confirmed",
          confirmedAt: { gte: startOfDay },
        },
        select: { amountAtomic: true },
      })
    );

    const dailySpentUsdc = todaysPayments.reduce(
      (sum, p) => sum + usdcAtomic(p.amountAtomic),
      0n
    );

    const maxCapEnv =
      network === "mainnet"
        ? process.env.APP_MAX_PAYMENT_USDC || "25"
        : process.env.APP_MAX_PAYMENT_USDC_TESTNET || "100";

    const latestDeliveryReq =
      invoice.deliveryRequests?.[0] || invoice.purchaseOrder?.deliveryRequests?.[0];
    const deliveryStatus = latestDeliveryReq?.status || "none";
    const deliveryConditionsMet =
      deliveryStatus === "approved" || latestDeliveryReq?.reports?.[0]?.overall === "ready";

    // 3. Re-evaluate corporate deterministic policy at intent creation
    const policyContext: PolicyContext = {
      network,
      killSwitchActive: settings.killSwitchActive,
      availableTreasuryUsdc: usdcAtomic(100_000_000_000n), // Non-custodial: user wallet holds funds
      minReserveUsdc: usdcAtomic(settings.minReserveUsdc || 0n),
      dailySpentUsdc: usdcAtomic(dailySpentUsdc),
      dailyLimitUsdc: usdcAtomic(settings.dailyLimitUsdc || 25_000_000n),
      approvalThresholdUsdc: usdcAtomic(settings.requireApprovalAbove || 25_000_000n),
      maxMainnetPaymentUsdc: usdcAtomic(BigInt(maxCapEnv) * 1_000_000n),
      hasOwnerConfirmation: true, // Signed-in wallet user is confirming
      vendor: {
        id: invoice.vendor.id,
        name: invoice.vendor.name,
        status: invoice.vendor.status,
        recordedWallet: invoice.vendor.walletAddress,
        perVendorLimitUsdc: usdcAtomic(invoice.vendor.perVendorLimitUsdc),
        walletCooldownUntil: invoice.vendor.walletCooldownUntil,
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalUsdc: usdcAtomic(invoice.totalUsdc),
        remittanceWallet: invoice.vendor.walletAddress,
        matchStatus: invoice.matchStatus,
        duplicateScore: invoice.duplicateScore,
        isInjectionSuspect: invoice.isInjectionSuspect,
        isHumanApproved: true,
        deliveryProofMode: invoice.deliveryProofMode || "off",
        deliveryStatus,
        deliveryConditionsMet,
        deliveryRequestId: latestDeliveryReq?.id,
        ownerOverrideReason,
      },
    };

    const policyOutput = evaluatePolicy(policyContext);

    // If policy engine returns block, or returns review without owner approval
    if (policyOutput.decision === "block") {
      return NextResponse.json(
        {
          allowed: false,
          decision: policyOutput.decision,
          error: "Deterministic policy engine blocked this payment intent",
          reasons: policyOutput.results.filter((r) => !r.passed).map((r) => r.reason),
          results: policyOutput.results,
        },
        { status: 403 }
      );
    }

    // 4. Create verified PaymentIntent with 15-minute expiration
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const intent = await withDbTimeout(() =>
      db.paymentIntent.create({
        data: {
          orgId: org.id,
          invoiceId: invoice.id,
          vendorId: invoice.vendorId,
          payerAddress: session.address.toLowerCase(),
          recipientAddress: invoice.vendor.walletAddress.toLowerCase(),
          amountAtomic: invoice.totalUsdc,
          tokenAddress: networkConfig.usdcAddress.toLowerCase(),
          chainId: networkConfig.chainId,
          expiresAt,
          status: "pending",
          isOverridden: !!ownerOverrideReason,
          overrideReason: ownerOverrideReason || null,
        },
      })
    );

    return NextResponse.json({
      allowed: true,
      network,
      intent: {
        id: intent.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        supplierName: invoice.vendor.name,
        recipientAddress: invoice.vendor.walletAddress,
        tokenAddress: networkConfig.usdcAddress,
        chainId: networkConfig.chainId,
        networkName: networkConfig.name,
        explorerUrl: networkConfig.explorerUrl,
        amountAtomic: invoice.totalUsdc.toString(),
        amountFormatted: formatUsdc(usdcAtomic(invoice.totalUsdc)),
        expiresAt: expiresAt.toISOString(),
      },
      policy: {
        decision: policyOutput.decision,
        summary: policyOutput.summary,
        decisionHash: policyOutput.decisionHash,
      },
    });
  } catch (error: any) {
    return safeDbErrorResponse(error);
  }
}
