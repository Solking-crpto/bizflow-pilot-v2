export interface SignedUploadUrlResult {
  uploadUrl: string;
  fileId: string;
  path: string;
  expiresAt: string;
}

export interface SignedDownloadUrlResult {
  downloadUrl: string;
  expiresAt: string;
}

export interface FileValidationResult {
  valid: boolean;
  detectedMime: string;
  sha256: string;
  sizeBytes: number;
  error?: string;
}

export interface StorageProvider {
  createSignedUploadUrl(
    bucket: string,
    path: string,
    mimeType: string,
    maxBytes: number,
    expiresInSeconds?: number
  ): Promise<SignedUploadUrlResult>;

  createSignedDownloadUrl(
    bucket: string,
    path: string,
    expiresInSeconds?: number
  ): Promise<SignedDownloadUrlResult>;

  deleteFile(bucket: string, path: string): Promise<void>;
  deleteObject(bucket: string, path: string): Promise<void>;

  validateFile(buffer: Buffer, expectedMime?: string): FileValidationResult;
}
