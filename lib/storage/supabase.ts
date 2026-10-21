import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { StorageProvider, SignedUploadUrlResult, SignedDownloadUrlResult, FileValidationResult } from "./types";
import { validateFile } from "./validator";

export function getEvidenceBucket(network: "testnet" | "mainnet"): string {
  const testnetBucket = process.env.EVIDENCE_BUCKET_TESTNET || "evidence-testnet";
  const mainnetBucket = process.env.EVIDENCE_BUCKET_MAINNET || "evidence-mainnet";

  if (testnetBucket.trim().toLowerCase() === mainnetBucket.trim().toLowerCase()) {
    throw new Error(
      "Storage configuration error: EVIDENCE_BUCKET_TESTNET and EVIDENCE_BUCKET_MAINNET cannot share the same bucket."
    );
  }

  return network === "mainnet" ? mainnetBucket : testnetBucket;
}

export function buildEvidencePath(params: {
  orgId: string;
  submissionId: string;
  sha256: string;
  extension: string;
}): string {
  const cleanExt = params.extension.replace(/^\./, "").toLowerCase();
  const safeSha = params.sha256.toLowerCase().replace(/[^a-f0-9]/g, "");
  const safeOrg = params.orgId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeSub = params.submissionId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `org_${safeOrg}/${safeSub}/${safeSha}.${cleanExt}`;
}

export class SupabaseStorageProvider implements StorageProvider {
  private client: SupabaseClient;
  private verifiedBuckets: Set<string> = new Set();

  constructor(supabaseUrl?: string, serviceRoleKey?: string) {
    const url = supabaseUrl || process.env.SUPABASE_URL;
    const key = serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("SupabaseStorageProvider: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.");
    }

    this.client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  private async assertBucketIsPrivate(bucket: string): Promise<void> {
    if (this.verifiedBuckets.has(bucket)) return;

    const { data, error } = await this.client.storage.getBucket(bucket);
    if (error) {
      // If bucket does not exist, attempt to create it as a private bucket
      if (error.message?.toLowerCase().includes("not found")) {
        const createRes = await this.client.storage.createBucket(bucket, {
          public: false,
          fileSizeLimit: 50 * 1024 * 1024,
        });
        if (createRes.error) {
          throw new Error(`Failed to initialize private storage bucket '${bucket}': ${createRes.error.message}`);
        }
        this.verifiedBuckets.add(bucket);
        return;
      }
      throw new Error(`Failed to verify storage bucket '${bucket}': ${error.message}`);
    }

    if (data.public) {
      throw new Error(`Storage security violation: Evidence bucket '${bucket}' is public. Must be private.`);
    }

    this.verifiedBuckets.add(bucket);
  }

  async createSignedUploadUrl(
    bucket: string,
    path: string,
    mimeType: string,
    maxBytes: number,
    expiresInSeconds: number = 900 // 15 minutes default
  ): Promise<SignedUploadUrlResult> {
    await this.assertBucketIsPrivate(bucket);

    const { data, error } = await this.client.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) {
      throw new Error(`Failed to create signed upload URL: ${error?.message || "Unknown error"}`);
    }

    return {
      uploadUrl: data.signedUrl,
      fileId: path,
      path,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    };
  }

  async createSignedDownloadUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number = 3600 // 1 hour default
  ): Promise<SignedDownloadUrlResult> {
    await this.assertBucketIsPrivate(bucket);

    const { data, error } = await this.client.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data) {
      throw new Error(`Failed to create signed download URL: ${error?.message || "Unknown error"}`);
    }

    return {
      downloadUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    };
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    await this.assertBucketIsPrivate(bucket);
    const { error } = await this.client.storage.from(bucket).remove([path]);
    if (error) {
      throw new Error(`Failed to delete storage file '${path}': ${error.message}`);
    }
  }

  async deleteObject(bucket: string, path: string): Promise<void> {
    return this.deleteFile(bucket, path);
  }

  validateFile(buffer: Buffer, expectedMime?: string): FileValidationResult {
    return validateFile(buffer, expectedMime);
  }
}
