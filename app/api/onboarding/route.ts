import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";
import { parseUsdc, usdcAtomic } from "@/lib/money";
import {
  getSessionFromRequest,
  createSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { safeDbErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

const OnboardingSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters").max(100),
  country: z.string().min(2, "Country must be at least 2 characters").max(60),
  contactEmail: z.string().email("Invalid contact email").optional().or(z.literal("")),
  websiteUrl: z.string().url("Invalid website URL").optional().or(z.literal("")),
  xUrl: z.string().optional().or(z.literal("")),
  linkedinUrl: z.string().optional().or(z.literal("")),
  publicConsent: z.boolean().optional().default(false),
  settings: z
    .object({
      priceToleranceBps: z.number().min(0).max(1000).optional().default(100), // 1.00%
      requireApprovalAbove: z.string().optional().default("5.00"),
      minReserveUsdc: z.string().optional().default("2.00"),
      dailyLimitUsdc: z.string().optional().default("25.00"),
      autoApproveLimitUsdc: z.string().optional().default("0.50"),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const netCtx = validateApiNetwork(req);
    if (!netCtx.success) return netCtx.response;
    const { network, db } = netCtx;

    const session = getSessionFromRequest(req);
    if (!session || !session.address) {
      return NextResponse.json(
        { error: "Authentication required: Please connect your Web3 wallet and sign in." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = OnboardingSchema.safeParse(body);
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

    const {
      name,
      country,
      contactEmail,
      websiteUrl,
      xUrl,
      linkedinUrl,
      publicConsent,
      settings,
    } = parsed.data;

    const normalizedAddress = session.address.toLowerCase();

    // 1. Calculate governance limits capped by Public Beta safety limits
    let autoApproveAtomic = parseUsdc(settings?.autoApproveLimitUsdc || "0.50");
    if (autoApproveAtomic > betaHardCapUsdc) {
      autoApproveAtomic = betaHardCapUsdc;
    }

    const requireApprovalAtomic = parseUsdc(settings?.requireApprovalAbove || "5.00");
    const minReserveAtomic = parseUsdc(settings?.minReserveUsdc || "2.00");
    const dailyLimitAtomic = parseUsdc(settings?.dailyLimitUsdc || "25.00");
    const toleranceBps = settings?.priceToleranceBps ?? 100;

    // 2. Upsert Organization for this wallet in the target network's schema
    const existingOrg = await withDbTimeout(() =>
      db.organization.findFirst({
        where: { walletAddress: { equals: normalizedAddress, mode: "insensitive" } },
        include: { settings: true },
      })
    );

    let orgId: string;
    let createdOrUpdatedOrg: any;

    if (existingOrg) {
      orgId = existingOrg.id;
      createdOrUpdatedOrg = await withDbTimeout(() =>
        db.organization.update({
          where: { id: existingOrg.id },
          data: {
            name: name.trim(),
            country: country.trim(),
            contactEmail: contactEmail ? contactEmail.trim() : null,
            websiteUrl: websiteUrl ? websiteUrl.trim() : null,
            xUrl: xUrl ? xUrl.trim() : null,
            linkedinUrl: linkedinUrl ? linkedinUrl.trim() : null,
            publicConsent: Boolean(publicConsent),
          },
        })
      );

      // Update or create settings
      if (existingOrg.settings.length > 0) {
        await withDbTimeout(() =>
          db.setting.update({
            where: { id: existingOrg.settings[0].id },
            data: {
              priceToleranceBps: toleranceBps,
              requireApprovalAbove: requireApprovalAtomic,
              minReserveUsdc: minReserveAtomic,
              dailyLimitUsdc: dailyLimitAtomic,
              autoApproveLimitUsdc: autoApproveAtomic,
            },
          })
        );
      } else {
        await withDbTimeout(() =>
          db.setting.create({
            data: {
              orgId: existingOrg.id,
              killSwitchActive: false,
              priceToleranceBps: toleranceBps,
              requireApprovalAbove: requireApprovalAtomic,
              minReserveUsdc: minReserveAtomic,
              dailyLimitUsdc: dailyLimitAtomic,
              autoApproveLimitUsdc: autoApproveAtomic,
            },
          })
        );
      }
    } else {
      createdOrUpdatedOrg = await withDbTimeout(() =>
        db.organization.create({
          data: {
            name: name.trim(),
            country: country.trim(),
            contactEmail: contactEmail ? contactEmail.trim() : null,
            websiteUrl: websiteUrl ? websiteUrl.trim() : null,
            xUrl: xUrl ? xUrl.trim() : null,
            linkedinUrl: linkedinUrl ? linkedinUrl.trim() : null,
            currency: "USDC",
            walletAddress: normalizedAddress,
            publicConsent: Boolean(publicConsent),
            members: {
              create: {
                walletAddress: normalizedAddress,
                email: contactEmail ? contactEmail.trim() : null,
                role: "owner",
              },
            },
            settings: {
              create: {
                killSwitchActive: false,
                priceToleranceBps: toleranceBps,
                requireApprovalAbove: requireApprovalAtomic,
                minReserveUsdc: minReserveAtomic,
                dailyLimitUsdc: dailyLimitAtomic,
                autoApproveLimitUsdc: autoApproveAtomic,
                maxDailyAutonomousUsdc: autoApproveAtomic * 2n,
              },
            },
          },
        })
      );
      orgId = createdOrUpdatedOrg.id;
    }

    // 3. Issue refreshed session token containing newly bound orgId
    const newSessionToken = createSessionToken({
      address: normalizedAddress,
      orgId,
      role: "owner",
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    const response = NextResponse.json({
      success: true,
      message: `Organization "${name}" successfully registered for ${normalizedAddress} on ${network}.`,
      network,
      org: {
        id: orgId,
        name: createdOrUpdatedOrg.name,
        currency: createdOrUpdatedOrg.currency,
        walletAddress: normalizedAddress,
        country: createdOrUpdatedOrg.country,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: newSessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error: any) {
    return safeDbErrorResponse(error);
  }
}
