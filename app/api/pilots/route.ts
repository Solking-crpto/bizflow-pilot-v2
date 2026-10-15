import { NextRequest, NextResponse } from "next/server";
import { withDbTimeout } from "@/lib/db";
import { verifyOwnerPasscodeWithRateLimit, getClientIp } from "@/lib/security/auth";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { getSessionFromRequest, isAdminWallet } from "@/lib/auth/session";
import { validateApiNetwork } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const apiCheck = validateApiNetwork(req);
    if (apiCheck.errorResponse) return apiCheck.errorResponse;
    const { db } = apiCheck;

    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get("all") === "true";
    const passcode = req.headers.get("x-owner-passcode") || searchParams.get("passcode") || "";
    const clientIp = getClientIp(req);
    const session = getSessionFromRequest(req);

    let isAuthorizedAdmin = false;
    if (session && isAdminWallet(session.address)) {
      isAuthorizedAdmin = true;
    } else if (showAll && passcode) {
      const authCheck = verifyOwnerPasscodeWithRateLimit(passcode, clientIp);
      if (authCheck.authorized) {
        isAuthorizedAdmin = true;
      }
    }

    // Public view lists ONLY organizations where publicConsent=true
    const whereClause: any = isAuthorizedAdmin && showAll ? {} : { publicConsent: true };

    const orgs = await withDbTimeout(() =>
      db.organization.findMany({
        where: whereClause,
        include: {
          invoices: {
            select: {
              id: true,
              totalUsdc: true,
              status: true,
              duplicateScore: true,
              isInjectionSuspect: true,
            },
          },
          payments: {
            where: { status: "confirmed" },
            select: {
              id: true,
              amountAtomic: true,
              txHash: true,
              confirmedAt: true,
            },
          },
          agentDecisions: {
            select: {
              id: true,
              choice: true,
              outcome: true,
              escalated: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    );

    const serialized = orgs.map((org) => {
      const totalVolumeAtomic = org.payments.reduce(
        (sum, p) => sum + BigInt(p.amountAtomic.toString()),
        0n
      );
      const autoExecutedCount = org.agentDecisions.filter((d) => d.outcome === "executed").length;
      const escalatedCount = org.agentDecisions.filter((d) => d.escalated).length;
      const duplicatesCaught = org.invoices.filter((i) => i.duplicateScore >= 50).length;
      const injectionsBlocked = org.invoices.filter((i) => i.isInjectionSuspect).length;

      return {
        id: org.id,
        name: org.name,
        currency: org.currency,
        isPilot: org.isPilot,
        websiteUrl: org.websiteUrl,
        xUrl: org.xUrl,
        linkedinUrl: org.linkedinUrl,
        publicConsent: org.publicConsent,
        createdAt: org.createdAt.toISOString(),
        treasuryModel: "builder-operated treasury, funded by the business",
        metrics: {
          invoicesCount: org.invoices.length,
          paymentVolumeFormatted: org.payments.length > 0 ? formatUsdc(usdcAtomic(totalVolumeAtomic)) : "0.00 USDC",
          confirmedPaymentsCount: org.payments.length,
          decisionsCount: org.agentDecisions.length,
          autoExecutedCount,
          escalatedCount,
          threatsBlocked: duplicatesCaught + injectionsBlocked,
          recentSettlements: org.payments.slice(0, 3).map((p) => ({
            id: p.id,
            amount: formatUsdc(usdcAtomic(p.amountAtomic)),
            txHash: p.txHash,
            confirmedAt: p.confirmedAt ? p.confirmedAt.toISOString() : null,
          })),
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: serialized,
      isAdminView: isAuthorizedAdmin && showAll,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve pilot organizations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiCheck = validateApiNetwork(req);
    if (apiCheck.errorResponse) return apiCheck.errorResponse;
    const { db } = apiCheck;

    const clientIp = getClientIp(req);
    const body = await req.json();
    const session = getSessionFromRequest(req);

    const isAuthorizedAdmin = session && isAdminWallet(session.address);
    if (!isAuthorizedAdmin) {
      const authCheck = verifyOwnerPasscodeWithRateLimit(body.passcode, clientIp);
      if (!authCheck.authorized) {
        return NextResponse.json(
          { success: false, error: authCheck.error },
          { status: authCheck.status || 401 }
        );
      }
    }

    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Organization business name is required." },
        { status: 400 }
      );
    }

    const org = await withDbTimeout(() =>
      db.organization.create({
        data: {
          name: body.name.trim(),
          currency: "USDC",
          isPilot: body.isPilot !== undefined ? Boolean(body.isPilot) : true,
          websiteUrl: body.websiteUrl?.trim() || null,
          xUrl: body.xUrl?.trim() || null,
          linkedinUrl: body.linkedinUrl?.trim() || null,
          publicConsent: Boolean(body.publicConsent),
          settings: {
            create: {
              killSwitchActive: false,
              priceToleranceBps: 100,
              requireApprovalAbove: 1000000n, // 1.00 USDC
              minReserveUsdc: 250000n, // 0.25 USDC
              dailyLimitUsdc: 2000000n, // 2.00 USDC
              agentMode: "autonomous",
              autoApproveLimitUsdc: 500000n, // 0.50 USDC
              maxDailyAutonomousUsdc: 1000000n, // 1.00 USDC
            },
          },
        },
        include: {
          settings: true,
        },
      })
    );

    return NextResponse.json({
      success: true,
      message: `Pilot organization "${org.name}" created successfully.`,
      data: org,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create pilot organization" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const apiCheck = validateApiNetwork(req);
    if (apiCheck.errorResponse) return apiCheck.errorResponse;
    const { db } = apiCheck;

    const clientIp = getClientIp(req);
    const body = await req.json();
    const session = getSessionFromRequest(req);

    const isAuthorizedAdmin = session && isAdminWallet(session.address);
    if (!isAuthorizedAdmin) {
      const authCheck = verifyOwnerPasscodeWithRateLimit(body.passcode, clientIp);
      if (!authCheck.authorized) {
        return NextResponse.json(
          { success: false, error: authCheck.error },
          { status: authCheck.status || 401 }
        );
      }
    }

    if (!body.orgId) {
      return NextResponse.json(
        { success: false, error: "orgId is required." },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (typeof body.name === "string" && body.name.trim()) updateData.name = body.name.trim();
    if (typeof body.isPilot === "boolean") updateData.isPilot = body.isPilot;
    if (typeof body.publicConsent === "boolean") updateData.publicConsent = body.publicConsent;
    if (body.websiteUrl !== undefined) updateData.websiteUrl = body.websiteUrl ? body.websiteUrl.trim() : null;
    if (body.xUrl !== undefined) updateData.xUrl = body.xUrl ? body.xUrl.trim() : null;
    if (body.linkedinUrl !== undefined) updateData.linkedinUrl = body.linkedinUrl ? body.linkedinUrl.trim() : null;

    const updated = await withDbTimeout(() =>
      db.organization.update({
        where: { id: body.orgId },
        data: updateData,
      })
    );

    return NextResponse.json({
      success: true,
      message: `Organization "${updated.name}" updated successfully.`,
      data: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update organization" },
      { status: 500 }
    );
  }
}
