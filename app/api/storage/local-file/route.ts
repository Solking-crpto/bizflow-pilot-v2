import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { LocalStorageProvider } from "@/lib/storage/local";
import { detectMimeType } from "@/lib/storage/validator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Local storage endpoint is disabled in production." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const bucket = searchParams.get("bucket");
  const filePath = searchParams.get("path");
  const expires = searchParams.get("expires");

  if (!token || !bucket || !filePath || !expires) {
    return NextResponse.json({ error: "Missing required parameters." }, { status: 400 });
  }

  if (Date.now() > new Date(expires).getTime()) {
    return NextResponse.json({ error: "Download link has expired." }, { status: 403 });
  }

  const payload = `download:${bucket}:${filePath}:${expires}`;
  const provider = new LocalStorageProvider();

  if (!provider.verifyToken(payload, token)) {
    return NextResponse.json({ error: "Invalid signature token." }, { status: 403 });
  }

  const targetPath = provider.getFullPath(bucket, filePath);
  if (!fs.existsSync(targetPath)) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(targetPath);
  const detectedMime = detectMimeType(fileBuffer) || "application/octet-stream";

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": detectedMime,
      "Content-Length": fileBuffer.length.toString(),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
