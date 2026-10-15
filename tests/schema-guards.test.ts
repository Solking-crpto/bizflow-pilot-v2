import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertValidDatabaseSchema, assertTestDatabaseSafety } from "@/lib/db";

describe("Database Schema Isolation & Startup Guard", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Ensure we don't trigger the test database safety abort during direct unit testing of schemas
    delete process.env.VITEST;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("permits mainnet mode when DATABASE_URL and DIRECT_URL contain schema=v2_mainnet", () => {
    expect(() => {
      assertValidDatabaseSchema(
        "mainnet",
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=v2_mainnet&sslmode=require",
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=v2_mainnet&sslmode=require"
      );
    }).not.toThrow();
  });

  it("refuses mainnet mode with clear error when DATABASE_URL targets testnet schema", () => {
    expect(() => {
      assertValidDatabaseSchema(
        "mainnet",
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=v2_testnet&sslmode=require",
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=v2_mainnet&sslmode=require"
      );
    }).toThrow(/CRITICAL DATABASE CONFIGURATION ERROR.*schema=v2_mainnet/);
  });

  it("refuses mainnet mode when schema parameter is missing", () => {
    expect(() => {
      assertValidDatabaseSchema(
        "mainnet",
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?sslmode=require",
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?sslmode=require"
      );
    }).toThrow(/CRITICAL DATABASE CONFIGURATION ERROR.*schema=v2_mainnet/);
  });

  it("permits testnet mode when DATABASE_URL and DIRECT_URL contain schema=v2_testnet", () => {
    expect(() => {
      assertValidDatabaseSchema(
        "testnet",
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=v2_testnet&sslmode=require",
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=v2_testnet&sslmode=require"
      );
    }).not.toThrow();
  });

  it("refuses testnet mode with clear error when DATABASE_URL targets mainnet schema", () => {
    expect(() => {
      assertValidDatabaseSchema(
        "testnet",
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=v2_mainnet&sslmode=require",
        "postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=v2_testnet&sslmode=require"
      );
    }).toThrow(/CRITICAL DATABASE CONFIGURATION ERROR.*schema=v2_testnet/);
  });

  it("assertTestDatabaseSafety aborts test execution if connection URL targets mainnet", () => {
    expect(() => {
      assertTestDatabaseSafety("postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=v2_mainnet&sslmode=require");
    }).toThrow(/FATAL TEST SAFETY VIOLATION/);

    expect(() => {
      assertTestDatabaseSafety("postgresql://user:pass@ep-cool.aws.neon.tech/bizflow_mainnet?sslmode=require");
    }).toThrow(/FATAL TEST SAFETY VIOLATION/);
  });

  it("assertTestDatabaseSafety allows test execution for testnet or dev databases", () => {
    expect(() => {
      assertTestDatabaseSafety("postgresql://user:pass@ep-cool.aws.neon.tech/bizflow?schema=v2_testnet&sslmode=require");
    }).not.toThrow();

    expect(() => {
      assertTestDatabaseSafety("file:./dev.db");
    }).not.toThrow();
  });

  it("assertTestDatabaseSafety aborts if TEST_NETWORK is set to mainnet during tests", () => {
    process.env.VITEST = "true";
    process.env.TEST_NETWORK = "mainnet";
    expect(() => {
      assertTestDatabaseSafety("file:./dev.db");
    }).toThrow(/FATAL TEST SAFETY VIOLATION: TEST_NETWORK must be 'testnet'/);
    process.env.TEST_NETWORK = "testnet";
  });
});

