import crypto from "crypto";
import { verifyMessage } from "viem";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getActiveNetwork } from "@/lib/networks";
import { prisma } from "@/lib/db";

import {
  SESSION_COOKIE_NAME,
  buildSiweMessage,
  parseSiweMessage,
} from "./siwe";

export { SESSION_COOKIE_NAME, buildSiweMessage, parseSiweMessage };

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionData {
  address: string; // normalized lowercase 0x...
  orgId: string | null;
  role: string;
  expiresAt: number;
}

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    "bizflow-pilot-v2-secure-session-secret-salt-arc-2026"
  );
}

/**
 * Creates an HMAC-SHA256 signature for a string payload.
 */
function signPayload(payload: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

/**
 * Generates a signed session token.
 */
export function createSessionToken(data: SessionData): string {
  const json = JSON.stringify(data);
  const payloadBase64 = Buffer.from(json).toString("base64url");
  const signature = signPayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies and decodes a signed session token.
 */
export function verifySessionToken(token: string): SessionData | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadBase64, signature] = parts;
    const expectedSignature = signPayload(payloadBase64);

    // Constant-time comparison to prevent timing attacks
    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return null;
    }

    const json = Buffer.from(payloadBase64, "base64url").toString("utf-8");
    const data: SessionData = JSON.parse(json);

    if (!data.address || !data.expiresAt) return null;
    if (Date.now() > data.expiresAt) return null;

    return {
      ...data,
      address: data.address.toLowerCase(),
    };
  } catch {
    return null;
  }
}

/**
 * Checks if a wallet address matches the administrator wallet.
 */
export function isAdminWallet(address?: string | null): boolean {
  if (!address) return false;
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS;
  if (!adminWallet) return false;
  return address.toLowerCase() === adminWallet.toLowerCase();
}


/**
 * Extracts and verifies the session from an incoming NextRequest.
 */
export function getSessionFromRequest(req: NextRequest | Request): SessionData | null {
  try {
    let cookieHeader = "";
    if ("cookies" in req && typeof req.cookies.get === "function") {
      const cookie = req.cookies.get(SESSION_COOKIE_NAME);
      if (cookie) return verifySessionToken(cookie.value);
    }

    cookieHeader = req.headers.get("cookie") || "";
    const cookiesList = cookieHeader.split(";").map((c) => c.trim());
    for (const c of cookiesList) {
      if (c.startsWith(`${SESSION_COOKIE_NAME}=`)) {
        const token = c.substring(SESSION_COOKIE_NAME.length + 1);
        return verifySessionToken(token);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reads and verifies the session in React Server Components.
 */
export async function getServerSession(): Promise<SessionData | null> {
  try {
    const cookieStore = cookies();
    const cookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!cookie) return null;
    return verifySessionToken(cookie.value);
  } catch {
    return null;
  }
}

/**
 * Resolves the authenticated organization for the current session.
 */
export async function getSessionOrg(session: SessionData | null) {
  if (!session?.address) return null;

  return prisma.organization.findFirst({
    where: {
      OR: [
        { walletAddress: { equals: session.address, mode: "insensitive" } },
        { members: { some: { walletAddress: { equals: session.address, mode: "insensitive" } } } },
      ],
    },
    include: {
      settings: true,
      members: true,
    },
  });
}
