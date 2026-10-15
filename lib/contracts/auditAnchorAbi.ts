import { parseAbi } from "viem";

export const ANCHOR_ABI = parseAbi([
  "function anchor(bytes32 invoiceHash, bytes32 decisionHash, bytes32 paymentRef) external",
  "function anchorProof(bytes32 invoiceHash, bytes32 ledgerRoot) external",
  "function getAnchor(address org, bytes32 invoiceHash) external view returns (uint256 blockNumber, uint256 timestamp, bytes32 ledgerRoot)",
  "function isInvoiceAnchored(address org, bytes32 invoiceHash) external view returns (bool)",
  "event Anchored(bytes32 indexed invoiceHash, bytes32 indexed decisionHash, bytes32 indexed paymentRef, address sender, uint256 timestamp)",
  "event ProofAnchored(address indexed org, bytes32 indexed invoiceHash, bytes32 indexed ledgerRoot, uint256 blockNumber, uint256 timestamp)",
]);
