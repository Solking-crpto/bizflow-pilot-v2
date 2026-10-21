import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as cleanupHandler, POST as cleanupPostHandler } from "../app/api/cron/cleanup/route";
import { GET as getNotificationsHandler, PATCH as patchNotificationsHandler } from "../app/api/notifications/route";
import { getDb } from "../lib/db";
import { createSessionToken } from "../lib/auth/session";
import crypto from "crypto";

const db = getDb("testnet");

describe("Phase 10: In-App Notifications & Retention Cleanup", () => {
  const originalEnv = { ...process.env };
  const testSecret = "test_cron_secret_v2_clean_token";

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CRON_SECRET = testSecret;
    process.env.STORAGE_PROVIDER = "local";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("CRON_SECRET Authentication on /api/cron/cleanup", () => {
    it("returns 401 when CRON_SECRET is not configured on the server", async () => {
      delete process.env.CRON_SECRET;

      const req = new NextRequest("http://localhost:3002/api/cron/cleanup", {
        method: "GET",
        headers: {
          authorization: `Bearer ${testSecret}`,
        },
      });

      const res = await cleanupHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toMatch(/CRON_SECRET is not configured/i);
    });

    it("returns 401 when bearer token is missing or incorrect", async () => {
      const req = new NextRequest("http://localhost:3002/api/cron/cleanup", {
        method: "GET",
        headers: {
          authorization: "Bearer wrong_bearer_token",
        },
      });

      const res = await cleanupHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toMatch(/Invalid CRON_SECRET/i);
    });

    it("accepts valid CRON_SECRET bearer token and executes retention cleanup", async () => {
      const req = new NextRequest("http://localhost:3002/api/cron/cleanup?network=testnet", {
        method: "GET",
        headers: {
          authorization: `Bearer ${testSecret}`,
        },
      });

      const res = await cleanupHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(typeof data.totalPruned).toBe("number");
      expect(data.retentionDays).toBe(90);
      expect(data.cutoffDate).toBeDefined();
    });
  });

  describe("Evidence Retention Pruning & Preservation of Audit Records", () => {
    it("prunes expired EvidenceFile while preserving DeliveryRequest immutable audit records", async () => {
      // 1. Find or create an existing test organization
      const org = await db.organization.findFirst();
      if (!org) throw new Error("No organization found in testnet");

      // 2. Create a DeliveryRequest
      const reqRecord = await db.deliveryRequest.create({
        data: {
          orgId: org.id,
          tokenHash: crypto.randomBytes(32).toString("hex"),
          accessCodeHash: crypto.randomBytes(32).toString("hex"),
          challengeCode: "TEST",
          expiresAt: new Date(Date.now() + 86400000),
          status: "submitted",
        },
      });

      // 3. Create an expired EvidenceFile (deleteAfter in the past)
      const expiredFile = await db.evidenceFile.create({
        data: {
          requestId: reqRecord.id,
          kind: "photo",
          storagePath: `evidence/${org.id}/${reqRecord.id}/expired.jpg`,
          sha256: crypto.randomBytes(32).toString("hex"),
          mime: "image/jpeg",
          size: 1024,
          deleteAfter: new Date(Date.now() - 3600000), // 1 hour ago
          status: "uploaded",
        },
      });

      // 4. Trigger retention cleanup
      const cleanupReq = new NextRequest("http://localhost:3002/api/cron/cleanup?network=testnet", {
        method: "POST",
        headers: {
          authorization: `Bearer ${testSecret}`,
        },
      });

      const cleanupRes = await cleanupPostHandler(cleanupReq);
      expect(cleanupRes.status).toBe(200);

      // 5. Assert: EvidenceFile row was removed from database
      const foundFile = await db.evidenceFile.findUnique({
        where: { id: expiredFile.id },
      });
      expect(foundFile).toBeNull();

      // 6. Assert: Parent DeliveryRequest record remains intact for immutable auditability!
      const parentRequest = await db.deliveryRequest.findUnique({
        where: { id: reqRecord.id },
      });
      expect(parentRequest).not.toBeNull();
      expect(parentRequest?.id).toBe(reqRecord.id);

      // Clean up test request
      await db.deliveryRequest.delete({ where: { id: reqRecord.id } });
    });
  });

  describe("In-App Notifications API (/api/notifications)", () => {
    let authCookie: string;
    let testOrgId: string;

    beforeEach(async () => {
      const org = await db.organization.findFirst();
      if (!org) throw new Error("No organization found in testnet");
      testOrgId = org.id;

      const token = createSessionToken({
        address: org.walletAddress,
        orgId: org.id,
        role: "owner",
        expiresAt: Date.now() + 86400000,
      });
      authCookie = `bizflow_session=${token}; bizflow_network=testnet`;
    });

    it("GET /api/notifications returns notification list and unread count", async () => {
      // Create a test notification
      const notif = await db.notification.create({
        data: {
          orgId: testOrgId,
          type: "delivery_proof_submitted",
          payloadJson: JSON.stringify({
            verifierName: "Amara Okonkwo",
            poNumber: "PO-7001",
            overall: "ready",
            filesCount: 3,
          }),
        },
      });

      const req = new NextRequest("http://localhost:3002/api/notifications", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Bizflow-Network": "testnet",
          Cookie: authCookie,
        },
      });

      const res = await getNotificationsHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(typeof data.unreadCount).toBe("number");
      expect(data.unreadCount).toBeGreaterThan(0);
      expect(Array.isArray(data.notifications)).toBe(true);

      const found = data.notifications.find((n: any) => n.id === notif.id);
      expect(found).toBeDefined();
      expect(found.payload.verifierName).toBe("Amara Okonkwo");
      expect(found.isRead).toBe(false);

      // Clean up
      await db.notification.delete({ where: { id: notif.id } });
    });

    it("PATCH /api/notifications marks notifications as read", async () => {
      const notif = await db.notification.create({
        data: {
          orgId: testOrgId,
          type: "link_locked",
          payloadJson: JSON.stringify({
            requestId: "req-locked-01",
            reason: "Too many failed attempts",
            lockedUntil: new Date(Date.now() + 1800000).toISOString(),
          }),
        },
      });

      const patchReq = new NextRequest("http://localhost:3002/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Bizflow-Network": "testnet",
          Cookie: authCookie,
        },
        body: JSON.stringify({
          notificationIds: [notif.id],
        }),
      });

      const patchRes = await patchNotificationsHandler(patchReq);
      expect(patchRes.status).toBe(200);

      // Verify notification in DB has readAt set
      const updated = await db.notification.findUnique({
        where: { id: notif.id },
      });
      expect(updated?.readAt).not.toBeNull();

      // Clean up
      await db.notification.delete({ where: { id: notif.id } });
    });
  });
});
