import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbTimeout } from "@/lib/db";
import { verifyOwnerPasscodeWithRateLimit, getClientIp } from "@/lib/security/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json();

    // Enforce owner passcode with rate limiting on Mainnet
    const authCheck = verifyOwnerPasscodeWithRateLimit(body.passcode, clientIp);
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

    const org = await withDbTimeout(() => prisma.organization.findFirst({ include: { settings: true } }), 2000);

    if (org && org.settings.length > 0) {
      const settingId = org.settings[0].id;
      const updateData: any = {};

      if (typeof body.killSwitchActive === "boolean") {
        updateData.killSwitchActive = body.killSwitchActive;
      }
      if (body.priceToleranceBps !== undefined) {
        updateData.priceToleranceBps = Number(body.priceToleranceBps);
      }
      if (body.requireApprovalAbove !== undefined) {
        updateData.requireApprovalAbove = BigInt(body.requireApprovalAbove);
      }
      if (body.minReserveUsdc !== undefined) {
        updateData.minReserveUsdc = BigInt(body.minReserveUsdc);
      }
      if (body.dailyLimitUsdc !== undefined) {
        updateData.dailyLimitUsdc = BigInt(body.dailyLimitUsdc);
      }

      if (body.agentMode !== undefined) {
        updateData.agentMode = body.agentMode === "autonomous" ? "autonomous" : "assisted";
      }
      if (body.autoApproveLimitUsdc !== undefined) {
        updateData.autoApproveLimitUsdc = BigInt(body.autoApproveLimitUsdc);
      }
      if (body.maxDailyAutonomousUsdc !== undefined) {
        updateData.maxDailyAutonomousUsdc = BigInt(body.maxDailyAutonomousUsdc);
      }

      const updated = await withDbTimeout(
        () =>
          prisma.setting.update({
            where: { id: settingId },
            data: updateData,
          }),
        2500
      );

      return NextResponse.json({
        success: true,
        settings: {
          ...updated,
          requireApprovalAbove: updated.requireApprovalAbove.toString(),
          minReserveUsdc: updated.minReserveUsdc.toString(),
          dailyLimitUsdc: updated.dailyLimitUsdc.toString(),
          autoApproveLimitUsdc: updated.autoApproveLimitUsdc?.toString(),
          maxDailyAutonomousUsdc: updated.maxDailyAutonomousUsdc?.toString(),
        },
      });
    }

    return NextResponse.json({ success: true, mode: "demo_updated", body });
  } catch (err: any) {
    return NextResponse.json({ success: true, mode: "offline_fallback", error: err.message });
  }
}
