import crypto from "crypto";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
export const VERIFIER_SESSION_COOKIE = "v2_verifier_session";

// Unambiguous character set (no 0, O, 1, I, L)
const UNAMBIGUOUS_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim().toLowerCase()).digest("hex");
}

export function getAccessCodePepper(): string {
  const pepper = process.env.ACCESS_CODE_PEPPER;
  if (!pepper) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL SECURITY CONFIGURATION ERROR: ACCESS_CODE_PEPPER is strictly required in production with zero fallback default. Refusing to hash access codes."
      );
    }
    return process.env.SESSION_SECRET || "bizflow-v2-test-pepper-do-not-use-in-production-min32!";
  }
  if (process.env.NODE_ENV === "production" && pepper.length < 32) {
    throw new Error(
      "CRITICAL SECURITY CONFIGURATION ERROR: ACCESS_CODE_PEPPER must be at least 32 characters in production."
    );
  }
  return pepper;
}

export function generateAccessCode(length: number = 6, pepper?: string): { rawCode: string; codeHash: string } {
  let rawCode = "";
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, UNAMBIGUOUS_CHARS.length);
    rawCode += UNAMBIGUOUS_CHARS[idx];
  }
  const codeHash = hashAccessCode(rawCode, pepper);
  return { rawCode, codeHash };
}

export function hashAccessCode(rawCode: string, pepper?: string): string {
  const secret = pepper || getAccessCodePepper();
  const normalized = rawCode.trim().toUpperCase().replace(/[\s-]/g, "");
  return crypto.createHmac("sha256", secret).update(normalized).digest("hex");
}

export function generateChallengeCode(length: number = 4): string {
  let challenge = "";
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, UNAMBIGUOUS_CHARS.length);
    challenge += UNAMBIGUOUS_CHARS[idx];
  }
  return challenge;
}

export function verifyAccessCode(submittedCode: string, storedHash: string, pepper?: string): boolean {
  if (!submittedCode || !storedHash) return false;
  const submittedHash = hashAccessCode(submittedCode, pepper);

  try {
    const bufA = Buffer.from(submittedHash, "hex");
    const bufB = Buffer.from(storedHash, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function isLockedOut(failedAttempts: number, lockedUntil: Date | null): boolean {
  if (lockedUntil) {
    if (new Date(lockedUntil).getTime() > Date.now()) {
      return true;
    }
  }
  return failedAttempts >= MAX_FAILED_ATTEMPTS;
}

export function calculateLockoutState(currentFailedAttempts: number): {
  newFailedAttempts: number;
  lockedUntil: Date | null;
  isLocked: boolean;
} {
  const newFailedAttempts = currentFailedAttempts + 1;
  if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    return {
      newFailedAttempts,
      lockedUntil,
      isLocked: true,
    };
  }
  return {
    newFailedAttempts,
    lockedUntil: null,
    isLocked: false,
  };
}

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || "bizflow-v2-verifier-session-secret-min32!";
}

export interface VerifierSessionPayload {
  tokenHash: string;
  expiresAt: string;
}

export function createVerifierSessionToken(
  tokenHash: string,
  expiresInSeconds: number = 86400 // 24 hours
): string {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  const payload: VerifierSessionPayload = { tokenHash, expiresAt };
  const serialized = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(serialized)
    .digest("hex");
  return `${serialized}.${signature}`;
}

export function verifyVerifierSessionToken(token: string): {
  valid: boolean;
  tokenHash?: string;
  error?: string;
} {
  if (!token || !token.includes(".")) {
    return { valid: false, error: "Invalid token format" };
  }

  const [serialized, signature] = token.split(".");
  const expectedSig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(serialized)
    .digest("hex");

  try {
    const sigA = Buffer.from(signature, "hex");
    const sigB = Buffer.from(expectedSig, "hex");
    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      return { valid: false, error: "Signature mismatch" };
    }

    const payload: VerifierSessionPayload = JSON.parse(
      Buffer.from(serialized, "base64url").toString("utf-8")
    );

    if (Date.now() > new Date(payload.expiresAt).getTime()) {
      return { valid: false, error: "Verifier session expired" };
    }

    return { valid: true, tokenHash: payload.tokenHash };
  } catch (err: any) {
    return { valid: false, error: err?.message || "Failed to decode session" };
  }
}
