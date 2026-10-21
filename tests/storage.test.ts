import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import {
  validateFile,
  detectMimeType,
  isForbiddenExecutableOrArchive,
  MAX_IMAGE_PDF_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
} from "../lib/storage/validator";
import { getEvidenceBucket, buildEvidencePath } from "../lib/storage/supabase";
import { LocalStorageProvider } from "../lib/storage/local";

describe("Phase 3: Storage Provider & File Verification", () => {
  describe("File Validation & Magic Bytes", () => {
    it("detects and validates standard JPEG magic bytes", () => {
      const jpegBuf = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        Buffer.from("sample jpeg image payload"),
      ]);
      const res = validateFile(jpegBuf);
      expect(res.valid).toBe(true);
      expect(res.detectedMime).toBe("image/jpeg");
      expect(res.sha256).toBe(crypto.createHash("sha256").update(jpegBuf).digest("hex"));
    });

    it("detects and validates PNG magic bytes", () => {
      const pngBuf = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from("sample png image payload"),
      ]);
      const res = validateFile(pngBuf);
      expect(res.valid).toBe(true);
      expect(res.detectedMime).toBe("image/png");
    });

    it("detects and validates WebP magic bytes", () => {
      const webpBuf = Buffer.concat([
        Buffer.from("RIFF"),
        Buffer.from([0x24, 0x00, 0x00, 0x00]),
        Buffer.from("WEBP"),
        Buffer.from("VP8X"),
      ]);
      const res = validateFile(webpBuf);
      expect(res.valid).toBe(true);
      expect(res.detectedMime).toBe("image/webp");
    });

    it("detects and validates PDF magic bytes", () => {
      const pdfBuf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
      const res = validateFile(pdfBuf);
      expect(res.valid).toBe(true);
      expect(res.detectedMime).toBe("application/pdf");
    });

    it("detects and validates MP4 ISO media file", () => {
      const mp4Buf = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x18]),
        Buffer.from("ftyp"),
        Buffer.from("isom"),
        Buffer.from([0x00, 0x00, 0x02, 0x00]),
        Buffer.from("mp41"),
      ]);
      const res = validateFile(mp4Buf);
      expect(res.valid).toBe(true);
      expect(res.detectedMime).toBe("video/mp4");
    });

    it("rejects Windows PE executable files (MZ header)", () => {
      const exeBuf = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
      const res = validateFile(exeBuf);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Executable Windows PE");
    });

    it("rejects Linux ELF binary executables", () => {
      const elfBuf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
      const res = validateFile(elfBuf);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Executable Linux ELF");
    });

    it("rejects Mach-O binaries", () => {
      const machoBuf = Buffer.from([0xfe, 0xed, 0xfa, 0xce, 0x00, 0x00, 0x00, 0x01]);
      const res = validateFile(machoBuf);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Executable Mach-O");
    });

    it("rejects ZIP archives (PK header)", () => {
      const zipBuf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      const res = validateFile(zipBuf);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Archive ZIP");
    });

    it("rejects script shebang headers", () => {
      const scriptBuf = Buffer.from("#!/bin/bash\nrm -rf /");
      const res = validateFile(scriptBuf);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Script shebang");
    });

    it("rejects HTML and SVG vector files", () => {
      const svgBuf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const res = validateFile(svgBuf);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("HTML, script, or SVG");
    });

    it("rejects files exceeding size limit for images", () => {
      const largeImageBuf = Buffer.alloc(MAX_IMAGE_PDF_SIZE_BYTES + 1024);
      largeImageBuf[0] = 0xff;
      largeImageBuf[1] = 0xd8;
      largeImageBuf[2] = 0xff;
      largeImageBuf[3] = 0xe0;

      const res = validateFile(largeImageBuf);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("File size exceeds");
    });

    it("rejects MIME mismatch between expected and detected", () => {
      const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const res = validateFile(jpegBuf, "application/pdf");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("MIME type mismatch");
    });
  });

  describe("Bucket Configuration & Network Separation", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("returns separated bucket names for testnet and mainnet", () => {
      process.env.EVIDENCE_BUCKET_TESTNET = "testnet-evidence-vault";
      process.env.EVIDENCE_BUCKET_MAINNET = "mainnet-evidence-vault";

      expect(getEvidenceBucket("testnet")).toBe("testnet-evidence-vault");
      expect(getEvidenceBucket("mainnet")).toBe("mainnet-evidence-vault");
    });

    it("refuses to allow testnet and mainnet to share the same bucket", () => {
      process.env.EVIDENCE_BUCKET_TESTNET = "shared-evidence-bucket";
      process.env.EVIDENCE_BUCKET_MAINNET = "shared-evidence-bucket";

      expect(() => getEvidenceBucket("testnet")).toThrow(
        "cannot share the same bucket"
      );
    });
  });

  describe("Evidence Path Builder", () => {
    it("generates safe, structured bucket paths", () => {
      const path = buildEvidencePath({
        orgId: "org-12345",
        submissionId: "sub-67890",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        extension: ".jpeg",
      });

      expect(path).toBe(
        "org_org-12345/sub-67890/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.jpeg"
      );
    });
  });

  describe("Local Storage Provider (Dev Offline Mode)", () => {
    it("generates signed upload and download URLs with verifiable HMAC tokens", async () => {
      const provider = new LocalStorageProvider();
      const upload = await provider.createSignedUploadUrl(
        "evidence-testnet",
        "org_123/sub_456/sample.png",
        "image/png",
        1000000
      );

      expect(upload.uploadUrl).toContain("/api/storage/local-upload");
      expect(upload.uploadUrl).toContain("token=");

      const download = await provider.createSignedDownloadUrl(
        "evidence-testnet",
        "org_123/sub_456/sample.png",
        3600
      );

      expect(download.downloadUrl).toContain("/api/storage/local-file");
      expect(download.downloadUrl).toContain("token=");
    });

    it("refuses to initialize in production", () => {
      const oldNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";
        expect(() => new LocalStorageProvider()).toThrow("cannot be initialized in production");
      } finally {
        process.env.NODE_ENV = oldNodeEnv;
      }
    });

    it("verifies upload and file endpoints work end-to-end locally", async () => {
      const { PUT } = await import("../app/api/storage/local-upload/route");
      const { GET } = await import("../app/api/storage/local-file/route");
      const { NextRequest } = await import("next/server");

      const provider = new LocalStorageProvider();
      const signedUpload = await provider.createSignedUploadUrl(
        "evidence-testnet",
        "org_test/sub_1/test-file.png",
        "image/png",
        1000000
      );

      const fakeImage = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from("unit-test-png-data"),
      ]);

      const uploadReq = new NextRequest(`http://localhost:3002${signedUpload.uploadUrl}`, {
        method: "PUT",
        body: fakeImage,
      });

      const uploadRes = await PUT(uploadReq);
      expect(uploadRes.status).toBe(200);

      const signedDownload = await provider.createSignedDownloadUrl(
        "evidence-testnet",
        "org_test/sub_1/test-file.png",
        3600
      );

      const downloadReq = new NextRequest(`http://localhost:3002${signedDownload.downloadUrl}`, {
        method: "GET",
      });

      const downloadRes = await GET(downloadReq);
      expect(downloadRes.status).toBe(200);
      const downloadBuf = Buffer.from(await downloadRes.arrayBuffer());
      expect(downloadBuf.equals(fakeImage)).toBe(true);

      // Clean up test file
      await provider.deleteFile("evidence-testnet", "org_test/sub_1/test-file.png");
    });
  });
});

