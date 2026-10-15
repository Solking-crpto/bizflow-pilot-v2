import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, getSessionOrg, isAdminWallet } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        address: null,
        org: null,
        isAdmin: false,
      });
    }

    const org = await getSessionOrg(session);
    const isAdmin = isAdminWallet(session.address);

    return NextResponse.json({
      authenticated: true,
      address: session.address,
      org: org
        ? {
            id: org.id,
            name: org.name,
            currency: org.currency,
          }
        : null,
      isAdmin,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to resolve session", authenticated: false },
      { status: 500 }
    );
  }
}
