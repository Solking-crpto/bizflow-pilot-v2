import { NextRequest, NextResponse } from "next/server";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork } from "@/lib/networks";
import { safeDbErrorResponse } from "@/lib/errors";
import {
  hashToken,
  isLockedOut,
  verifyVerifierSessionToken,
  VERIFIER_SESSION_COOKIE,
} from "@/lib/verification/security";

import { resolveVerifierDb } from "@/lib/verification/resolver";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token parameter." }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const resolved = await resolveVerifierDb(tokenHash, req.cookies.get("bizflow_network")?.value);
    const db = resolved ? resolved.db : getDb("testnet");

    const deliveryRequest = await withDbTimeout(() =>
      db.deliveryRequest.findUnique({
        where: { tokenHash },
        include: {
          purchaseOrder: {
            include: {
              vendor: true,
              lines: { include: { item: true } },
            },
          },
          invoice: {
            include: {
              vendor: true,
            },
          },
          submission: true,
          evidenceFiles: true,
        },
      })
    );

    if (!deliveryRequest) {
      return NextResponse.json({ error: "Invalid or expired delivery verification link." }, { status: 404 });
    }

    if (deliveryRequest.revokedAt) {
      return NextResponse.json({ error: "This delivery verification link has been revoked by the owner." }, { status: 410 });
    }

    if (new Date(deliveryRequest.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: "This delivery verification link has expired." }, { status: 410 });
    }

    // Check if already submitted
    if (deliveryRequest.submission) {
      return NextResponse.json({
        success: true,
        alreadySubmitted: true,
        submittedAt: deliveryRequest.submission.submittedAt,
        verifierName: deliveryRequest.verifierName,
        filesCount: deliveryRequest.evidenceFiles.length,
        status: deliveryRequest.status,
      });
    }

    // Check lockout
    const locked = isLockedOut(
      deliveryRequest.failedCodeAttempts,
      deliveryRequest.lockedUntil
    );

    if (locked) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        locked: true,
        lockedUntil: deliveryRequest.lockedUntil,
      });
    }

    // Check verifier session cookie
    const sessionCookie = req.cookies.get(VERIFIER_SESSION_COOKIE)?.value;
    let isAuthenticated = false;
    if (sessionCookie) {
      const verified = verifyVerifierSessionToken(sessionCookie);
      if (verified.valid && verified.tokenHash === tokenHash) {
        isAuthenticated = true;
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        locked: false,
        failedAttempts: deliveryRequest.failedCodeAttempts,
        remainingAttempts: Math.max(0, 5 - deliveryRequest.failedCodeAttempts),
      });
    }

    // Authenticated verifier session: return order summary (strictly no pricing or confidential secrets)
    const po = deliveryRequest.purchaseOrder;
    const invoice = deliveryRequest.invoice;
    const vendorName = po?.vendor?.name || invoice?.vendor?.name || "Verified Supplier";
    const poNumber = po?.poNumber || "PO-REF";

    const items =
      po?.lines?.map((line) => ({
        id: line.id,
        description: line.item?.name || line.description || "Order Item",
        quantity: line.quantity,
      })) || [];

    return NextResponse.json({
      success: true,
      authenticated: true,
      requestId: deliveryRequest.id,
      challengeCode: deliveryRequest.challengeCode,
      orderSummary: {
        vendorName,
        poNumber,
        items,
      },
    });
  } catch (err: any) {
    return safeDbErrorResponse(err, "GET /api/verifier/portal");
  }
}
