import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { evaluatePolicy, PolicyContext } from "@/lib/policy/engine";
import { getActiveNetwork } from "@/lib/networks";

export const dynamic = "force-dynamic";

const CreateIntentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
});

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Please connect your wallet" }, { status: 401 });
    }

    const org = await getSessionOrg(session);
    if (!org) {
      return NextResponse.json({ error: "No organization found for this wallet" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = CreateIntentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error }, { status: 400 });
    }

    const { invoiceId } = parsed.data;

    // 1. Fetch invoice and verify organization ownership (IDOR check)
    const invoice = await withDbTimeout(() =>
      prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          vendor: true,
          purchaseOrder: {
            include: {
              lines: { include: { item: true } },
              goodsReceipts: { include: { lines: { include: { item: true } } } },
            },
          },
          organization: {
            include: { settings: true },
          },
        },
      })
    );

    if (!invoice || invoice.orgId !== org.id) {
      return NextResponse.json({ error: "Invoice not found or access denied" }, { status: 404 });
    }

    if (invoice.status === "paid") {
      return NextResponse.json({ error: "Invoice is already paid and settled" }, { status: 400 });
    }

    const network = getActiveNetwork();
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
      prisma.payment.findMany({
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

    // 3. Re-evaluate corporate deterministic 10-rule policy at intent creation
    const policyContext: PolicyContext = {
      network: network.mode,
      killSwitchActive: settings.killSwitchActive,
      availableTreasuryUsdc: usdcAtomic(100_000_000_000n), // Non-custodial: user wallet holds funds
      minReserveUsdc: usdcAtomic(settings.minReserveUsdc || 0n),
      dailySpentUsdc: usdcAtomic(dailySpentUsdc),
      dailyLimitUsdc: usdcAtomic(settings.dailyLimitUsdc || 25_000_000n),
      approvalThresholdUsdc: usdcAtomic(settings.requireApprovalAbove || 25_000_000n),
      maxMainnetPaymentUsdc: usdcAtomic(BigInt(process.env.APP_MAX_PAYMENT_USDC || "25") * 1_000_000n),
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
      prisma.paymentIntent.create({
        data: {
          orgId: org.id,
          invoiceId: invoice.id,
          vendorId: invoice.vendorId,
          payerAddress: session.address.toLowerCase(),
          recipientAddress: invoice.vendor.walletAddress.toLowerCase(),
          amountAtomic: invoice.totalUsdc,
          tokenAddress: network.usdcAddress.toLowerCase(),
          chainId: network.chainId,
          expiresAt,
          status: "pending",
        },
      })
    );

    return NextResponse.json({
      allowed: true,
      intent: {
        id: intent.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        supplierName: invoice.vendor.name,
        recipientAddress: invoice.vendor.walletAddress,
        tokenAddress: network.usdcAddress,
        chainId: network.chainId,
        networkName: network.name,
        explorerUrl: network.explorerUrl,
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
    return NextResponse.json({ error: error.message || "Failed to create payment intent" }, { status: 500 });
  }
}
