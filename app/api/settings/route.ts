import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbTimeout } from "@/lib/db";
import { verifyOwnerPasscodeWithRateLimit, getClientIp } from "@/lib/security/auth";
import { getSessionFromRequest, getSessionOrg, isAdminWallet } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const BETA_HARD_CAP_USDC = BigInt(process.env.APP_MAX_PAYMENT_USDC || "25") * 1_000_000n; // 25 USDC = 25,000,000 atomic

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json();
    const session = getSessionFromRequest(req);

    let targetOrg: any = null;

    if (session) {
      // Authenticated via SIWE wallet session
      targetOrg = await getSessionOrg(session);
      if (!targetOrg) {
        return NextResponse.json(
          { error: "No organization associated with this wallet. Please complete business onboarding first." },
          { status: 404 }
        );
      }

      // IDOR protection: if orgId is explicitly passed, it MUST match the session's orgId
      if (body.orgId && body.orgId !== targetOrg.id) {
        return NextResponse.json(
          { error: "Forbidden: Cross-organization modification is strictly prohibited." },
          { status: 403 }
        );
      }
    } else {
      // Fallback to owner passcode (builder admin operations only)
      const authCheck = verifyOwnerPasscodeWithRateLimit(body.passcode, clientIp);
      if (!authCheck.authorized) {
        return NextResponse.json(
          { error: "Authentication required: Please sign in with your wallet or provide the owner passcode." },
          {
            status: authCheck.status || 401,
            headers: authCheck.retryAfterSeconds
              ? { "Retry-After": authCheck.retryAfterSeconds.toString() }
              : {},
          }
        );
      }

      targetOrg = await withDbTimeout(
        () => prisma.organization.findFirst({ include: { settings: true } }),
        2000
      );
    }

    if (!targetOrg) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    let setting = targetOrg.settings?.[0];
    if (!setting) {
      // Create initial settings if missing
      setting = await withDbTimeout(() =>
        prisma.setting.create({
          data: {
            orgId: targetOrg.id,
            killSwitchActive: false,
            priceToleranceBps: 100,
            requireApprovalAbove: 5_000_000n, // 5 USDC
            minReserveUsdc: 2_000_000n, // 2 USDC
            dailyLimitUsdc: 25_000_000n, // 25 USDC
            agentMode: "assisted",
            autoApproveLimitUsdc: 500_000n, // 0.50 USDC
            maxDailyAutonomousUsdc: 1_000_000n, // 1.00 USDC
          },
        })
      );
    }

    const updateData: any = {};

    if (typeof body.killSwitchActive === "boolean") {
      updateData.killSwitchActive = body.killSwitchActive;
    }
    if (body.priceToleranceBps !== undefined) {
      updateData.priceToleranceBps = Math.min(Math.max(Number(body.priceToleranceBps), 0), 1000); // 0% to 10%
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
      let requested = BigInt(body.autoApproveLimitUsdc);
      // Public Beta enforcement: limit cannot exceed APP_MAX_PAYMENT_USDC
      if (requested > BETA_HARD_CAP_USDC) {
        requested = BETA_HARD_CAP_USDC;
      }
      updateData.autoApproveLimitUsdc = requested;
    }

    if (body.maxDailyAutonomousUsdc !== undefined) {
      let requestedDaily = BigInt(body.maxDailyAutonomousUsdc);
      if (requestedDaily > BETA_HARD_CAP_USDC * 2n) {
        requestedDaily = BETA_HARD_CAP_USDC * 2n;
      }
      updateData.maxDailyAutonomousUsdc = requestedDaily;
    }

    const updated = await withDbTimeout(
      () =>
        prisma.setting.update({
          where: { id: setting.id },
          data: updateData,
        }),
      2500
    );

    return NextResponse.json({
      success: true,
      orgId: targetOrg.id,
      settings: {
        ...updated,
        requireApprovalAbove: updated.requireApprovalAbove.toString(),
        minReserveUsdc: updated.minReserveUsdc.toString(),
        dailyLimitUsdc: updated.dailyLimitUsdc.toString(),
        autoApproveLimitUsdc: updated.autoApproveLimitUsdc?.toString(),
        maxDailyAutonomousUsdc: updated.maxDailyAutonomousUsdc?.toString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update settings" }, { status: 500 });
  }
}
