import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { NetworkMode, DEFAULT_NETWORK } from "@/lib/networks";
import { getDb } from "@/lib/db";

import {
  getSessionCookieName,
  SESSION_COOKIE_NAME,
  buildSiweMessage,
  parseSiweMessage,
} from "./siwe";

export { getSessionCookieName, SESSION_COOKIE_NAME, buildSiweMessage, parseSiweMessage };

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionData {
  address: string; // normalized lowercase 0x...
  orgId?: string | null;
  role?: string;
  network?: NetworkMode;
  expiresAt: number;
}

const INSECURE_DEFAULT_SECRETS = new Set([
  "bizflow-pilot-v2-secure-session-secret-salt-arc-2026",
  "replace_with_a_secure_random_hmac_secret_key_at_least_32_chars",
  "replace_with_a_secure_random_hmac_secret_key",
  "your_super_secret_session_secret",
  "default_secret",
  "changeme",
]);

/**
 * Production startup guard: refuses to start if SESSION_SECRET is missing,
 * shorter than 32 characters, or equal to any default or example value.
 */
export function assertValidSessionSecret(): string {
  const isProduction = process.env.NODE_ENV === "production";
  const secret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;

  if (isProduction) {
    if (!secret) {
      throw new Error(
        "CRITICAL SECURITY VIOLATION: SESSION_SECRET is missing in production environment. Refusing startup."
      );
    }
    if (secret.length < 32) {
      throw new Error(
        "CRITICAL SECURITY VIOLATION: SESSION_SECRET must be at least 32 characters long. Refusing startup."
      );
    }
    if (
      INSECURE_DEFAULT_SECRETS.has(secret) ||
      secret.toLowerCase().includes("replace_with") ||
      secret.toLowerCase().includes("example")
    ) {
      throw new Error(
        "CRITICAL SECURITY VIOLATION: SESSION_SECRET is set to an insecure default or example placeholder value. Refusing startup."
      );
    }
  }

  return secret || "bizflow-pilot-v2-development-session-secret-salt-arc-2026";
}

export function getSessionSecret(): string {
  return assertValidSessionSecret();
}

function signPayload(payload: string): string {
  const rawSecret = getSessionSecret();
  return crypto.createHmac("sha256", rawSecret).update(payload).digest("base64url");
}

/**
 * Generates a signed session token.
 * SIWE session proves wallet ownership.
 */
export function createSessionToken(data: SessionData): string {
  const tokenData: SessionData = {
    address: data.address.toLowerCase(),
    orgId: data.orgId || null,
    role: data.role || "owner",
    expiresAt: data.expiresAt || Date.now() + SESSION_TTL_MS,
  };
  const json = JSON.stringify(tokenData);
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
    const cookieNames = [
      "bizflow_session",
      "bizflow_session_mainnet",
      "bizflow_session_testnet",
    ];

    if ("cookies" in req && typeof (req as NextRequest).cookies.get === "function") {
      for (const name of cookieNames) {
        const cookie = (req as NextRequest).cookies.get(name);
        if (cookie?.value) {
          const verified = verifySessionToken(cookie.value);
          if (verified) return verified;
        }
      }
    }

    const cookieHeader = req.headers.get("cookie") || "";
    const cookiesList = cookieHeader.split(";").map((c) => c.trim());
    for (const name of cookieNames) {
      for (const c of cookiesList) {
        if (c.startsWith(`${name}=`)) {
          const token = c.substring(name.length + 1);
          const verified = verifySessionToken(token);
          if (verified) return verified;
        }
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
    const cookieNames = [
      "bizflow_session",
      "bizflow_session_mainnet",
      "bizflow_session_testnet",
    ];

    for (const name of cookieNames) {
      const cookie = cookieStore.get(name);
      if (cookie?.value) {
        const verified = verifySessionToken(cookie.value);
        if (verified) return verified;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves the authenticated organization for the current session on the specified network.
 * Physical schema isolation: Organizations are resolved by (wallet, network) via getDb(network).
 * A wallet can have one organization per network and onboards separately on each.
 */
export async function getSessionOrg(
  session: SessionData | null,
  network?: NetworkMode
) {
  if (!session?.address) return null;

  const targetNetwork = network || session.network || DEFAULT_NETWORK;
  const db = getDb(targetNetwork);
  return db.organization.findFirst({
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

/**
 * Convenience helper to get the session organization in Server Components.
 */
export async function getServerSessionOrg(network: NetworkMode = DEFAULT_NETWORK) {
  const session = await getServerSession();
  return getSessionOrg(session, network);
}
