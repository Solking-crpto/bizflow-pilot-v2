import crypto from "crypto";
import { FileValidationResult } from "./types";

export const MAX_IMAGE_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_FILES_PER_SUBMISSION = 12;

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "application/pdf",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function detectMimeType(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) return null;

  // 1. JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // 3. WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  // 4. PDF: %PDF
  if (buffer.subarray(0, 4).toString("ascii") === "%PDF") {
    return "application/pdf";
  }

  // 5. ISO Base Media File Format (MP4 / QuickTime / HEIC)
  if (buffer.length >= 12) {
    const ftyp = buffer.subarray(4, 8).toString("ascii");
    if (ftyp === "ftyp") {
      const brand = buffer.subarray(8, 12).toString("ascii").trim();
      const heicBrands = ["heic", "heix", "hevc", "mif1", "msf1"];
      if (heicBrands.includes(brand.toLowerCase())) {
        return "image/heic";
      }
      if (brand.toLowerCase() === "qt") {
        return "video/quicktime";
      }
      // MP4 brands
      return "video/mp4";
    }

    // QuickTime alternate atoms at offset 4
    const qtAtom = buffer.subarray(4, 8).toString("ascii");
    if (["moov", "mdat", "free", "wide", "skip", "pnot"].includes(qtAtom)) {
      return "video/quicktime";
    }
  }

  return null;
}

export function isForbiddenExecutableOrArchive(buffer: Buffer): { forbidden: boolean; reason?: string } {
  if (!buffer || buffer.length === 0) {
    return { forbidden: true, reason: "Empty file buffer" };
  }

  // Windows PE (.exe, .dll, .scr)
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { forbidden: true, reason: "Executable Windows PE file detected" };
  }

  // Linux ELF
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    return { forbidden: true, reason: "Executable Linux ELF binary detected" };
  }

  // Mach-O binary
  if (buffer.length >= 4) {
    const magic = buffer.subarray(0, 4);
    if (
      (magic[0] === 0xfe && magic[1] === 0xed && magic[2] === 0xfa && magic[3] === 0xce) ||
      (magic[0] === 0xfe && magic[1] === 0xed && magic[2] === 0xfa && magic[3] === 0xcf) ||
      (magic[0] === 0xce && magic[1] === 0xfa && magic[2] === 0xed && magic[3] === 0xfe) ||
      (magic[0] === 0xcf && magic[1] === 0xfa && magic[2] === 0xed && magic[3] === 0xfe) ||
      (magic[0] === 0xca && magic[1] === 0xfe && magic[2] === 0xba && magic[3] === 0xbe)
    ) {
      return { forbidden: true, reason: "Executable Mach-O or Java bytecode detected" };
    }
  }

  // Script Shebang (#!)
  if (buffer.length >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21) {
    return { forbidden: true, reason: "Script shebang header detected" };
  }

  // ZIP / JAR / APK
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
  ) {
    return { forbidden: true, reason: "Archive ZIP/JAR file detected" };
  }

  // GZIP
  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return { forbidden: true, reason: "Compressed GZIP archive detected" };
  }

  // 7Z
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x37 &&
    buffer[1] === 0x7a &&
    buffer[2] === 0xbc &&
    buffer[3] === 0xaf &&
    buffer[4] === 0x27 &&
    buffer[5] === 0x1c
  ) {
    return { forbidden: true, reason: "Compressed 7-Zip archive detected" };
  }

  // RAR
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "Rar!") {
    return { forbidden: true, reason: "Compressed RAR archive detected" };
  }

  // TAR ustar magic at offset 257
  if (buffer.length >= 262 && buffer.subarray(257, 262).toString("ascii") === "ustar") {
    return { forbidden: true, reason: "TAR archive detected" };
  }

  // HTML / SVG text payload checks in leading 1024 bytes
  const headerSlice = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("utf-8").toLowerCase();
  if (
    headerSlice.includes("<html") ||
    headerSlice.includes("<!doctype html") ||
    headerSlice.includes("<script") ||
    headerSlice.includes("<svg") ||
    (headerSlice.includes("<?xml") && headerSlice.includes("<svg"))
  ) {
    return { forbidden: true, reason: "HTML, script, or SVG vector file detected" };
  }

  return { forbidden: false };
}

export function validateFile(buffer: Buffer, expectedMime?: string): FileValidationResult {
  const sizeBytes = buffer ? buffer.length : 0;
  const sha256 = crypto.createHash("sha256").update(buffer || Buffer.alloc(0)).digest("hex");

  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      detectedMime: "application/octet-stream",
      sha256,
      sizeBytes: 0,
      error: "File is empty",
    };
  }

  // Check forbidden executable/archive/HTML
  const forbiddenCheck = isForbiddenExecutableOrArchive(buffer);
  if (forbiddenCheck.forbidden) {
    return {
      valid: false,
      detectedMime: "application/octet-stream",
      sha256,
      sizeBytes,
      error: forbiddenCheck.reason || "Forbidden file type",
    };
  }

  // Magic byte inspection
  const detectedMime = detectMimeType(buffer);
  if (!detectedMime) {
    return {
      valid: false,
      detectedMime: "application/octet-stream",
      sha256,
      sizeBytes,
      error: "Unsupported file format or unrecognised magic bytes",
    };
  }

  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(detectedMime)) {
    return {
      valid: false,
      detectedMime,
      sha256,
      sizeBytes,
      error: `Disallowed MIME type: ${detectedMime}`,
    };
  }

  // Mime match with expectedMime if provided
  if (expectedMime && expectedMime.toLowerCase() !== detectedMime.toLowerCase()) {
    return {
      valid: false,
      detectedMime,
      sha256,
      sizeBytes,
      error: `MIME type mismatch: declared ${expectedMime} but detected ${detectedMime}`,
    };
  }

  // Size limit checks
  const isVideo = detectedMime.startsWith("video/");
  const maxSize = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_PDF_SIZE_BYTES;
  if (sizeBytes > maxSize) {
    const maxMb = Math.floor(maxSize / (1024 * 1024));
    return {
      valid: false,
      detectedMime,
      sha256,
      sizeBytes,
      error: `File size exceeds the ${maxMb}MB limit for ${isVideo ? "video" : "images/PDF"}`,
    };
  }

  return {
    valid: true,
    detectedMime,
    sha256,
    sizeBytes,
  };
}
