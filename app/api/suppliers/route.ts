import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAddress } from "viem";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";
import { parseUsdc, formatUsdc, usdcAtomic } from "@/lib/money";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { isBlocklistedWallet } from "@/lib/security/walletBlocklist";
import { getClientIp, checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { safeDbErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

const CreateSupplierSchema = z.object({
  name: z.string().min(2, "Supplier name must be at least 2 characters").max(100),
  walletAddress: z
    .string()
    .refine((val) => isAddress(val), { message: "Invalid EVM wallet address" }),
  perVendorLimitUsdc: z.string().optional().default("25.00"),
});

export async function GET(req: NextRequest) {
  try {
    const netCtx = validateApiNetwork(req);
    if (!netCtx.success) return netCtx.response;
    const { network, db } = netCtx;

    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Please sign in" }, { status: 401 });
    }

    const org = await getSessionOrg(session, network);
    if (!org) {
      return NextResponse.json({ error: "No organization found for this wallet" }, { status: 404 });
    }

    const vendors = await withDbTimeout(() =>
      db.vendor.findMany({
        where: { orgId: org.id },
        orderBy: { createdAt: "desc" },
      })
    );

    return NextResponse.json({
      success: true,
      network,
      suppliers: vendors.map((v) => ({
        id: v.id,
        name: v.name,
        walletAddress: v.walletAddress,
        status: v.status,
        perVendorLimitUsdc: formatUsdc(usdcAtomic(v.perVendorLimitUsdc)),
        walletCooldownUntil: v.walletCooldownUntil ? v.walletCooldownUntil.toISOString() : null,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    return safeDbErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const netCtx = validateApiNetwork(req);
    if (!netCtx.success) return netCtx.response;
    const { network, db } = netCtx;

    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Please sign in" }, { status: 401 });
    }

    const ip = getClientIp(req);
    const rlIp = checkRateLimit(`supplier:create:ip:${ip}`, 30, 60_000);
    if (!rlIp.allowed) return rateLimitExceededResponse(rlIp.retryAfterSeconds);

    const org = await getSessionOrg(session, network);
    if (!org) {
      return NextResponse.json({ error: "No organization found for this wallet" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = CreateSupplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const maxPaymentEnv =
      network === "mainnet"
        ? process.env.APP_MAX_PAYMENT_USDC || "25"
        : process.env.APP_MAX_PAYMENT_USDC_TESTNET || "100";
    const betaHardCapUsdc = usdcAtomic(BigInt(maxPaymentEnv) * 1_000_000n);

    const { name, walletAddress, perVendorLimitUsdc } = parsed.data;
    const normalizedWallet = walletAddress.toLowerCase();

    // 1. Blocked-Address Screening (known public test wallets; not an official regulatory sanctions screen)
    if (isBlocklistedWallet(normalizedWallet)) {
      return NextResponse.json(
        { error: "Compliance violation: Payout wallet address failed screening." },
        { status: 400 }
      );
    }

    // 2. Parse and cap limit to Public Beta hard cap
    let limitAtomic = parseUsdc(perVendorLimitUsdc);
    if (limitAtomic > betaHardCapUsdc) {
      limitAtomic = betaHardCapUsdc;
    }

    // 3. Create Supplier
    const vendor = await withDbTimeout(() =>
      db.vendor.create({
        data: {
          orgId: org.id,
          name: name.trim(),
          walletAddress: normalizedWallet,
          perVendorLimitUsdc: limitAtomic,
          status: "active",
        },
      })
    );

    return NextResponse.json({
      success: true,
      network,
      supplier: {
        id: vendor.id,
        name: vendor.name,
        walletAddress: vendor.walletAddress,
        status: vendor.status,
        perVendorLimitUsdc: formatUsdc(usdcAtomic(vendor.perVendorLimitUsdc)),
        createdAt: vendor.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    return safeDbErrorResponse(error);
  }
}
