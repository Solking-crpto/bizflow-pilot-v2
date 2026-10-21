import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork } from "@/lib/networks";
import { safeDbErrorResponse } from "@/lib/errors";
import {
  hashToken,
  verifyAccessCode,
  calculateLockoutState,
  isLockedOut,
  createVerifierSessionToken,
  VERIFIER_SESSION_COOKIE,
} from "@/lib/verification/security";

import { resolveVerifierDb } from "@/lib/verification/resolver";

export const dynamic = "force-dynamic";

const AuthSchema = z.object({
  token: z.string().min(10, "Token is required"),
  accessCode: z.string().min(1, "Access code is required"),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = AuthSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { token, accessCode } = parsed.data;
    const tokenHash = hashToken(token);
    const resolved = await resolveVerifierDb(tokenHash, req.cookies.get("bizflow_network")?.value);
    const db = resolved ? resolved.db : getDb("testnet");

    const deliveryRequest = await withDbTimeout(() =>
      db.deliveryRequest.findUnique({
        where: { tokenHash },
      })
    );

    if (!deliveryRequest) {
      return NextResponse.json({ error: "Invalid delivery verification link." }, { status: 404 });
    }

    if (deliveryRequest.revokedAt) {
      return NextResponse.json({ error: "This delivery verification link has been revoked." }, { status: 410 });
    }

    if (new Date(deliveryRequest.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: "This delivery verification link has expired." }, { status: 410 });
    }

    // Check lockout
    const currentlyLocked = isLockedOut(
      deliveryRequest.failedCodeAttempts,
      deliveryRequest.lockedUntil
    );

    if (currentlyLocked) {
      return NextResponse.json(
        {
          error: "Too many failed attempts. Link is temporarily locked for 30 minutes.",
          locked: true,
          lockedUntil: deliveryRequest.lockedUntil,
        },
        { status: 429 }
      );
    }

    // Verify access code
    const isValidCode = verifyAccessCode(accessCode, deliveryRequest.accessCodeHash);

    if (!isValidCode) {
      const lockoutState = calculateLockoutState(deliveryRequest.failedCodeAttempts);

      await withDbTimeout(() =>
        db.deliveryRequest.update({
          where: { id: deliveryRequest.id },
          data: {
            failedCodeAttempts: lockoutState.newFailedAttempts,
            lockedUntil: lockoutState.lockedUntil,
          },
        })
      );

      // If lockout was just triggered, notify organization owner
      if (lockoutState.isLocked) {
        await withDbTimeout(() =>
          db.notification.create({
            data: {
              orgId: deliveryRequest.orgId,
              type: "link_locked",
              payloadJson: JSON.stringify({
                requestId: deliveryRequest.id,
                reason: "5 consecutive failed access code attempts. Locked for 30 minutes.",
                lockedUntil: lockoutState.lockedUntil,
              }),
            },
          })
        );
      }

      const remaining = Math.max(0, 5 - lockoutState.newFailedAttempts);
      return NextResponse.json(
        {
          error: lockoutState.isLocked
            ? "Incorrect code. Link has been locked for 30 minutes due to multiple failed attempts."
            : `Incorrect access code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
          locked: lockoutState.isLocked,
          remainingAttempts: remaining,
          lockedUntil: lockoutState.lockedUntil,
        },
        { status: 401 }
      );
    }

    // Success: Reset failed attempts in DB
    await withDbTimeout(() =>
      db.deliveryRequest.update({
        where: { id: deliveryRequest.id },
        data: {
          failedCodeAttempts: 0,
          lockedUntil: null,
        },
      })
    );

    // Create session token and set cookie
    const sessionToken = createVerifierSessionToken(tokenHash, 86400); // 24 hours
    const res = NextResponse.json({
      success: true,
      authenticated: true,
      requestId: deliveryRequest.id,
    });

    const isSecure = process.env.NODE_ENV === "production";
    res.cookies.set(VERIFIER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    });

    return res;
  } catch (err: any) {
    return safeDbErrorResponse(err, "POST /api/verifier/auth");
  }
}
