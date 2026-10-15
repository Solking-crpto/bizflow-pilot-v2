import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAddress } from "viem";
import { prisma, withDbTimeout } from "@/lib/db";
import { parseUsdc, formatUsdc, usdcAtomic } from "@/lib/money";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { isBlocklistedWallet } from "@/lib/security/walletBlocklist";

export const dynamic = "force-dynamic";

const BETA_HARD_CAP_USDC = usdcAtomic(BigInt(process.env.APP_MAX_PAYMENT_USDC || "25") * 1_000_000n);

const CreateSupplierSchema = z.object({
  name: z.string().min(2, "Supplier name must be at least 2 characters").max(100),
  walletAddress: z
    .string()
    .refine((val) => isAddress(val), { message: "Invalid EVM wallet address" }),
  perVendorLimitUsdc: z.string().optional().default("25.00"),
});

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Please sign in" }, { status: 401 });
    }

    const org = await getSessionOrg(session);
    if (!org) {
      return NextResponse.json({ error: "No organization found for this wallet" }, { status: 404 });
    }

    const vendors = await withDbTimeout(() =>
      prisma.vendor.findMany({
        where: { orgId: org.id },
        orderBy: { createdAt: "desc" },
      })
    );

    return NextResponse.json({
      success: true,
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
    return NextResponse.json(
      { error: error?.message || "Failed to load suppliers" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Please sign in" }, { status: 401 });
    }

    const org = await getSessionOrg(session);
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

    const { name, walletAddress, perVendorLimitUsdc } = parsed.data;
    const normalizedWallet = walletAddress.toLowerCase();

    // 1. OFAC & Security Compliance Screening
    if (isBlocklistedWallet(normalizedWallet)) {
      return NextResponse.json(
        { error: "Compliance violation: Payout wallet address failed screening." },
        { status: 400 }
      );
    }

    // 2. Parse and cap limit to Public Beta hard cap
    let limitAtomic = parseUsdc(perVendorLimitUsdc);
    if (limitAtomic > BETA_HARD_CAP_USDC) {
      limitAtomic = BETA_HARD_CAP_USDC;
    }

    // 3. Create Supplier
    const vendor = await withDbTimeout(() =>
      prisma.vendor.create({
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
    return NextResponse.json(
      { error: error?.message || "Failed to create supplier" },
      { status: 500 }
    );
  }
}
