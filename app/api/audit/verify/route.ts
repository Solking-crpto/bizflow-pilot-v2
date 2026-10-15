export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withDbTimeout } from "@/lib/db";
import { verifyAuditChain } from "@/lib/audit/ledger";
import { validateApiNetwork } from "@/lib/api-guard";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const apiCheck = validateApiNetwork(req);
    if (apiCheck.errorResponse) return apiCheck.errorResponse;
    const { network: networkMode, db } = apiCheck;

    const session = getSessionFromRequest(req);
    const org = session
      ? await getSessionOrg(session, networkMode)
      : await withDbTimeout(() => db.organization.findFirst(), 2500);

    if (!org) {
      return NextResponse.json({ valid: true, totalEvents: 0 });
    }

    const verification = await verifyAuditChain(org.id, networkMode);
    return NextResponse.json(verification);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to verify audit chain" }, { status: 500 });
  }
}
