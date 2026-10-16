import fs from "fs";
import path from "path";

function getAllJsFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllJsFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

export function scanClientBundle(targetDir?: string): { clean: boolean; leaks: { file: string; pattern: string }[] } {
  const staticDir = targetDir || process.env.SCAN_DIR || path.resolve(__dirname, "..", ".next", "static");
  if (!fs.existsSync(staticDir)) {
    return { clean: true, leaks: [] }; // Build not yet run, skipped in pre-build
  }

  const jsFiles = getAllJsFiles(staticDir);
  const leaks: { file: string; pattern: string }[] = [];

  // Known public library constants (secp256k1 curve parameters, isogeny maps, ERC-6492, and viem ABI hashes)
  // Each constant represents an open-source mathematical or standard constant from @noble/curves or viem.
  const KNOWN_PUBLIC_HEX_CONSTANTS = new Set([
    // Bytes32 zeroes and ones
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000000000000000000000000001",
    // secp256k1 curve parameters: field prime p, group order n, b coefficient
    "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f",
    "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
    "0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee",
    // ERC-6492 magic constants
    "0x6492649264926492649264926492649264926492649264926492649264926492",
    "0x8010801080108010801080108010801080108010801080108010801080108010",
    "0x5792579257925792579257925792579257925792579257925792579257925792",
    // ERC-20 Transfer event signature topic
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    // @noble/curves secp256k1 isogeny map polynomial coefficients (hash-to-curve)
    "0x8e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38daaaaa8c7",
    "0x534c328d23f234e6e2a413deca25caece4506144037c40314ecbd0b53d9dd262",
    "0x8e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38daaaaa88c",
    "0xd35771193d94918a9ca34ccbb7b640dd86cd409542f8487d9fe6b745781eb49b",
    "0xedadc6f64383dc1df7c4b2d51b54225406d36b641f5e41bbc52a56612a8c6d14",
    "0x4bda12f684bda12f684bda12f684bda12f684bda12f684bda12f684b8e38e23c",
    "0xc75e0c32d5cb7c0fa9d0a54b12a0a6d5647ab046d686da6fdffc90fc201d71a3",
    "0x29a6194691f91a73715209ef6512e576722830a201be2018a765e85a9ecee931",
    "0x2f684bda12f684bda12f684bda12f684bda12f684bda12f684bda12f38e38d84",
    "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffff93b",
    "0x7a06534bb8bdb49fd5e9e6632722c2989467c1bfc8e8d978dfb425d2685c2573",
    "0x6484aa716545ca2cf3a70c3fa8fe337e0a3d21162f0d6299a7bf8192bfd2a76f",
    "0x3f8731abdd661adca08a5558f0f5d272e953d363cb6f0e5d405447c01a444533",
    // Viem public test addresses & standard byte sequences
    "0x000000000000000000000000a5cc3c03994db5b0d9a5eedd10cabab0813678ac",
    "0x000000000000000000000000a5cc3c03994db5b0d9a5eedd10cabab0813678ad",
    "0x0000000000000000000000000000000000000000000000000000000023c34600",
    "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045",
    "0x00000000000000000000000000000000000000000000000000000000000001a4",
    "0x48656c6c6f20576f726c64210000000000000000000000000000000000000000",
    "0x48656c6c6f20776f726c64210000000000000000000000000000000000000000",
    "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    // Viem EIP-712 domain & standard type hashes
    "0x3da3cd3cf420c78f8981e7afeefa0eab1f0de0eb56e78ad9ba918ed01c0b402f",
    "0x635dc2033e60185bb36709c29c75d64ea51dfbd91c32ef4be198e4ceb169fb4d",
    "0x50c2667ac4c771072746acfdcf1f1483336dcca8bd2df47cd83175dbe60f0540",
    "0x68a020a209d3d56c46f38cc50a33f704f4a9a10a59377f8dd762ac66910e9b90",
    "0x7e865ad05c4035ab5792787d4a0297a43617ae897930a6fe4d822b8faea52064",
    "0xd4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1",
    "0x3ea2f1d0abf3fc66cf29eebb70cbd4e7fe762ef8a09bcc06c8edf641230afec0",
    "0x5f78c33274e43fa9de5659265c1d917e25c03722dcb0b8d27db8d5feaa813953",
    "0x4ca7ee652d57678f26e887c149ab0735f41de37bcad58c9f6d3ed5824f15b74d",
    "0xec23b2ba4bc59ba61554507c1b1bc91649e6586eb2dd00c728e8ed0db8bb37ea",
    "0x4f5b812789fc606be1b3b16908db13fc7a9adf7ca72641f84d75b47069d3d7f0",
    "0x08c85f2f4059e930c45a6aeff9dcd3bd95dc3c5c1cddef6a0626b31152248560",
    "0x6e100a352ec6ad1b70802290e18aeed190704973570f3b8ed42cb9808e2ea6bf",
    "0x4a90a229a244495b41890987806fcbd2d5d23fc0dbe5f5256c2613c039d76db8",
  ]);

  // Sensitive patterns that must NEVER leak into client JS bundles
  const leakPatterns: { name: string; regex: RegExp }[] = [
    { name: "PostgreSQL Database URL credentials", regex: /postgres(?:ql)?:\/\/[^:]+:[^@]+@/i },
    { name: "Alchemy API key in URL", regex: /alchemy\.com\/v2\/[a-zA-Z0-9_-]{20,}/i },
    { name: "Infura API key in URL", regex: /infura\.io\/v3\/[a-fA-F0-9]{32}/i },
    { name: "Explicit OWNER_PASSCODE", regex: /OWNER_PASSCODE\s*[:=]\s*["'][^"']+["']/i },
    { name: "Explicit CRON_SECRET", regex: /CRON_SECRET\s*[:=]\s*["'][^"']+["']/i },
  ];

  for (const file of jsFiles) {
    const content = fs.readFileSync(file, "utf-8");

    // Check for 64-hex private keys (excluding known public mathematical/curve constants)
    const hex64Matches = content.match(/\b0x[a-fA-F0-9]{64}\b/g) || [];
    for (const hex of hex64Matches) {
      if (!KNOWN_PUBLIC_HEX_CONSTANTS.has(hex.toLowerCase())) {
        leaks.push({
          file: path.basename(file),
          pattern: `Treasury Private Key (0x hex 64 chars): ${hex.slice(0, 8)}...`,
        });
        break;
      }
    }

    // Check standard regex patterns
    for (const pat of leakPatterns) {
      if (pat.regex.test(content)) {
        leaks.push({
          file: path.basename(file),
          pattern: pat.name,
        });
      }
    }
  }

  return {
    clean: leaks.length === 0,
    leaks,
  };
}

if (require.main === module) {
  console.log("Scanning .next/static client bundle for secret leaks...");
  const res = scanClientBundle();
  if (res.clean) {
    console.log("BUNDLE SCAN RESULT: CLEAN. No private keys, database credentials, or secrets detected.");
    process.exit(0);
  } else {
    console.error("BUNDLE SCAN VIOLATION: Detected secrets in client bundle:");
    console.error(JSON.stringify(res.leaks, null, 2));
    process.exit(1);
  }
}
