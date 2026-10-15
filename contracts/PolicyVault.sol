// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PolicyVault
 * @notice On-chain corporate policy enforcement vault for BizFlow Pilot V2.
 * @dev Compiled with evmVersion "paris" for Arc EVM compatibility.
 *      Enforces per-transaction limits, daily spend caps, vendor allowlists,
 *      and operator authorization directly at the smart contract level.
 */
contract PolicyVault {
    address public owner;
    address public operator;
    bool public paused;

    uint256 public perTransactionLimit;
    uint256 public dailyLimit;

    uint256 public currentDay;
    uint256 public dailySpent;

    mapping(address => bool) public approvedVendors;

    event PaymentDispatched(
        address indexed vendor,
        uint256 amount,
        bytes32 indexed invoiceHash,
        uint256 timestamp
    );
    event VendorApprovalChanged(address indexed vendor, bool approved);
    event LimitsUpdated(uint256 perTransactionLimit, uint256 dailyLimit);
    event VaultPaused(bool isPaused);
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event FundsReceived(address indexed sender, uint256 amount);

    error UnauthorizedCaller(address caller);
    error VaultIsPaused();
    error VendorNotApproved(address vendor);
    error ExceedsPerTransactionLimit(uint256 amount, uint256 limit);
    error ExceedsDailyLimit(uint256 amount, uint256 currentSpent, uint256 limit);
    error InvalidZeroAddress();
    error InvalidZeroAmount();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator && msg.sender != owner) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }

    modifier whenNotPaused() {
        if (paused) {
            revert VaultIsPaused();
        }
        _;
    }

    constructor(
        address _operator,
        uint256 _perTransactionLimit,
        uint256 _dailyLimit
    ) {
        if (_operator == address(0)) revert InvalidZeroAddress();
        owner = msg.sender;
        operator = _operator;
        perTransactionLimit = _perTransactionLimit;
        dailyLimit = _dailyLimit;
        currentDay = block.timestamp / 86400;
    }

    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }

    /**
     * @notice Executes a policy-bounded payment to an approved vendor
     * @param vendor Beneficiary vendor address
     * @param amount Atomic payment amount in native currency / USDC units
     * @param invoiceHash Cryptographic hash of the reconciled invoice
     */
    function pay(
        address payable vendor,
        uint256 amount,
        bytes32 invoiceHash
    ) external onlyOperator whenNotPaused {
        if (vendor == address(0)) revert InvalidZeroAddress();
        if (amount == 0) revert InvalidZeroAmount();
        if (!approvedVendors[vendor]) revert VendorNotApproved(vendor);
        if (amount > perTransactionLimit) {
            revert ExceedsPerTransactionLimit(amount, perTransactionLimit);
        }

        uint256 today = block.timestamp / 86400;
        if (today > currentDay) {
            currentDay = today;
            dailySpent = 0;
        }

        if (dailySpent + amount > dailyLimit) {
            revert ExceedsDailyLimit(amount, dailySpent, dailyLimit);
        }

        dailySpent += amount;

        emit PaymentDispatched(vendor, amount, invoiceHash, block.timestamp);

        // Disburse native USDC if vault balance is sufficient
        if (address(this).balance >= amount) {
            (bool success, ) = vendor.call{value: amount}("");
            if (!success) revert TransferFailed();
        }
    }

    function setVendorApproval(address vendor, bool approved) external onlyOwner {
        if (vendor == address(0)) revert InvalidZeroAddress();
        approvedVendors[vendor] = approved;
        emit VendorApprovalChanged(vendor, approved);
    }

    function setLimits(uint256 _perTxLimit, uint256 _dailyLimit) external onlyOwner {
        perTransactionLimit = _perTxLimit;
        dailyLimit = _dailyLimit;
        emit LimitsUpdated(_perTxLimit, _dailyLimit);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit VaultPaused(_paused);
    }

    function setOperator(address _operator) external onlyOwner {
        if (_operator == address(0)) revert InvalidZeroAddress();
        address previous = operator;
        operator = _operator;
        emit OperatorUpdated(previous, _operator);
    }
}
