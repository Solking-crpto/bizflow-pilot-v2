export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyOwnerPasscodeWithRateLimit, getClientIp } from "@/lib/security/auth";
import { runAutonomousAgentLoop } from "@/lib/agent/runner";

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const authHeader = req.headers.get("authorization");

    let isAuthorized = false;

    // 1. Check CRON_SECRET bearer token (Vercel Cron)
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      const expectedSecret = process.env.CRON_SECRET;
      if (expectedSecret && token === expectedSecret) {
        isAuthorized = true;
      }
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body allowed if cron bearer token provided
    }

    const isMainnet = (process.env.NEXT_PUBLIC_NETWORK_MODE || process.env.NETWORK_MODE) === "mainnet";
    const isPublicSandbox =
      process.env.PUBLIC_SANDBOX === "true" || process.env.NEXT_PUBLIC_PUBLIC_SANDBOX === "true";

    if (isMainnet && isPublicSandbox) {
      return NextResponse.json(
        { error: "FATAL SECURITY REFUSAL: PUBLIC_SANDBOX cannot be enabled on Arc Mainnet!" },
        { status: 500 }
      );
    }

    // 2. Check Sandbox Authorization on Testnet
    if (!isAuthorized && isPublicSandbox && !isMainnet) {
      const { checkRateLimit } = await import("@/lib/security/auth");
      const rateLimitCheck = checkRateLimit(`sandbox_agent:${clientIp}`);
      if (!rateLimitCheck.allowed) {
        return NextResponse.json(
          { error: "Sandbox rate limit reached. Please wait before running the agent again." },
          {
            status: 429,
            headers: { "Retry-After": (rateLimitCheck.retryAfterSeconds || 60).toString() },
          }
        );
      }
      isAuthorized = true;
    }

    // 3. Check Owner Passcode if not already authorized via cron or sandbox
    if (!isAuthorized) {
      const passcode = body?.passcode;
      const authCheck = verifyOwnerPasscodeWithRateLimit(passcode, clientIp);
      if (!authCheck.authorized) {
        return NextResponse.json(
          { error: authCheck.error || "Unauthorized: Valid owner passcode or CRON_SECRET required." },
          {
            status: authCheck.status || 401,
            headers: authCheck.retryAfterSeconds
              ? { "Retry-After": authCheck.retryAfterSeconds.toString() }
              : {},
          }
        );
      }
      isAuthorized = true;
    }

    // Execute the autonomous loop
    const dryRun = process.env.DRY_RUN === "true" || !!body?.dryRun;
    const result = await runAutonomousAgentLoop({
      orgId: body?.orgId,
      dryRun,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error("Agent run error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to execute autonomous agent loop" },
      { status: 500 }
    );
  }
}
