import "server-only";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { StorageProvider, SignedUploadUrlResult, SignedDownloadUrlResult, FileValidationResult } from "./types";
import { validateFile } from "./validator";

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;
  private secret: string;

  constructor(customBaseDir?: string) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Security violation: LocalStorageProvider cannot be initialized in production environment. Supabase storage is required."
      );
    }

    this.baseDir = customBaseDir || path.resolve(process.cwd(), ".evidence-local");
    this.secret = process.env.SESSION_SECRET || "bizflow-dev-local-secret-32-chars-min!";

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private generateToken(payload: string): string {
    return crypto.createHmac("sha256", this.secret).update(payload).digest("hex");
  }

  public verifyToken(payload: string, token: string): boolean {
    const expected = this.generateToken(payload);
    try {
      return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
    } catch {
      return false;
    }
  }

  async createSignedUploadUrl(
    bucket: string,
    filePath: string,
    mimeType: string,
    maxBytes: number,
    expiresInSeconds: number = 900
  ): Promise<SignedUploadUrlResult> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const payload = `upload:${bucket}:${filePath}:${expiresAt}:${maxBytes}`;
    const token = this.generateToken(payload);

    const uploadUrl = `/api/storage/local-upload?token=${token}&bucket=${encodeURIComponent(
      bucket
    )}&path=${encodeURIComponent(filePath)}&expires=${encodeURIComponent(expiresAt)}&maxBytes=${maxBytes}`;

    return {
      uploadUrl,
      fileId: filePath,
      path: filePath,
      expiresAt,
    };
  }

  async createSignedDownloadUrl(
    bucket: string,
    filePath: string,
    expiresInSeconds: number = 3600
  ): Promise<SignedDownloadUrlResult> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const payload = `download:${bucket}:${filePath}:${expiresAt}`;
    const token = this.generateToken(payload);

    const downloadUrl = `/api/storage/local-file?token=${token}&bucket=${encodeURIComponent(
      bucket
    )}&path=${encodeURIComponent(filePath)}&expires=${encodeURIComponent(expiresAt)}`;

    return {
      downloadUrl,
      expiresAt,
    };
  }

  async deleteFile(bucket: string, filePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, bucket, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async deleteObject(bucket: string, filePath: string): Promise<void> {
    return this.deleteFile(bucket, filePath);
  }

  validateFile(buffer: Buffer, expectedMime?: string): FileValidationResult {
    return validateFile(buffer, expectedMime);
  }

  // Helper for dev test / local storage operations
  public getFullPath(bucket: string, filePath: string): string {
    return path.join(this.baseDir, bucket, filePath);
  }
}
