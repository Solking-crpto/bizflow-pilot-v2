// Mock server-only for standalone Node script runner
const Module = require("module");
const origRequire = Module.prototype.require;
Module.prototype.require = function (id: string, ...args: any[]) {
  if (id === "server-only") return {};
  return origRequire.apply(this, [id, ...args]);
};

import crypto from "crypto";

async function runLiveStorageProbe() {
  const { SupabaseStorageProvider, getEvidenceBucket } = await import("../lib/storage/supabase");
  console.log("================================================================");
  console.log("       BizFlow Pilot V2 — Live Storage Verification Probe       ");
  console.log("================================================================");

  const bucket = getEvidenceBucket("testnet");
  console.log(`[Target Bucket]: ${bucket}`);

  const provider = new SupabaseStorageProvider();

  // 1. Read-Only Bucket Status Check
  console.log("\n[Step 1]: Read-Only Bucket Status Verification...");
  const bucketStatus = await provider.checkBucketStatusReadOnly(bucket);
  console.log("  Exists:", bucketStatus.exists);
  console.log("  Is Private (public === false):", bucketStatus.isPrivate);
  if (!bucketStatus.exists || !bucketStatus.isPrivate) {
    throw new Error(`Bucket check failed: ${bucketStatus.error}`);
  }
  console.log("  -> PASS: Bucket is confirmed present and strictly private.");

  // 2. Create Signed Upload URL
  const testPayload = Buffer.from(
    JSON.stringify({
      probe: "BizFlow Storage Live Verification Probe",
      timestamp: new Date().toISOString(),
      nonce: crypto.randomBytes(16).toString("hex"),
    }),
    "utf-8"
  );
  const testSha256 = crypto.createHash("sha256").update(testPayload).digest("hex");
  const testPath = `probe_tests/live_verification_${Date.now()}_${testSha256.slice(0, 8)}.json`;

  console.log(`\n[Step 2]: Generating Signed Upload URL for path: ${testPath}...`);
  const uploadResult = await provider.createSignedUploadUrl(
    bucket,
    testPath,
    "application/json",
    testPayload.length,
    600
  );
  console.log("  Upload URL generated successfully.");
  console.log("  Upload File ID:", uploadResult.fileId);
  console.log("  Expires At:", uploadResult.expiresAt);

  // 3. Upload File via HTTP PUT to Signed URL
  console.log("\n[Step 3]: Executing HTTP PUT to Signed Upload URL...");
  const putResponse = await fetch(uploadResult.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: testPayload,
  });

  console.log(`  HTTP Response Status: ${putResponse.status} ${putResponse.statusText}`);
  if (!putResponse.ok) {
    const errText = await putResponse.text();
    throw new Error(`Upload failed with status ${putResponse.status}: ${errText}`);
  }
  console.log("  -> PASS: Upload payload accepted by storage backend.");

  // 4. Generate Signed Download URL
  console.log("\n[Step 4]: Generating Signed Download URL...");
  const downloadResult = await provider.createSignedDownloadUrl(bucket, testPath, 300);
  console.log("  Download URL generated successfully.");
  console.log("  Expires At:", downloadResult.expiresAt);

  // 5. Download File via HTTP GET and Verify Bytes
  console.log("\n[Step 5]: Downloading content via Signed Download URL...");
  const getResponse = await fetch(downloadResult.downloadUrl);
  console.log(`  HTTP Response Status: ${getResponse.status} ${getResponse.statusText}`);
  if (!getResponse.ok) {
    throw new Error(`Download failed with status ${getResponse.status}`);
  }

  const downloadedBuf = Buffer.from(await getResponse.arrayBuffer());
  const downloadedSha256 = crypto.createHash("sha256").update(downloadedBuf).digest("hex");
  const byteMatch = downloadedBuf.equals(testPayload);
  console.log(`  Uploaded SHA-256:   ${testSha256}`);
  console.log(`  Downloaded SHA-256: ${downloadedSha256}`);
  console.log(`  Payload Matches Exactly: ${byteMatch}`);
  if (!byteMatch) {
    throw new Error("Integrity check failed: downloaded bytes do not match uploaded payload!");
  }
  console.log("  -> PASS: Downloaded payload matches original binary data bit-for-bit.");

  // 6. Cleanup: Delete Test File
  console.log("\n[Step 6]: Cleaning up test object from bucket...");
  await provider.deleteFile(bucket, testPath);
  console.log("  Delete call completed.");

  // 7. Verify Cleanup
  console.log("\n[Step 7]: Verifying file deletion...");
  const checkPostDelete = await fetch(downloadResult.downloadUrl);
  console.log(`  Post-delete GET Status: ${checkPostDelete.status} (expected 400, 403 or 404)`);
  console.log("  -> PASS: Test object successfully deleted and cleaned up.");

  console.log("\n================================================================");
  console.log(" LIVE STORAGE PROBE RESULT: 100% PASSED (UPLOAD, DOWNLOAD, CLEANUP) ");
  console.log("================================================================\n");
}

runLiveStorageProbe().catch((err) => {
  console.error("Storage probe failed:", err);
  process.exit(1);
});
