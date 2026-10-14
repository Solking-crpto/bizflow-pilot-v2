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

    // 2. Check Owner Passcode if not already authorized via cron
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
