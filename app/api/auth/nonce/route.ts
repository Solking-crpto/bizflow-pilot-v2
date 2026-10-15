import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma, withDbTimeout } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const nonce = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Asynchronously cleanup expired nonces
    withDbTimeout(() =>
      prisma.authNonce.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      })
    ).catch(() => {});

    // Save active nonce
    await withDbTimeout(() =>
      prisma.authNonce.create({
        data: {
          nonce,
          expiresAt,
        },
      })
    );

    return NextResponse.json({ nonce }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to generate authentication nonce" },
      { status: 500 }
    );
  }
}
