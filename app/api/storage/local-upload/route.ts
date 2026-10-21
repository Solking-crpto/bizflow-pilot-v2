import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { LocalStorageProvider } from "@/lib/storage/local";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Local storage endpoint is disabled in production." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const bucket = searchParams.get("bucket");
  const filePath = searchParams.get("path");
  const expires = searchParams.get("expires");
  const maxBytesStr = searchParams.get("maxBytes");

  if (!token || !bucket || !filePath || !expires) {
    return NextResponse.json({ error: "Missing required parameters." }, { status: 400 });
  }

  if (Date.now() > new Date(expires).getTime()) {
    return NextResponse.json({ error: "Upload URL has expired." }, { status: 403 });
  }

  const maxBytes = maxBytesStr ? parseInt(maxBytesStr, 10) : 50 * 1024 * 1024;
  const payload = `upload:${bucket}:${filePath}:${expires}:${maxBytes}`;
  const provider = new LocalStorageProvider();

  if (!provider.verifyToken(payload, token)) {
    return NextResponse.json({ error: "Invalid signature token." }, { status: 403 });
  }

  const arrayBuffer = await req.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > maxBytes) {
    return NextResponse.json({ error: `File size exceeds allowed limit of ${maxBytes} bytes.` }, { status: 413 });
  }

  const targetPath = provider.getFullPath(bucket, filePath);
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, buffer);

  return NextResponse.json({ success: true, path: filePath, size: buffer.length });
}
