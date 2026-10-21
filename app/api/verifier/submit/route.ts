import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getDb, withDbTimeout } from "@/lib/db";
import { getServerActiveNetwork } from "@/lib/networks";
import { safeDbErrorResponse } from "@/lib/errors";
import {
  hashToken,
  verifyVerifierSessionToken,
  VERIFIER_SESSION_COOKIE,
} from "@/lib/verification/security";
import { assessEvidence } from "@/lib/verification/ai";
import {
  evaluate,
  DEFAULT_CONDITION_RULES,
  ConditionRuleConfig,
  VerificationEvaluationInput,
} from "@/lib/verification/conditions";

import { resolveVerifierDb } from "@/lib/verification/resolver";

export const dynamic = "force-dynamic";

const SubmitVerificationSchema = z.object({
  token: z.string().min(10),
  receivedQuantities: z.record(z.number()),
  verifierName: z.string().min(1, "Verifier name is required"),
  verifierContact: z.string().min(1, "Verifier contact is required"),
  note: z.string().optional(),
  consentGiven: z.boolean(),
  fileIds: z.array(z.string()).min(1, "At least 1 evidence file is required").max(12),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = SubmitVerificationSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid submission data", details: parsed.error.format() }, { status: 400 });
    }

    const {
      token,
      receivedQuantities,
      verifierName,
      verifierContact,
      note,
      consentGiven,
      fileIds,
    } = parsed.data;

    if (!consentGiven) {
      return NextResponse.json(
        { error: "Consent required: Please accept the privacy consent notice before submitting." },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);
    const resolved = await resolveVerifierDb(tokenHash, req.cookies.get("bizflow_network")?.value);
    const db = resolved ? resolved.db : getDb("testnet");

    // Verify session cookie
    const sessionCookie = req.cookies.get(VERIFIER_SESSION_COOKIE)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized session" }, { status: 401 });
    }

    const sessionVerify = verifyVerifierSessionToken(sessionCookie);
    if (!sessionVerify.valid || sessionVerify.tokenHash !== tokenHash) {
      return NextResponse.json({ error: "Invalid or expired verifier session" }, { status: 401 });
    }

    const deliveryRequest = await withDbTimeout(
      () =>
        db.deliveryRequest.findUnique({
          where: { tokenHash },
          include: {
            purchaseOrder: {
              include: {
                lines: { include: { item: true } },
              },
            },
            invoice: true,
            evidenceFiles: true,
            submission: true,
          },
        }),
      30000
    );

    if (!deliveryRequest) {
      return NextResponse.json({ error: "Delivery request not found" }, { status: 404 });
    }

    if (deliveryRequest.submission) {
      return NextResponse.json(
        { error: "Proof has already been submitted for this delivery request." },
        { status: 409 }
      );
    }

    // 1. Create VerificationSubmission
    const submission = await withDbTimeout(() =>
      db.verificationSubmission.create({
        data: {
          requestId: deliveryRequest.id,
          receivedQuantitiesJson: JSON.stringify(receivedQuantities),
          note: note?.trim() || null,
          consentGiven: true,
        },
      })
    );

    // 2. Update DeliveryRequest verifier info and status
    await withDbTimeout(() =>
      db.deliveryRequest.update({
        where: { id: deliveryRequest.id },
        data: {
          status: "submitted",
          verifierName: verifierName.trim(),
          verifierContact: verifierContact.trim(),
        },
      })
    );

    // 3. Perform AI Evidence Assessment (Advisory Only)
    const po = deliveryRequest.purchaseOrder;
    const poItems =
      po?.lines?.map((line) => ({
        description: line.item?.name || line.description || "Order Item",
        quantity: line.quantity,
      })) || [];

    const aiResult = await assessEvidence({
      expectedChallengeCode: deliveryRequest.challengeCode,
      purchaseOrderItems: poItems,
    });

    // 4. Retrieve historical org SHA-256s for duplicate screening
    const historicalFiles = await withDbTimeout(() =>
      db.evidenceFile.findMany({
        where: {
          request: { orgId: deliveryRequest.orgId },
          requestId: { not: deliveryRequest.id },
        },
        select: { sha256: true },
        take: 500,
      })
    );
    const historicalSha256s = historicalFiles.map((f) => f.sha256);

    // 5. Evaluate Conditions Engine
    const evalInput: VerificationEvaluationInput = {
      files: deliveryRequest.evidenceFiles.map((f) => ({
        sha256: f.sha256,
        kind: f.kind,
        size: f.size,
        mime: f.mime,
      })),
      historicalOrgSha256s: historicalSha256s,
      submission: {
        receivedQuantities,
        verifierName: verifierName.trim(),
        verifierContact: verifierContact.trim(),
        submittedAt: submission.submittedAt,
      },
      purchaseOrder: po
        ? {
            items: poItems,
            expectedDeliveryDate: po.orderDate,
          }
        : undefined,
      invoice: deliveryRequest.invoice
        ? {
            totalUsdc: deliveryRequest.invoice.totalUsdc,
            status: deliveryRequest.invoice.status,
          }
        : undefined,
      expectedChallengeCode: deliveryRequest.challengeCode,
      aiExtraction: {
        extractedChallengeCode: aiResult.assessment.extractedChallengeCode || undefined,
        challengeCodeConfidence: aiResult.assessment.challengeCodeConfidence,
        similarityScore: aiResult.assessment.overallMatchConfidence,
        extractedItems: aiResult.assessment.itemsObserved.map((i) => ({
          description: i.description,
          quantity: i.estimatedQuantity,
        })),
      },
    };

    const conditionRules: ConditionRuleConfig[] = DEFAULT_CONDITION_RULES;
    const evaluation = evaluate(evalInput, conditionRules);

    const reportHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(evaluation.ruleResults))
      .digest("hex");

    // 6. Create VerificationReport
    const report = await withDbTimeout(() =>
      db.verificationReport.create({
        data: {
          requestId: deliveryRequest.id,
          templateSnapshotJson: JSON.stringify(conditionRules),
          resultsJson: JSON.stringify(evaluation.ruleResults),
          overall: evaluation.overall,
          aiUsed: true,
          reportHash,
        },
      })
    );

    // 7. Create in-app Notification for organization owner
    await withDbTimeout(() =>
      db.notification.create({
        data: {
          orgId: deliveryRequest.orgId,
          type: "delivery_proof_submitted",
          payloadJson: JSON.stringify({
            requestId: deliveryRequest.id,
            poNumber: po?.poNumber || "N/A",
            verifierName: verifierName.trim(),
            overall: evaluation.overall,
            filesCount: fileIds.length,
          }),
        },
      })
    );

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      overall: evaluation.overall,
      reportId: report.id,
      submittedAt: submission.submittedAt,
    });
  } catch (err: any) {
    return safeDbErrorResponse(err, "POST /api/verifier/submit");
  }
}
