import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import path from "path";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork } from "@/lib/networks";
import { safeDbErrorResponse } from "@/lib/errors";
import { recordAuditEvent } from "@/lib/audit/ledger";
import {
  hashToken,
  verifyVerifierSessionToken,
  VERIFIER_SESSION_COOKIE,
} from "@/lib/verification/security";
import {
  getStorageProvider,
  getEvidenceBucket,
  buildEvidencePath,
  ALLOWED_MIME_TYPES,
  MAX_IMAGE_PDF_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  MAX_FILES_PER_SUBMISSION,
} from "@/lib/storage";

import { resolveVerifierDb } from "@/lib/verification/resolver";

export const dynamic = "force-dynamic";

const UploadUrlSchema = z.object({
  token: z.string().min(10),
  fileName: z.string().min(1),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
  kind: z.enum(["photo", "video", "document", "pdf", "signature", "keyframe"]),
  sha256: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = UploadUrlSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload request", details: parsed.error.format() }, { status: 400 });
    }

    const { token, fileName, mimeType, sizeBytes, kind } = parsed.data;
    const tokenHash = hashToken(token);
    const resolved = await resolveVerifierDb(tokenHash, req.cookies.get("bizflow_network")?.value);
    const network = resolved ? resolved.network : "testnet";
    const db = resolved ? resolved.db : getDb(network);

    // Verify session cookie
    const sessionCookie = req.cookies.get(VERIFIER_SESSION_COOKIE)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized verifier session" }, { status: 401 });
    }

    const sessionVerify = verifyVerifierSessionToken(sessionCookie);
    if (!sessionVerify.valid || sessionVerify.tokenHash !== tokenHash) {
      return NextResponse.json({ error: "Invalid or expired verifier session" }, { status: 401 });
    }

    const deliveryRequest = await withDbTimeout(() =>
      db.deliveryRequest.findUnique({
        where: { tokenHash },
        include: { evidenceFiles: true },
      })
    );

    if (!deliveryRequest) {
      return NextResponse.json({ error: "Delivery request not found" }, { status: 404 });
    }

    if (deliveryRequest.evidenceFiles.length >= MAX_FILES_PER_SUBMISSION) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_FILES_PER_SUBMISSION} files allowed per verification submission.` },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      return NextResponse.json(
        { error: `Disallowed MIME type: ${mimeType}. Allowed formats: JPG, PNG, WEBP, HEIC, MP4, MOV, PDF.` },
        { status: 400 }
      );
    }

    // Validate size limit
    const isVideo = mimeType.startsWith("video/");
    const maxSize = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_PDF_SIZE_BYTES;
    if (sizeBytes > maxSize) {
      const maxMb = isVideo ? 50 : 10;
      return NextResponse.json(
        { error: `File size exceeds the ${maxMb}MB limit for ${isVideo ? "video" : "images/PDF"}.` },
        { status: 413 }
      );
    }

    const ext = path.extname(fileName) || (isVideo ? ".mp4" : mimeType.includes("pdf") ? ".pdf" : ".jpg");
    const fileSha = parsed.data.sha256 || crypto.randomBytes(16).toString("hex");

    const storagePath = buildEvidencePath({
      orgId: deliveryRequest.orgId,
      submissionId: deliveryRequest.id,
      sha256: fileSha,
      extension: ext,
    });

    const storage = getStorageProvider();
    const bucket = getEvidenceBucket(network);

    const signedUpload = await storage.createSignedUploadUrl(
      bucket,
      storagePath,
      mimeType,
      sizeBytes,
      1800 // 30 minutes upload window
    );

    const deleteAfter = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days retention

    const evidenceFile = await withDbTimeout(() =>
      db.evidenceFile.create({
        data: {
          requestId: deliveryRequest.id,
          kind,
          storagePath,
          sha256: fileSha,
          mime: mimeType,
          size: sizeBytes,
          uploadedByRole: "verifier",
          status: "uploaded",
          deleteAfter,
        },
      })
    );

    // Record Audit Event: evidence_uploaded with SHA-256 hash
    await recordAuditEvent({
      orgId: deliveryRequest.orgId,
      eventType: "evidence_uploaded",
      referenceId: evidenceFile.id,
      eventData: {
        requestId: deliveryRequest.id,
        fileId: evidenceFile.id,
        kind,
        sha256: fileSha,
        mime: mimeType,
        size: sizeBytes,
      },
      network: network as any,
    });

    return NextResponse.json({
      success: true,
      fileId: evidenceFile.id,
      uploadUrl: signedUpload.uploadUrl,
      storagePath,
    });
  } catch (err: any) {
    return safeDbErrorResponse(err, "POST /api/verifier/upload-url");
  }
}
