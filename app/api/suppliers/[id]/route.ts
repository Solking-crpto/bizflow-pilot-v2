import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAddress } from "viem";
import { prisma, withDbTimeout } from "@/lib/db";
import { parseUsdc, formatUsdc, usdcAtomic } from "@/lib/money";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { isBlocklistedWallet } from "@/lib/security/walletBlocklist";

export const dynamic = "force-dynamic";

const BETA_HARD_CAP_USDC = usdcAtomic(BigInt(process.env.APP_MAX_PAYMENT_USDC || "25") * 1_000_000n);

const UpdateSupplierSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  walletAddress: z
    .string()
    .refine((val) => isAddress(val), { message: "Invalid EVM wallet address" })
    .optional(),
  perVendorLimitUsdc: z.string().optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getSessionOrg(session);
    if (!org) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const vendor = await withDbTimeout(() =>
      prisma.vendor.findUnique({
        where: { id: params.id },
      })
    );

    if (!vendor || vendor.orgId !== org.id) {
      return NextResponse.json(
        { error: "Supplier not found or access forbidden" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      supplier: {
        id: vendor.id,
        name: vendor.name,
        walletAddress: vendor.walletAddress,
        status: vendor.status,
        perVendorLimitUsdc: formatUsdc(usdcAtomic(vendor.perVendorLimitUsdc)),
        walletCooldownUntil: vendor.walletCooldownUntil?.toISOString() || null,
        createdAt: vendor.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getSessionOrg(session);
    if (!org) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const vendor = await withDbTimeout(() =>
      prisma.vendor.findUnique({
        where: { id: params.id },
      })
    );

    if (!vendor || vendor.orgId !== org.id) {
      return NextResponse.json(
        { error: "Supplier not found or access forbidden" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = UpdateSupplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (parsed.data.name) updateData.name = parsed.data.name.trim();
    if (parsed.data.status) updateData.status = parsed.data.status;

    if (parsed.data.perVendorLimitUsdc) {
      let limit = parseUsdc(parsed.data.perVendorLimitUsdc);
      if (limit > BETA_HARD_CAP_USDC) limit = BETA_HARD_CAP_USDC;
      updateData.perVendorLimitUsdc = limit;
    }

    // Cooldown enforcement on wallet updates
    if (parsed.data.walletAddress) {
      const newWallet = parsed.data.walletAddress.toLowerCase();
      if (newWallet !== vendor.walletAddress.toLowerCase()) {
        if (isBlocklistedWallet(newWallet)) {
          return NextResponse.json(
            { error: "Compliance violation: New payout wallet failed screening." },
            { status: 400 }
          );
        }

        // Apply 24h cooldown security rule
        const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        updateData.walletAddress = newWallet;
        updateData.walletUpdatedAt = new Date();
        updateData.walletCooldownUntil = cooldownUntil;
        updateData.status = "pending_cooldown";
      }
    }

    const updated = await withDbTimeout(() =>
      prisma.vendor.update({
        where: { id: vendor.id },
        data: updateData,
      })
    );

    return NextResponse.json({
      success: true,
      supplier: {
        id: updated.id,
        name: updated.name,
        walletAddress: updated.walletAddress,
        status: updated.status,
        perVendorLimitUsdc: formatUsdc(usdcAtomic(updated.perVendorLimitUsdc)),
        walletCooldownUntil: updated.walletCooldownUntil?.toISOString() || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
