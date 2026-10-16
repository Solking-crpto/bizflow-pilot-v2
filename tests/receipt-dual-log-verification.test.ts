import { describe, it, expect } from "vitest";
import {
  verifyArcTransferReceiptLogs,
  ARC_USDC_ERC20_ADDRESS,
  ARC_SYSTEM_EMITTER_ADDRESS,
  TRANSFER_EVENT_TOPIC,
} from "@/lib/payment/receipt-verifier";

describe("Arc USDC Receipt Verification — Dual Log Disambiguation", () => {
  const payer = "0x061F5c70D68A246b654724C0f9595F3a14cF9b0B";
  const recipient = "0x3B5D2009e6c2d05413AB77853158fE3f445A174d";
  const amount6 = 25_000_000n; // 25.00 USDC (6 decimals)
  const amount18 = 25_000_000_000_000_000_000n; // 25.00 USDC (18 decimals)

  const padAddress = (addr: string) =>
    "0x000000000000000000000000" + addr.toLowerCase().replace(/^0x/, "");

  const padUint256 = (val: bigint) =>
    "0x" + val.toString(16).padStart(64, "0");

  const erc20TransferLog = {
    address: ARC_USDC_ERC20_ADDRESS,
    topics: [
      TRANSFER_EVENT_TOPIC,
      padAddress(payer),
      padAddress(recipient),
    ],
    data: padUint256(amount6),
  };

  const systemTransferLog = {
    address: ARC_SYSTEM_EMITTER_ADDRESS,
    topics: [
      TRANSFER_EVENT_TOPIC,
      padAddress(payer),
      padAddress(recipient),
    ],
    data: padUint256(amount18),
  };

  // 1. Only ERC-20 log
  it("PASSES when only valid ERC-20 log is present (6 decimals)", () => {
    const result = verifyArcTransferReceiptLogs({
      logs: [erc20TransferLog],
      payerAddress: payer,
      recipientAddress: recipient,
      expectedAmountAtomic6: amount6,
    });

    expect(result.valid).toBe(true);
    expect(result.erc20Log).toBeDefined();
    expect(result.erc20Log?.address.toLowerCase()).toBe(ARC_USDC_ERC20_ADDRESS.toLowerCase());
    expect(result.systemLog).toBeNull();
  });

  // 2. Both logs (ERC-20 + System emitter log)
  it("PASSES when both ERC-20 log (6 decimals) and System emitter log (18 decimals) are present", () => {
    const result = verifyArcTransferReceiptLogs({
      logs: [erc20TransferLog, systemTransferLog],
      payerAddress: payer,
      recipientAddress: recipient,
      expectedAmountAtomic6: amount6,
    });

    expect(result.valid).toBe(true);
    expect(result.erc20Log).toBeDefined();
    expect(result.systemLog).toBeDefined();
    expect(result.systemLog?.address.toLowerCase()).toBe(ARC_SYSTEM_EMITTER_ADDRESS.toLowerCase());
  });

  // 3. Wrong emitter (System emitter alone, or random emitter)
  it("FAILS when only system emitter log is present without ERC-20 contract log", () => {
    const result = verifyArcTransferReceiptLogs({
      logs: [systemTransferLog],
      payerAddress: payer,
      recipientAddress: recipient,
      expectedAmountAtomic6: amount6,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("No matching ERC-20 Transfer log found");
  });

  it("FAILS when log is from an arbitrary unknown emitter address", () => {
    const fakeContractLog = {
      ...erc20TransferLog,
      address: "0x1234567890123456789012345678901234567890",
    };

    const result = verifyArcTransferReceiptLogs({
      logs: [fakeContractLog],
      payerAddress: payer,
      recipientAddress: recipient,
      expectedAmountAtomic6: amount6,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("No matching ERC-20 Transfer log found");
  });

  // 4. Wrong amount
  it("FAILS when ERC-20 log amount does not match expected 6-decimal atomic value", () => {
    const wrongAmountLog = {
      ...erc20TransferLog,
      data: padUint256(50_000_000n), // 50.00 USDC instead of 25.00
    };

    const result = verifyArcTransferReceiptLogs({
      logs: [wrongAmountLog],
      payerAddress: payer,
      recipientAddress: recipient,
      expectedAmountAtomic6: amount6,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("No matching ERC-20 Transfer log found");
  });

  it("FAILS when system log 18-decimal amount does not match scaled 6-decimal amount", () => {
    const mismatchedSystemLog = {
      ...systemTransferLog,
      data: padUint256(10_000_000_000_000_000_000n), // wrong 18-decimal amount
    };

    const result = verifyArcTransferReceiptLogs({
      logs: [erc20TransferLog, mismatchedSystemLog],
      payerAddress: payer,
      recipientAddress: recipient,
      expectedAmountAtomic6: amount6,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("System emitter log 18-decimal amount");
  });

  // 5. Wrong recipient
  it("FAILS when ERC-20 log recipient does not match invoice vendor destination", () => {
    const wrongRecipient = "0x9999999999999999999999999999999999999999";
    const wrongRecipientLog = {
      ...erc20TransferLog,
      topics: [
        TRANSFER_EVENT_TOPIC,
        padAddress(payer),
        padAddress(wrongRecipient),
      ],
    };

    const result = verifyArcTransferReceiptLogs({
      logs: [wrongRecipientLog],
      payerAddress: payer,
      recipientAddress: recipient,
      expectedAmountAtomic6: amount6,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("No matching ERC-20 Transfer log found");
  });

  it("FAILS when system log recipient does not match expected recipient", () => {
    const wrongRecipient = "0x9999999999999999999999999999999999999999";
    const mismatchedSystemRecipientLog = {
      ...systemTransferLog,
      topics: [
        TRANSFER_EVENT_TOPIC,
        padAddress(payer),
        padAddress(wrongRecipient),
      ],
    };

    const result = verifyArcTransferReceiptLogs({
      logs: [erc20TransferLog, mismatchedSystemRecipientLog],
      payerAddress: payer,
      recipientAddress: recipient,
      expectedAmountAtomic6: amount6,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("System emitter log recipient");
  });

  it("FAILS when multiple matching ERC-20 logs exist (ambiguity guard)", () => {
    const result = verifyArcTransferReceiptLogs({
      logs: [erc20TransferLog, erc20TransferLog],
      payerAddress: payer,
      recipientAddress: recipient,
      expectedAmountAtomic6: amount6,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Ambiguous receipt with multiple matching");
  });
});
