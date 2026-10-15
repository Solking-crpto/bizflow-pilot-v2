import { describe, it, expect } from "vitest";
import { scanClientBundle } from "../scripts/scan-client-bundle";

describe("Client Bundle Safety Verification", () => {
  it("verifies client bundle contains zero secrets or private credentials", () => {
    const res = scanClientBundle();
    expect(res.clean, `Secrets detected in client bundle: ${JSON.stringify(res.leaks)}`).toBe(true);
    expect(res.leaks).toHaveLength(0);
  });
});
