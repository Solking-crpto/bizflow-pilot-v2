import { describe, it, expect } from "vitest";
import {
  generateToken,
  hashToken,
  generateAccessCode,
  hashAccessCode,
  generateChallengeCode,
  verifyAccessCode,
  calculateLockoutState,
  isLockedOut,
  createVerifierSessionToken,
  verifyVerifierSessionToken,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from "../lib/verification/security";

describe("Phase 4: Token Security, Access Codes & Link Management", () => {
  describe("Token Generation & Hashing", () => {
    it("generates 32-byte (64 hex char) random raw token and corresponding SHA-256 hash", () => {
      const { rawToken, tokenHash } = generateToken();
      expect(rawToken).toHaveLength(64);
      expect(tokenHash).toHaveLength(64);
      expect(hashToken(rawToken)).toBe(tokenHash);
    });

    it("normalizes token case and whitespace when hashing", () => {
      const token = "AbCdEf1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      const hash1 = hashToken(token);
      const hash2 = hashToken(`  ${token.toUpperCase()}  `);
      expect(hash1).toBe(hash2);
    });
  });

  describe("Access Code & Challenge Code Generation", () => {
    it("generates 6-char access code using only unambiguous characters", () => {
      const { rawCode, codeHash } = generateAccessCode();
      expect(rawCode).toHaveLength(6);
      expect(codeHash).toHaveLength(64);

      // Verify no ambiguous characters: 0, O, 1, I, L
      const ambiguous = /[0O1IL]/;
      expect(ambiguous.test(rawCode)).toBe(false);
    });

    it("generates 4-char challenge code using unambiguous characters", () => {
      const challenge = generateChallengeCode();
      expect(challenge).toHaveLength(4);
      const ambiguous = /[0O1IL]/;
      expect(ambiguous.test(challenge)).toBe(false);
    });

    it("hashes access code using HMAC-SHA256 with server pepper", () => {
      const code = "ABC789";
      const pepper1 = "pepper-server-secret-instance-alpha-32chars";
      const pepper2 = "pepper-server-secret-instance-beta-32chars!";

      const hash1 = hashAccessCode(code, pepper1);
      const hash2 = hashAccessCode(code, pepper2);

      expect(hash1).toHaveLength(64);
      expect(hash2).toHaveLength(64);
      // Different server peppers produce completely different hashes
      expect(hash1).not.toBe(hash2);

      // Verify constant-time comparison matches with the same pepper
      expect(verifyAccessCode(code, hash1, pepper1)).toBe(true);
      expect(verifyAccessCode(code, hash1, pepper2)).toBe(false);
    });

    it("strictly requires ACCESS_CODE_PEPPER in production with zero fallback default", () => {
      const oldEnv = process.env.NODE_ENV;
      const oldPepper = process.env.ACCESS_CODE_PEPPER;
      try {
        process.env.NODE_ENV = "production";
        delete process.env.ACCESS_CODE_PEPPER;

        expect(() => hashAccessCode("ABC123")).toThrow(/ACCESS_CODE_PEPPER is strictly required in production/);
      } finally {
        process.env.NODE_ENV = oldEnv;
        if (oldPepper) process.env.ACCESS_CODE_PEPPER = oldPepper;
      }
    });

    it("verifies matching access code with timing-safe comparison", () => {
      const { rawCode, codeHash } = generateAccessCode();
      expect(verifyAccessCode(rawCode, codeHash)).toBe(true);
      expect(verifyAccessCode(rawCode.toLowerCase(), codeHash)).toBe(true);
      expect(verifyAccessCode(`  ${rawCode}  `, codeHash)).toBe(true);

      // Mismatch
      expect(verifyAccessCode("WRONGX", codeHash)).toBe(false);
    });
  });

  describe("Lockout Logic", () => {
    it("increments failed attempts and triggers lockout at 5th attempt", () => {
      let state = { newFailedAttempts: 0, lockedUntil: null as Date | null, isLocked: false };

      for (let i = 0; i < 4; i++) {
        state = calculateLockoutState(state.newFailedAttempts);
        expect(state.isLocked).toBe(false);
        expect(state.lockedUntil).toBeNull();
      }

      // 5th attempt triggers lockout
      state = calculateLockoutState(state.newFailedAttempts);
      expect(state.newFailedAttempts).toBe(5);
      expect(state.isLocked).toBe(true);
      expect(state.lockedUntil).not.toBeNull();
      expect(isLockedOut(state.newFailedAttempts, state.lockedUntil)).toBe(true);
    });

    it("returns false for isLockedOut when lockout time has elapsed", () => {
      const pastTime = new Date(Date.now() - 1000);
      expect(isLockedOut(3, pastTime)).toBe(false);
      expect(isLockedOut(5, pastTime)).toBe(true); // 5 attempts without reset remains locked until reset
    });
  });

  describe("Verifier Session Tokens", () => {
    it("creates and verifies a valid HMAC signed session token", () => {
      const { tokenHash } = generateToken();
      const sessionToken = createVerifierSessionToken(tokenHash, 3600);

      const verification = verifyVerifierSessionToken(sessionToken);
      expect(verification.valid).toBe(true);
      expect(verification.tokenHash).toBe(tokenHash);
    });

    it("rejects tampered verifier session tokens", () => {
      const { tokenHash } = generateToken();
      const sessionToken = createVerifierSessionToken(tokenHash, 3600);
      const [payload, sig] = sessionToken.split(".");

      // Modify payload
      const tampered = `${payload}X.${sig}`;
      const res = verifyVerifierSessionToken(tampered);
      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
    });

    it("rejects expired session tokens", () => {
      const { tokenHash } = generateToken();
      // -10 seconds expiry
      const sessionToken = createVerifierSessionToken(tokenHash, -10);
      const res = verifyVerifierSessionToken(sessionToken);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("expired");
    });
  });
});
