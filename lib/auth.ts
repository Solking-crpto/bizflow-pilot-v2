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
  orgId: "",
  orgName: "",
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
      return {
        id: session.address,
        email: null,
        walletAddress: session.address,
        role: "owner",
        orgId: "",
        orgName: "Unregistered Business",
      };
    }
  } catch (err) {
    // Non-fatal session retrieval error
  }

  return DEFAULT_ANONYMOUS_SESSION;
}
