import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertValidSandboxMode } from "@/lib/networks";

describe("Mainnet Production Safety Guards", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("strictly refuses PUBLIC_SANDBOX=true on Arc Mainnet in any environment", () => {
    process.env.NEXT_PUBLIC_NETWORK_MODE = "mainnet";
    process.env.PUBLIC_SANDBOX = "true";

    expect(() => assertValidSandboxMode()).toThrow(
      /CRITICAL SECURITY VIOLATION: PUBLIC_SANDBOX is strictly prohibited on Arc Mainnet/
    );
  });

  it("strictly refuses DRY_RUN=true on Arc Mainnet in production", () => {
    process.env.NEXT_PUBLIC_NETWORK_MODE = "mainnet";
    process.env.NODE_ENV = "production";
    process.env.DRY_RUN = "true";

    expect(() => assertValidSandboxMode()).toThrow(
      /CRITICAL SECURITY VIOLATION: DRY_RUN cannot be enabled on Arc Mainnet in production/
    );
  });

  it("permits standard production operation on Arc Mainnet when safety flags are false", () => {
    process.env.NEXT_PUBLIC_NETWORK_MODE = "mainnet";
    process.env.NODE_ENV = "production";
    process.env.PUBLIC_SANDBOX = "false";
    process.env.DRY_RUN = "false";

    expect(() => assertValidSandboxMode()).not.toThrow();
  });

  it("permits PUBLIC_SANDBOX=true on Arc Testnet for judge evaluation", () => {
    process.env.NEXT_PUBLIC_NETWORK_MODE = "testnet";
    process.env.PUBLIC_SANDBOX = "true";

    expect(() => assertValidSandboxMode()).not.toThrow();
  });
});
