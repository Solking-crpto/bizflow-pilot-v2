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

  async checkBucketStatusReadOnly(bucket: string): Promise<{
    exists: boolean;
    isPrivate: boolean;
    error?: string;
  }> {
    const { data, error } = await this.client.storage.getBucket(bucket);
    if (error) {
      if (error.message?.toLowerCase().includes("not found")) {
        return {
          exists: false,
          isPrivate: false,
          error: `Storage bucket '${bucket}' is missing. Please create it as a private bucket in Supabase.`,
        };
      }
      return {
        exists: false,
        isPrivate: false,
        error: `Failed to query storage bucket '${bucket}': ${error.message}`,
      };
    }

    if (data.public) {
      return {
        exists: true,
        isPrivate: false,
        error: `Storage security violation: Evidence bucket '${bucket}' is public. It must be private.`,
      };
    }

    return { exists: true, isPrivate: true };
  }

  private async assertBucketIsPrivate(bucket: string): Promise<void> {
    if (this.verifiedBuckets.has(bucket)) return;

    const status = await this.checkBucketStatusReadOnly(bucket);
    if (!status.exists) {
      throw new Error(`Storage configuration error: ${status.error}`);
    }
    if (!status.isPrivate) {
      throw new Error(`Storage security violation: ${status.error}`);
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

export async function verifyEvidenceBucketReadOnly(network: "testnet" | "mainnet"): Promise<{
  bucket: string;
  exists: boolean;
  isPrivate: boolean;
  error?: string;
}> {
  const bucket = getEvidenceBucket(network);
  const provider = new SupabaseStorageProvider();
  const status = await provider.checkBucketStatusReadOnly(bucket);
  return {
    bucket,
    ...status,
  };
}
