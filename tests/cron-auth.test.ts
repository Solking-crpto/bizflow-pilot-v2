import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST as runAgentRoute } from "@/app/api/agent/run/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/agent/runner", () => ({
  runAutonomousAgentLoop: vi.fn().mockResolvedValue({
    executedCount: 0,
    escalatedCount: 0,
    heldCount: 0,
    dryRun: true,
  }),
}));

describe("CRON_SECRET Authorization Security", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PUBLIC_SANDBOX;
    delete process.env.OWNER_PASSCODE;
    process.env.DRY_RUN = "true";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 401 when CRON_SECRET is unset and bearer token is provided", async () => {
    delete process.env.CRON_SECRET;

    const req = new NextRequest("http://localhost:3001/api/agent/run", {
      method: "POST",
      headers: {
        Authorization: "Bearer some_bearer_token_123",
      },
    });

    const res = await runAgentRoute(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Unauthorized/i);
  });

  it("returns 401 and never accepts an empty bearer token", async () => {
    process.env.CRON_SECRET = "secure_cron_token_abc";

    const req = new NextRequest("http://localhost:3001/api/agent/run", {
      method: "POST",
      headers: {
        Authorization: "Bearer ",
      },
    });

    const res = await runAgentRoute(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Unauthorized/i);
  });

  it("returns 401 and never accepts a whitespace bearer token", async () => {
    process.env.CRON_SECRET = "secure_cron_token_abc";

    const req = new NextRequest("http://localhost:3001/api/agent/run", {
      method: "POST",
      headers: {
        Authorization: "Bearer    ",
      },
    });

    const res = await runAgentRoute(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Unauthorized/i);
  });

  it("returns 401 when bearer token does not match CRON_SECRET", async () => {
    process.env.CRON_SECRET = "secure_cron_token_abc";

    const req = new NextRequest("http://localhost:3001/api/agent/run", {
      method: "POST",
      headers: {
        Authorization: "Bearer wrong_token_xyz",
      },
    });

    const res = await runAgentRoute(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Unauthorized/i);
  });

  it("authorizes successfully when valid non-empty bearer token is provided", async () => {
    process.env.CRON_SECRET = "secure_cron_token_abc";

    const req = new NextRequest("http://localhost:3001/api/agent/run", {
      method: "POST",
      headers: {
        Authorization: "Bearer secure_cron_token_abc",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dryRun: true }),
    });

    const res = await runAgentRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
