import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";
import { getClientIp, checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`auth:nonce:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return rateLimitExceededResponse(rl.retryAfterSeconds);
  }

  try {
    const apiCheck = validateApiNetwork(req);
    if (apiCheck.errorResponse) return apiCheck.errorResponse;
    const { db } = apiCheck;

    const nonce = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Asynchronously cleanup expired nonces
    withDbTimeout(() =>
      db.authNonce.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      })
    ).catch(() => {});

    // Save active nonce
    await withDbTimeout(() =>
      db.authNonce.create({
        data: {
          nonce,
          expiresAt,
        },
      })
    );

    return NextResponse.json({ nonce }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to generate authentication nonce" },
      { status: 500 }
    );
  }
}
