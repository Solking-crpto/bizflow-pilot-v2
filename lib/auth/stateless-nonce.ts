import crypto from "crypto";
import { getSessionSecret } from "./session";

export const AUTH_NONCE_COOKIE_NAME = "bizflow_auth_nonce";
export const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface GeneratedNonce {
  nonce: string;
  cookieValue: string;
  expiresAt: number;
}

/**
 * Creates a stateless, HMAC-signed authentication nonce.
 * This completely decouples authentication nonce generation from any database.
 */
export function createStatelessNonce(): GeneratedNonce {
  const nonce = crypto.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + NONCE_TTL_MS;
  const payload = `${nonce}.${expiresAt}`;
  const hmac = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
  const cookieValue = `${payload}.${hmac}`;

  return { nonce, cookieValue, expiresAt };
}

/**
 * Verifies that the incoming nonce from SIWE matches the HMAC-signed cookie and has not expired.
 * Does not touch the database.
 */
export function verifyStatelessNonce(
  incomingNonce: string,
  cookieValue: string | undefined | null
): { valid: boolean; error?: string } {
  if (!cookieValue) {
    return { valid: false, error: "Missing authentication nonce cookie" };
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Malformed authentication nonce cookie" };
  }

  const [cookieNonce, expiresAtStr, signature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);

  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return { valid: false, error: "Authentication nonce has expired" };
  }

  const payload = `${cookieNonce}.${expiresAtStr}`;
  const expectedHmac = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");

  // Constant-time comparison
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedHmac);

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, error: "Invalid authentication nonce signature" };
  }

  if (cookieNonce !== incomingNonce) {
    return { valid: false, error: "Authentication nonce mismatch" };
  }

  return { valid: true };
}
