const solc = require("solc");
const fs = require("fs");
const path = require("path");

const anchorSource = fs.readFileSync(path.join(__dirname, "../contracts/AuditAnchor.sol"), "utf8");
const vaultSource = fs.readFileSync(path.join(__dirname, "../contracts/PolicyVault.sol"), "utf8");

const input = {
  language: "Solidity",
  sources: {
    "AuditAnchor.sol": { content: anchorSource },
    "PolicyVault.sol": { content: vaultSource },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors) {
  for (const err of output.errors) {
    if (err.severity === "error") {
      console.error(err.formattedMessage);
    } else {
      console.warn(err.formattedMessage);
    }
  }
}

fs.mkdirSync(path.join(__dirname, "../artifacts/contracts"), { recursive: true });

// 1. AuditAnchor
const anchorContract = output.contracts["AuditAnchor.sol"]["AuditAnchor"];
fs.writeFileSync(
  path.join(__dirname, "../artifacts/contracts/AuditAnchor.json"),
  JSON.stringify({
    contractName: "AuditAnchor",
    abi: anchorContract.abi,
    bytecode: "0x" + anchorContract.evm.bytecode.object,
  }, null, 2)
);
console.log("Compiled AuditAnchor (Paris EVM):", anchorContract.abi.length, "ABI items");

// 2. PolicyVault
const vaultContract = output.contracts["PolicyVault.sol"]["PolicyVault"];
fs.writeFileSync(
  path.join(__dirname, "../artifacts/contracts/PolicyVault.json"),
  JSON.stringify({
    contractName: "PolicyVault",
    abi: vaultContract.abi,
    bytecode: "0x" + vaultContract.evm.bytecode.object,
  }, null, 2)
);
console.log("Compiled PolicyVault (Paris EVM):", vaultContract.abi.length, "ABI items");

