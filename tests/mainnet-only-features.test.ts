import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as executeRoute } from "../app/api/payments/execute/route";
import { POST as agentRunRoute } from "../app/api/agent/run/route";
import { executePaymentTransaction } from "../lib/payments/executor";
import { runAutonomousAgentLoop } from "../lib/agent/runner";

describe("Mainnet-Only Features Guard (Server Treasury & Autonomous Loop)", () => {
  it("rejects server treasury payment execution on testnet with 403", async () => {
    const req = new NextRequest("http://localhost:3002/api/payments/execute", {
      method: "POST",
      headers: {
        cookie: "bizflow_network=testnet",
        "X-Bizflow-Network": "testnet",
        "x-owner-passcode": "testpass",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        invoiceId: "inv-test-001",
        passcode: "testpass",
      }),
    });

    const res = await executeRoute(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Server treasury execution is restricted to Arc Mainnet builder-admin mode only");
  });

  it("executePaymentTransaction directly refuses execution on testnet", async () => {
    const result = await executePaymentTransaction({
      invoiceId: "inv-test-001",
      network: "testnet",
      actor: "human",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Server treasury execution is restricted to Arc Mainnet builder-admin mode only");
  });

  it("rejects autonomous agent loop trigger on testnet with 403", async () => {
    process.env.CRON_SECRET = "cron_secret_test";
    const req = new NextRequest("http://localhost:3002/api/agent/run", {
      method: "POST",
      headers: {
        authorization: "Bearer cron_secret_test",
        cookie: "bizflow_network=testnet",
        "X-Bizflow-Network": "testnet",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const res = await agentRunRoute(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Autonomous agent execution is restricted to Arc Mainnet builder-admin mode only");
  });

  it("runAutonomousAgentLoop refuses execution on testnet", async () => {
    const result = await runAutonomousAgentLoop({
      dryRun: true,
      network: "testnet",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Autonomous agent execution loop is restricted to Arc Mainnet builder-admin mode only");
  });
});
