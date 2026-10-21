import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { safeDbErrorResponse } from "@/lib/errors";
import { DEFAULT_CONDITION_RULES } from "@/lib/verification/conditions";

export const dynamic = "force-dynamic";

const CreateTemplateSchema = z.object({
  name: z.string().min(2, "Template name required"),
  vendorId: z.string().optional(),
  rules: z.array(
    z.object({
      ruleId: z.string(),
      severity: z.enum(["block", "warn", "info"]),
      params: z.record(z.any()).optional(),
    })
  ),
});

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

    const templates = await withDbTimeout(() =>
      db.conditionTemplate.findMany({
        where: { orgId: org.id },
        include: { vendor: true },
        orderBy: { createdAt: "desc" },
      })
    );

    // If no custom templates yet, return default template
    if (templates.length === 0) {
      return NextResponse.json({
        success: true,
        templates: [
          {
            id: "default-standard",
            name: "Standard Goods Delivery Verification",
            rules: DEFAULT_CONDITION_RULES,
            isDefault: true,
          },
        ],
      });
    }

    return NextResponse.json({
      success: true,
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        vendorId: t.vendorId,
        rules: JSON.parse(t.rulesJson),
        createdAt: t.createdAt,
      })),
    });
  } catch (err: any) {
    return safeDbErrorResponse(err, "GET /api/delivery-proof/templates");
  }
}

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
    const parsed = CreateTemplateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid template payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, vendorId, rules } = parsed.data;

    const template = await withDbTimeout(() =>
      db.conditionTemplate.create({
        data: {
          orgId: org.id,
          vendorId: vendorId || null,
          name,
          rulesJson: JSON.stringify(rules),
        },
      })
    );

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        rules,
      },
    });
  } catch (err: any) {
    return safeDbErrorResponse(err, "POST /api/delivery-proof/templates");
  }
}
