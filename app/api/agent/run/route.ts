export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { runAutonomousAgentLoop } from "@/lib/agent/runner";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    let isAuthorized = false;

    // 1. Check CRON_SECRET bearer token (e.g. Vercel Cron)
    if (authHeader) {
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        const expectedSecret = process.env.CRON_SECRET?.trim();
        if (!expectedSecret || token.length === 0 || token !== expectedSecret) {
          return NextResponse.json(
            { error: "Unauthorized: Invalid or unconfigured CRON_SECRET." },
            { status: 401 }
          );
        }
        isAuthorized = true;
      } else {
        return NextResponse.json(
          { error: "Unauthorized: Malformed Authorization header. Expected 'Bearer <token>'." },
          { status: 401 }
        );
      }
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body allowed if cron bearer token provided
    }

    // 2. If not authenticated via CRON_SECRET, require owner passcode
    if (!isAuthorized) {
      const passcode = body?.passcode;
      const expectedPasscode = process.env.OWNER_PASSCODE;
      if (!expectedPasscode || !passcode || passcode !== expectedPasscode) {
        return NextResponse.json(
          { error: "Unauthorized: Valid owner passcode or CRON_SECRET required." },
          { status: 401 }
        );
      }
      isAuthorized = true;
    }

    // Requirement A.7: The autonomous cron job runs Mainnet only
    const cookieNet = req.cookies.get("bizflow_network")?.value;
    const headerNet = req.headers.get("x-bizflow-network");
    const targetNetwork = headerNet || cookieNet || body?.network || "mainnet";
    if (targetNetwork === "testnet") {
      return NextResponse.json(
        { error: "Autonomous agent execution is restricted to Arc Mainnet builder-admin mode only." },
        { status: 403 }
      );
    }

    // Execute the autonomous loop on Mainnet
    const dryRun = process.env.DRY_RUN === "true" || !!body?.dryRun;
    const result = await runAutonomousAgentLoop({
      orgId: body?.orgId,
      dryRun,
      network: "mainnet",
    });

    return NextResponse.json({
      success: true,
      network: "mainnet",
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
