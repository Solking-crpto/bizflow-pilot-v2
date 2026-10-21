import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { safeDbErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const netCtx = validateApiNetwork(req);
    if (!netCtx.success) return netCtx.response;
    const { network, db } = netCtx;

    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getSessionOrg(session, network);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const notifications = await withDbTimeout(
      () =>
        db.notification.findMany({
          where: { orgId: org.id },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      30000
    );

    const unreadCount = notifications.filter((n) => !n.readAt).length;

    const formatted = notifications.map((n) => {
      let parsedPayload: any = {};
      try {
        parsedPayload = JSON.parse(n.payloadJson);
      } catch {
        parsedPayload = { text: n.payloadJson };
      }

      return {
        id: n.id,
        type: n.type,
        payload: parsedPayload,
        isRead: !!n.readAt,
        readAt: n.readAt?.toISOString() || null,
        createdAt: n.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications: formatted,
    });
  } catch (err: any) {
    return safeDbErrorResponse(err, "GET /api/notifications");
  }
}

const MarkReadSchema = z.object({
  notificationIds: z.array(z.string()).optional(),
  markAll: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const netCtx = validateApiNetwork(req);
    if (!netCtx.success) return netCtx.response;
    const { network, db } = netCtx;

    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getSessionOrg(session, network);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const json = await req.json();
    const parsed = MarkReadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", details: parsed.error }, { status: 400 });
    }

    const { notificationIds, markAll } = parsed.data;
    const now = new Date();

    if (markAll) {
      await withDbTimeout(
        () =>
          db.notification.updateMany({
            where: { orgId: org.id, readAt: null },
            data: { readAt: now },
          }),
        15000
      );
    } else if (notificationIds && notificationIds.length > 0) {
      await withDbTimeout(
        () =>
          db.notification.updateMany({
            where: { id: { in: notificationIds }, orgId: org.id },
            data: { readAt: now },
          }),
        15000
      );
    }

    return NextResponse.json({ success: true, timestamp: now.toISOString() });
  } catch (err: any) {
    return safeDbErrorResponse(err, "PATCH /api/notifications");
  }
}
