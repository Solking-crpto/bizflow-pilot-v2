import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertValidDatabaseUrls } from "../lib/db";
import { assertValidSessionSecret } from "../lib/auth/session";
import { assertValidSandboxMode } from "../lib/networks";

describe("Startup Guards & Production Safety Invariants", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when DATABASE_URL_MAINNET lacks schema=v2_mainnet", () => {
    expect(() => {
      assertValidDatabaseUrls(
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=wrong_schema&sslmode=require",
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=v2_testnet&sslmode=require"
      );
    }).toThrow(/DATABASE_URL_MAINNET must specify 'schema=v2_mainnet'/);
  });

  it("throws when DATABASE_URL_TESTNET lacks schema=v2_testnet", () => {
    expect(() => {
      assertValidDatabaseUrls(
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=v2_mainnet&sslmode=require",
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=wrong_schema&sslmode=require"
      );
    }).toThrow(/DATABASE_URL_TESTNET must specify 'schema=v2_testnet'/);
  });

  it("throws when DATABASE_URL_MAINNET === DATABASE_URL_TESTNET", () => {
    expect(() => {
      assertValidDatabaseUrls(
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=v2_mainnet&sslmode=require",
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=v2_mainnet&sslmode=require"
      );
    }).toThrow(/cannot point to the exact same URL/);
  });

  it("throws when SESSION_SECRET is unset or under 32 chars in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;
    delete process.env.AUTH_SECRET;

    expect(() => assertValidSessionSecret()).toThrow(/SESSION_SECRET is missing/);

    process.env.SESSION_SECRET = "short-secret-123";
    expect(() => assertValidSessionSecret()).toThrow(/must be at least 32 characters/);
  });

  it("throws when PUBLIC_SANDBOX=true on mainnet", () => {
    process.env.PUBLIC_SANDBOX = "true";
    expect(() => assertValidSandboxMode("mainnet")).toThrow(
      /PUBLIC_SANDBOX is strictly prohibited/
    );

    // On testnet, it is permitted
    expect(() => assertValidSandboxMode("testnet")).not.toThrow();
  });

  it("logs a startup warning in dev when DRY_RUN is set", () => {
    delete (globalThis as any).__dryRunWarned;
    process.env.NODE_ENV = "development";
    process.env.DRY_RUN = "true";

    let warnedMsg = "";
    const origWarn = console.warn;
    console.warn = (msg: string) => {
      warnedMsg = msg;
    };

    try {
      assertValidSandboxMode("testnet");
      expect(warnedMsg).toContain("DRY_RUN is currently active");
    } finally {
      console.warn = origWarn;
    }
  });
});
