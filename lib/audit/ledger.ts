import { getDb } from "../db";
import { NetworkMode } from "../networks";
import { sha256, canonicalJson } from "../crypto";

export interface AuditVerificationResult {
  valid: boolean;
  totalEvents: number;
  tamperedIndex?: number;
  tamperedEventId?: string;
  error?: string;
}

const GENESIS_PREV_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Appends a tamper-evident audit event to the cryptographic hash chain
 */
export async function recordAuditEvent(
  params: {
    orgId: string;
    eventType: string;
    referenceId?: string;
    eventData: Record<string, any>;
    network?: NetworkMode;
  },
  networkArg?: NetworkMode
): Promise<{ eventId: string; eventHash: string; prevHash: string }> {
  const targetNetwork =
    networkArg ||
    params.network ||
    (process.env.TEST_NETWORK as NetworkMode) ||
    "mainnet";
  const db = getDb(targetNetwork);

  // 1. Fetch latest event in org to obtain prev_hash
  const lastEvent = await db.auditEvent.findFirst({
    where: { orgId: params.orgId },
    orderBy: { timestamp: "desc" },
  });

  const prevHash = lastEvent ? lastEvent.eventHash : GENESIS_PREV_HASH;
  const canonicalData = canonicalJson(params.eventData);
  const eventHash = sha256(`${prevHash}:${canonicalData}`);

  const event = await db.auditEvent.create({
    data: {
      orgId: params.orgId,
      eventType: params.eventType,
      referenceId: params.referenceId,
      eventData: canonicalData,
      prevHash,
      eventHash,
    },
  });

  return {
    eventId: event.id,
    eventHash,
    prevHash,
  };
}

/**
 * Traverses and cryptographically re-verifies the entire audit hash chain
 */
export async function verifyAuditChain(
  orgId: string,
  network: NetworkMode = (process.env.TEST_NETWORK as NetworkMode) || "mainnet"
): Promise<AuditVerificationResult> {
  const db = getDb(network);
  const events = await db.auditEvent.findMany({
    where: { orgId },
    orderBy: { timestamp: "asc" },
  });

  if (events.length === 0) {
    return { valid: true, totalEvents: 0 };
  }

  let expectedPrevHash = GENESIS_PREV_HASH;

  for (let i = 0; i < events.length; i++) {
    const current = events[i];

    // Check 1: prevHash matches predecessor's eventHash
    if (i === 0) {
      if (current.prevHash !== GENESIS_PREV_HASH) {
        return {
          valid: false,
          totalEvents: events.length,
          tamperedIndex: i,
          tamperedEventId: current.id,
          error: `Genesis block mismatch. Expected ${GENESIS_PREV_HASH}, found ${current.prevHash}`,
        };
      }
    } else {
      if (current.prevHash !== expectedPrevHash) {
        return {
          valid: false,
          totalEvents: events.length,
          tamperedIndex: i,
          tamperedEventId: current.id,
          error: `Hash pointer broken at event #${i + 1} (${current.eventType}). Expected prevHash ${expectedPrevHash}, found ${current.prevHash}`,
        };
      }
    }

    // Check 2: eventHash matches SHA-256(prevHash : canonicalData)
    const recalculatedHash = sha256(`${current.prevHash}:${current.eventData}`);
    if (recalculatedHash !== current.eventHash) {
      return {
        valid: false,
        totalEvents: events.length,
        tamperedIndex: i,
        tamperedEventId: current.id,
        error: `Data tampering detected at event #${i + 1} (${current.eventType}). Hash integrity check failed.`,
      };
    }

    expectedPrevHash = current.eventHash;
  }

  return {
    valid: true,
    totalEvents: events.length,
  };
}
