// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AuditAnchor
 * @notice Immutable, tamper-evident proof registry on Arc Network for BizFlow Pilot V2.
 * @dev Compiled with evmVersion "paris" to avoid the PUSH0 opcode on Arc.
 *      Stores cryptographic commitments without leaking private company data.
 *      Uniqueness key is (msg.sender, invoiceHash) so multiple businesses anchoring invoices never collide.
 */
contract AuditAnchor {
    struct ProofRecord {
        uint256 blockNumber;
        uint256 timestamp;
        bytes32 ledgerRoot;
        bytes32 decisionHash;
    }

    /// @notice Uniqueness mapping: (orgAddress => (invoiceHash => isAnchored))
    mapping(address => mapping(bytes32 => bool)) public isInvoiceAnchored;

    /// @notice Stored anchor records by org address and invoice hash
    mapping(address => mapping(bytes32 => ProofRecord)) private _records;

    /// @notice Emitted whenever a payment settlement proof is permanently anchored
    event Anchored(
        bytes32 indexed invoiceHash,
        bytes32 indexed decisionHash,
        bytes32 indexed paymentRef,
        address sender,
        uint256 timestamp
    );

    /// @notice Emitted for non-custodial ledger root anchor proofs
    event ProofAnchored(
        address indexed org,
        bytes32 indexed invoiceHash,
        bytes32 indexed ledgerRoot,
        uint256 blockNumber,
        uint256 timestamp
    );

    /// @notice Error thrown when an invoice hash has already been registered for this organization
    error InvoiceAlreadyAnchored(address org, bytes32 invoiceHash);

    /// @notice Error thrown when an empty zero hash is supplied
    error InvalidZeroHash();

    /**
     * @notice Records an immutable proof anchor for an approved settlement (non-custodial entrypoint)
     * @param invoiceHash Cryptographic SHA-256 hash of the verified invoice document
     * @param ledgerRoot Cryptographic root of the organization's hash-chained audit ledger
     */
    function anchorProof(bytes32 invoiceHash, bytes32 ledgerRoot) external {
        if (invoiceHash == bytes32(0) || ledgerRoot == bytes32(0)) {
            revert InvalidZeroHash();
        }

        if (isInvoiceAnchored[msg.sender][invoiceHash]) {
            revert InvoiceAlreadyAnchored(msg.sender, invoiceHash);
        }

        isInvoiceAnchored[msg.sender][invoiceHash] = true;
        _records[msg.sender][invoiceHash] = ProofRecord({
            blockNumber: block.number,
            timestamp: block.timestamp,
            ledgerRoot: ledgerRoot,
            decisionHash: bytes32(0)
        });

        emit ProofAnchored(
            msg.sender,
            invoiceHash,
            ledgerRoot,
            block.number,
            block.timestamp
        );

        emit Anchored(
            invoiceHash,
            ledgerRoot,
            bytes32(0),
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Records an immutable proof anchor with decision hash and payment ref (builder/v1 compatibility)
     */
    function anchor(
        bytes32 invoiceHash,
        bytes32 decisionHash,
        bytes32 paymentRef
    ) external {
        if (invoiceHash == bytes32(0) || decisionHash == bytes32(0)) {
            revert InvalidZeroHash();
        }

        if (isInvoiceAnchored[msg.sender][invoiceHash]) {
            revert InvoiceAlreadyAnchored(msg.sender, invoiceHash);
        }

        isInvoiceAnchored[msg.sender][invoiceHash] = true;
        _records[msg.sender][invoiceHash] = ProofRecord({
            blockNumber: block.number,
            timestamp: block.timestamp,
            ledgerRoot: paymentRef,
            decisionHash: decisionHash
        });

        emit Anchored(
            invoiceHash,
            decisionHash,
            paymentRef,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Public getter returning the stored anchor details for any organization and invoice hash
     * @param org The organization's wallet address that signed the anchor
     * @param invoiceHash The cryptographic hash of the invoice
     */
    function getAnchor(
        address org,
        bytes32 invoiceHash
    ) external view returns (
        uint256 blockNumber,
        uint256 timestamp,
        bytes32 ledgerRoot
    ) {
        ProofRecord memory rec = _records[org][invoiceHash];
        return (rec.blockNumber, rec.timestamp, rec.ledgerRoot);
    }
}
