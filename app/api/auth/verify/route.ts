import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { prisma, withDbTimeout } from "@/lib/db";
import { getActiveNetwork } from "@/lib/networks";
import {
  parseSiweMessage,
  createSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, signature, address } = body || {};

    if (!message || !signature || !address) {
      return NextResponse.json(
        { error: "Missing required parameters: message, signature, and address are required" },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Invalid Ethereum wallet address format" },
        { status: 400 }
      );
    }

    const normalizedAddress = address.toLowerCase();

    // 1. Parse structured SIWE message
    const parsed = parseSiweMessage(message);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid Sign-In With Ethereum message structure" },
        { status: 400 }
      );
    }

    if (parsed.address.toLowerCase() !== normalizedAddress) {
      return NextResponse.json(
        { error: "Message address does not match request signer address" },
        { status: 400 }
      );
    }

    // 2. Validate chain ID
    const activeNetwork = getActiveNetwork();
    if (parsed.chainId !== activeNetwork.chainId) {
      return NextResponse.json(
        {
          error: `Chain ID mismatch: message requested chain ${parsed.chainId}, but active network is ${activeNetwork.name} (${activeNetwork.chainId})`,
        },
        { status: 400 }
      );
    }

    // 3. Validate expiration time
    const expiresAtDate = new Date(parsed.expirationTime);
    if (isNaN(expiresAtDate.getTime()) || Date.now() > expiresAtDate.getTime()) {
      return NextResponse.json(
        { error: "Authentication message has expired" },
        { status: 400 }
      );
    }

    // 4. One-time nonce validation and atomic invalidation
    const nonceRecord = await withDbTimeout(() =>
      prisma.authNonce.findUnique({
        where: { nonce: parsed.nonce },
      })
    );

    if (!nonceRecord || nonceRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invalid, expired, or previously used authentication nonce" },
        { status: 401 }
      );
    }

    // Delete nonce immediately to prevent any replay attempt
    await withDbTimeout(() =>
      prisma.authNonce.delete({
        where: { nonce: parsed.nonce },
      })
    ).catch(() => {});

    // 5. Cryptographic signature verification with Viem
    const isValidSignature = await verifyMessage({
      address: normalizedAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValidSignature) {
      return NextResponse.json(
        { error: "Cryptographic signature verification failed" },
        { status: 401 }
      );
    }

    // 6. Resolve tenant organization belonging to this wallet
    const org = await withDbTimeout(() =>
      prisma.organization.findFirst({
        where: {
          OR: [
            { walletAddress: { equals: normalizedAddress, mode: "insensitive" } },
            { members: { some: { walletAddress: { equals: normalizedAddress, mode: "insensitive" } } } },
          ],
        },
      })
    );

    // 7. Create signed session token
    const sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    const token = createSessionToken({
      address: normalizedAddress,
      orgId: org ? org.id : null,
      role: "owner",
      expiresAt: sessionExpiry,
    });

    // 8. Set secure, httpOnly session cookie
    const response = NextResponse.json({
      success: true,
      address: normalizedAddress,
      org: org
        ? {
            id: org.id,
            name: org.name,
            currency: org.currency,
          }
        : null,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: "Authentication verification failed: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
