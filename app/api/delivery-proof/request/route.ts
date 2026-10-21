import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { safeDbErrorResponse } from "@/lib/errors";
import {
  generateToken,
  generateAccessCode,
  generateChallengeCode,
} from "@/lib/verification/security";

export const dynamic = "force-dynamic";

const CreateDeliveryRequestSchema = z.object({
  purchaseOrderId: z.string().optional(),
  invoiceId: z.string().optional(),
  verifierName: z.string().optional(),
  verifierContact: z.string().optional(),
  templateId: z.string().optional(),
  expiresInHours: z.number().int().min(1).max(720).default(72),
});

export async function POST(req: NextRequest) {
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
    const parsed = CreateDeliveryRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      purchaseOrderId,
      invoiceId,
      verifierName,
      verifierContact,
      expiresInHours,
    } = parsed.data;

    // Verify PO or Invoice belongs to this org if specified
    if (purchaseOrderId) {
      const po = await db.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, orgId: org.id },
      });
      if (!po) {
        return NextResponse.json({ error: "Purchase Order not found in organization" }, { status: 404 });
      }
    }

    if (invoiceId) {
      const invoice = await db.invoice.findFirst({
        where: { id: invoiceId, orgId: org.id },
      });
      if (!invoice) {
        return NextResponse.json({ error: "Invoice not found in organization" }, { status: 404 });
      }
      // If invoice has deliveryProofMode == "off", upgrade to "required"
      if (invoice.deliveryProofMode === "off") {
        await db.invoice.update({
          where: { id: invoiceId },
          data: { deliveryProofMode: "required" },
        });
      }
    }

    const { rawToken, tokenHash } = generateToken();
    const { rawCode, codeHash } = generateAccessCode();
    const challengeCode = generateChallengeCode();
    const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);

    const deliveryRequest = await withDbTimeout(() =>
      db.deliveryRequest.create({
        data: {
          orgId: org.id,
          purchaseOrderId: purchaseOrderId || null,
          invoiceId: invoiceId || null,
          tokenHash,
          accessCodeHash: codeHash,
          challengeCode,
          expiresAt,
          status: "pending",
          verifierName: verifierName || null,
          verifierContact: verifierContact || null,
          createdBy: session.address,
        },
      })
    );

    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "localhost:3002";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const shareUrl = `${proto}://${host}/verify-delivery/${rawToken}`;

    const orgName = org.name || "BizFlow Organization";
    const waText = `Delivery proof requested by ${orgName}.\n\n1. Open link: ${shareUrl}\n2. Enter access code: ${rawCode}\n3. Write challenge code "${challengeCode}" on paper next to goods in photo/video.\n\nThank you!`;
    const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;

    const emailSubject = `Delivery Proof Request — ${orgName}`;
    const emailBody = `Hello,\n\nPlease verify delivery using the secure link below:\n\nVerification Link: ${shareUrl}\nAccess Code: ${rawCode}\nChallenge Code: ${challengeCode}\n(Please write the challenge code on paper visible next to the goods in your evidence photos/videos).\n\nThank you,\n${orgName}`;
    const mailtoLink = `mailto:${
      verifierContact && verifierContact.includes("@") ? verifierContact : ""
    }?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    return NextResponse.json({
      success: true,
      requestId: deliveryRequest.id,
      token: rawToken,
      accessCode: rawCode,
      challengeCode,
      shareUrl,
      waLink,
      mailtoLink,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err: any) {
    return safeDbErrorResponse(err, "POST /api/delivery-proof/request");
  }
}
