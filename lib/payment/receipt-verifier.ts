/**
 * BizFlow Pilot V2 — Arc USDC Receipt Verification (Dual Log Disambiguation)
 *
 * Technical Specification & Arc EVM Invariants:
 * On Arc, USDC is both the native gas currency and an ERC-20 token interface.
 * When an ERC-20 transfer(to, amount) is executed:
 * 1. The ERC-20 token contract at 0x3600000000000000000000000000000000000000
 *    emits a Transfer(from, to, value) log with 6-DECIMAL precision.
 * 2. The Arc system emitter at 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE
 *    (EIP-7708 native mint/transfer engine) also emits a Transfer(from, to, value)
 *    log with 18-DECIMAL precision.
 *
 * Security Requirements:
 * - NEVER match topic[0] alone. Emitter address must be verified.
 * - Require EXACTLY 1 matching ERC-20 log (correct contract, from, to, 6-decimal atomic amount).
 * - NEVER count system emitter logs toward the ERC-20 log count.
 * - If present, optionally cross-check the system emitter log for consistency (18-decimal amount = 6-decimal * 10^12).
 * - Reject receipts with 0 matching ERC-20 logs, multiple matching logs, wrong recipient, or wrong amount.
 *
 * References:
 * - https://docs.arc.io/arc/references/evm-differences
 * - https://docs.arc.io/arc/references/connect-to-arc
 */

export const ARC_USDC_ERC20_ADDRESS = "0x3600000000000000000000000000000000000000";
export const ARC_SYSTEM_EMITTER_ADDRESS = "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE";
export const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export interface ReceiptLog {
  address: string;
  topics: readonly string[] | string[];
  data: string;
}

export interface VerifyReceiptLogsParams {
  logs: ReceiptLog[];
  payerAddress: string;
  recipientAddress: string;
  expectedAmountAtomic6: bigint;
  expectedErc20Address?: string;
}

export interface VerifyReceiptLogsResult {
  valid: boolean;
  error?: string;
  erc20Log?: ReceiptLog;
  systemLog?: ReceiptLog | null;
}

/**
 * Extracts a normalized 20-byte Ethereum address from an indexed 32-byte event topic.
 */
export function extractAddressFromTopic(topic?: string): string | null {
  if (!topic || typeof topic !== "string") return null;
  const clean = topic.toLowerCase().replace(/^0x/, "");
  if (clean.length < 40) return null;
  return ("0x" + clean.slice(-40)).toLowerCase();
}

/**
 * Parses a uint256 hex string into a BigInt.
 */
export function parseBigIntData(data?: string): bigint | null {
  if (!data || typeof data !== "string") return null;
  try {
    const clean = data.trim();
    if (clean === "" || clean === "0x") return 0n;
    return BigInt(clean);
  } catch {
    return null;
  }
}

/**
 * Verifies transaction receipt logs against Arc dual-emitter specifications.
 */
export function verifyArcTransferReceiptLogs({
  logs,
  payerAddress,
  recipientAddress,
  expectedAmountAtomic6,
  expectedErc20Address,
}: VerifyReceiptLogsParams): VerifyReceiptLogsResult {
  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    return {
      valid: false,
      error: "Receipt verification failed: No transaction logs found in receipt.",
    };
  }

  const normalizedPayer = payerAddress.toLowerCase();
  const normalizedRecipient = recipientAddress.toLowerCase();
  const targetErc20 = (expectedErc20Address || ARC_USDC_ERC20_ADDRESS).toLowerCase();
  const targetSystem = ARC_SYSTEM_EMITTER_ADDRESS.toLowerCase();
  const normalizedTransferTopic = TRANSFER_EVENT_TOPIC.toLowerCase();

  // Scale 6-decimal atomic amount to 18-decimal system emitter amount: 10^12 multiplier
  const expectedAmountAtomic18 = expectedAmountAtomic6 * 1_000_000_000_000n;

  const matchingErc20Logs: ReceiptLog[] = [];
  const systemLogs: ReceiptLog[] = [];

  for (const log of logs) {
    if (!log || !log.address || !log.topics || !Array.isArray(log.topics)) {
      continue;
    }

    const emitter = log.address.toLowerCase();
    const topic0 = log.topics[0]?.toLowerCase();

    // Invariant: Never match topic0 alone without emitter validation
    if (topic0 !== normalizedTransferTopic) {
      continue;
    }

    const fromAddr = extractAddressFromTopic(log.topics[1]);
    const toAddr = extractAddressFromTopic(log.topics[2]);
    const amountVal = parseBigIntData(log.data);

    // 1. Process candidate ERC-20 contract log (6 decimals)
    if (emitter === targetErc20) {
      if (
        fromAddr === normalizedPayer &&
        toAddr === normalizedRecipient &&
        amountVal === expectedAmountAtomic6
      ) {
        matchingErc20Logs.push(log);
      }
    }

    // 2. Process system emitter log (18 decimals) - NEVER count as ERC-20 log
    if (emitter === targetSystem) {
      if (fromAddr === normalizedPayer) {
        systemLogs.push(log);
      }
    }
  }

  // Enforce rule: require EXACTLY 1 matching ERC-20 log
  if (matchingErc20Logs.length === 0) {
    return {
      valid: false,
      error:
        "Receipt verification failed: No matching ERC-20 Transfer log found matching payer, recipient, and 6-decimal atomic amount.",
    };
  }

  if (matchingErc20Logs.length > 1) {
    return {
      valid: false,
      error:
        "Receipt verification failed: Ambiguous receipt with multiple matching ERC-20 Transfer logs.",
    };
  }

  // Cross-check system emitter log if present
  let validatedSystemLog: ReceiptLog | null = null;
  if (systemLogs.length > 0) {
    for (const sysLog of systemLogs) {
      const sysTo = extractAddressFromTopic(sysLog.topics[2]);
      const sysAmount = parseBigIntData(sysLog.data);

      if (sysTo !== normalizedRecipient) {
        return {
          valid: false,
          error: `Receipt verification failed: System emitter log recipient (${sysTo}) does not match expected recipient (${normalizedRecipient}).`,
        };
      }

      if (sysAmount !== expectedAmountAtomic18) {
        return {
          valid: false,
          error: `Receipt verification failed: System emitter log 18-decimal amount (${sysAmount}) does not match expected scaled value (${expectedAmountAtomic18}).`,
        };
      }

      validatedSystemLog = sysLog;
      break;
    }
  }

  return {
    valid: true,
    erc20Log: matchingErc20Logs[0],
    systemLog: validatedSystemLog,
  };
}
