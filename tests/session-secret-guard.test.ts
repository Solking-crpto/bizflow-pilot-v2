import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertValidSessionSecret } from "@/lib/auth/session";

describe("Production SESSION_SECRET Startup Guard", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("refuses to start in production when SESSION_SECRET is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;
    delete process.env.AUTH_SECRET;

    expect(() => assertValidSessionSecret()).toThrow(
      /CRITICAL SECURITY VIOLATION: SESSION_SECRET is missing in production environment/
    );
  });

  it("refuses to start in production when SESSION_SECRET is shorter than 32 characters", () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "too-short-secret-key-12345";

    expect(() => assertValidSessionSecret()).toThrow(
      /CRITICAL SECURITY VIOLATION: SESSION_SECRET must be at least 32 characters long/
    );
  });

  it("refuses to start in production when SESSION_SECRET matches default or example values", () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "replace_with_a_secure_random_hmac_secret_key_at_least_32_chars";

    expect(() => assertValidSessionSecret()).toThrow(
      /CRITICAL SECURITY VIOLATION: SESSION_SECRET is set to an insecure default or example placeholder value/
    );
  });

  it("refuses to start in production when SESSION_SECRET contains 'example' or 'replace_with'", () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "this-is-an-example-secret-key-that-is-long-enough-for-32-chars";

    expect(() => assertValidSessionSecret()).toThrow(
      /CRITICAL SECURITY VIOLATION: SESSION_SECRET is set to an insecure default or example placeholder value/
    );
  });

  it("permits startup in production when SESSION_SECRET is valid and >= 32 characters", () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "9f7b1a2c5e8d3f6a0b4c8e1d7a2f5b9c0e3d6a8f1b4c7e2d5a8f0b3c6e9d2a5f";

    expect(() => assertValidSessionSecret()).not.toThrow();
    expect(assertValidSessionSecret()).toBe("9f7b1a2c5e8d3f6a0b4c8e1d7a2f5b9c0e3d6a8f1b4c7e2d5a8f0b3c6e9d2a5f");
  });
});
