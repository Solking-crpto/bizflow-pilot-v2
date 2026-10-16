import { NextRequest, NextResponse } from "next/server";
import { createStatelessNonce, AUTH_NONCE_COOKIE_NAME } from "@/lib/auth/stateless-nonce";
import { getClientIp, checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`auth:nonce:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return rateLimitExceededResponse(rl.retryAfterSeconds);
  }

  try {
    const { nonce, cookieValue, expiresAt } = createStatelessNonce();

    const response = NextResponse.json({ nonce, expiresAt }, { status: 200 });

    // Set signed httpOnly cookie for 5 minutes (single-use validation on verify)
    response.cookies.set(AUTH_NONCE_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 300, // 5 minutes
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to generate authentication nonce" },
      { status: 500 }
    );
  }
}
