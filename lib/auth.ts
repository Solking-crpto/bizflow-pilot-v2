import { getDb } from "./db";
import { getServerSession, getSessionOrg } from "./auth/session";
import { getServerActiveNetwork } from "./networks";
import { cookies } from "next/headers";

export interface UserSession {
  id: string;
  email: string | null;
  walletAddress?: string | null;
  role: "owner" | "finance_officer" | "auditor";
  orgId: string;
  orgName: string;
}

export const DEFAULT_ANONYMOUS_SESSION: UserSession = {
  id: "unauthenticated",
  email: null,
  walletAddress: null,
  role: "owner",
  orgId: "public-beta",
  orgName: "Public Beta Organization",
};

/**
 * Returns the current active user session from cookies or database.
 */
export async function getCurrentSession(): Promise<UserSession> {
  try {
    const session = await getServerSession();
    if (session) {
      const org = await getSessionOrg(session);
      if (org) {
        return {
          id: session.address,
          email: org.contactEmail || null,
          walletAddress: session.address,
          role: "owner",
          orgId: org.id,
          orgName: org.name,
        };
      }
    }

    const cookieStore = cookies();
    const networkMode = getServerActiveNetwork(cookieStore.get("bizflow_network")?.value);
    const db = getDb(networkMode);

    const org = await db.organization.findFirst({
      include: { members: true },
    });

    if (org && org.members.length > 0) {
      const member = org.members[0];
      return {
        id: member.id,
        email: member.email || null,
        walletAddress: member.walletAddress || org.walletAddress || null,
        role: (member.role as any) || "owner",
        orgId: org.id,
        orgName: org.name,
      };
    }
  } catch (err) {
    // Fallback if DB query fails
  }

  return DEFAULT_ANONYMOUS_SESSION;
}
