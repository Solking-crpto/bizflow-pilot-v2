import { NextResponse } from "next/server";
import { getActiveNetwork } from "@/lib/networks";
import { getSessionCookieName } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  const activeNetwork = getActiveNetwork();
  const cookieName = getSessionCookieName(activeNetwork.mode);

  response.cookies.set({
    name: cookieName,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  // Also clear legacy cookie if present
  response.cookies.set({
    name: "bizflow_session",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
