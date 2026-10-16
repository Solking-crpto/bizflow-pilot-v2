import { describe, it, expect, beforeEach } from "vitest";
import { getDb, withDbTimeout } from "../lib/db";
import { recordAuditEvent, verifyAuditChain } from "../lib/audit/ledger";

const prisma = getDb("testnet");

describe("lib/audit - Cryptographic Hash Chain & Tamper Detection", () => {
  const testOrgId = "org-test-audit-01";

  beforeEach(async () => {
    await withDbTimeout(() => prisma.auditEvent.deleteMany({ where: { orgId: testOrgId } }));
    await withDbTimeout(() =>
      prisma.organization.upsert({
        where: { id: testOrgId },
        update: {},
        create: { id: testOrgId, name: "Audit Test Org" },
      })
    );
  });

  it("builds a cryptographically linked hash chain across multiple events", async () => {
    // Event 1
    const ev1 = await recordAuditEvent({
      orgId: testOrgId,
      eventType: "invoice_received",
      eventData: { invoiceNumber: "INV-001", totalUsdc: "1700.00" },
    }, "testnet");
    expect(ev1.prevHash).toBe("0000000000000000000000000000000000000000000000000000000000000000");

    // Event 2
    const ev2 = await recordAuditEvent({
      orgId: testOrgId,
      eventType: "policy_evaluated",
      eventData: { decision: "approve", rulesPassed: 10 },
    }, "testnet");
    expect(ev2.prevHash).toBe(ev1.eventHash); // Chains to ev1!

    // Event 3
    const ev3 = await recordAuditEvent({
      orgId: testOrgId,
      eventType: "payment_confirmed",
      eventData: { txHash: "0x1234567890abcdef" },
    }, "testnet");
    expect(ev3.prevHash).toBe(ev2.eventHash); // Chains to ev2!

    // Verify whole chain
    const verification = await verifyAuditChain(testOrgId, "testnet");
    expect(verification.valid).toBe(true);
    expect(verification.totalEvents).toBe(3);
  });

  it("detects deliberate data tampering and fails verification", async () => {
    // Record two events
    await recordAuditEvent({
      orgId: testOrgId,
      eventType: "invoice_received",
      eventData: { amount: "100.00" },
    }, "testnet");
    const ev2 = await recordAuditEvent({
      orgId: testOrgId,
      eventType: "payment_confirmed",
      eventData: { amount: "100.00" },
    }, "testnet");

    // Tamper with the eventData in the database
    await prisma.auditEvent.update({
      where: { id: ev2.eventId },
      data: { eventData: JSON.stringify({ amount: "999999.00", tampered: true }) },
    });

    // Verification must now fail!
    const verification = await verifyAuditChain(testOrgId, "testnet");
    expect(verification.valid).toBe(false);
    expect(verification.error).toContain("Data tampering detected");
  });
});
