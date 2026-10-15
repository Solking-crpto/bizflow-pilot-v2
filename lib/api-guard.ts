/**
 * BizFlow Pilot V2 — API Network Context & Guardrails
 * 
 * Validates request-scoped network context for all API routes:
 * 1. Reads the 'bizflow_network' cookie, defaulting to DEFAULT_NETWORK.
 * 2. On state-changing methods (POST, PUT, PATCH, DELETE), verifies that the
 *    'X-Bizflow-Network' header is present and strictly matches the active cookie.
 *    Returns 409 Conflict if there is a mismatch or missing header to prevent
 *    stale tabs from acting on the wrong network.
 * 3. Returns the typed network ("mainnet" | "testnet") and scoped PrismaClient from getDb(network).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  NetworkMode,
  getServerActiveNetwork,
  NETWORK_COOKIE_NAME,
  NETWORK_HEADER_NAME,
  isValidNetwork,
  DEFAULT_NETWORK,
} from "./networks";
import { getDb } from "./db";
import { PrismaClient } from "@prisma/client";

export type ApiNetworkResult = {
  success: boolean;
  network: NetworkMode;
  db: PrismaClient;
  response?: NextResponse;
  errorResponse?: NextResponse;
};

/**
 * Extracts and validates the active network from an API request.
 */
export function validateApiNetwork(req: NextRequest | Request): ApiNetworkResult {
  // 1. Resolve cookie network
  let cookieVal: string | null = null;
  if ("cookies" in req && typeof (req as NextRequest).cookies.get === "function") {
    cookieVal = (req as NextRequest).cookies.get(NETWORK_COOKIE_NAME)?.value || null;
  } else {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${NETWORK_COOKIE_NAME}=([^;]+)`));
    cookieVal = match ? match[1] : null;
  }

  const cookieNetwork = getServerActiveNetwork(cookieVal);

  // 2. State-changing requests MUST send X-Bizflow-Network header matching cookie
  const method = req.method.toUpperCase();
  const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (isStateChanging) {
    const headerVal =
      req.headers.get(NETWORK_HEADER_NAME) ||
      req.headers.get("x-bizflow-network") ||
      req.headers.get("X-Bizflow-Network");

    if (!headerVal) {
      const errRes = NextResponse.json(
        {
          error:
            "Missing required header 'X-Bizflow-Network'. All state-changing requests must declare their target network.",
          code: "MISSING_NETWORK_HEADER",
          activeNetwork: cookieNetwork,
        },
        { status: 409 }
      );
      return {
        success: false,
        network: cookieNetwork,
        db: getDb(cookieNetwork),
        response: errRes,
        errorResponse: errRes,
      };
    }

    const normalizedHeader = headerVal.toLowerCase().trim();
    if (!isValidNetwork(normalizedHeader)) {
      const errRes = NextResponse.json(
        {
          error: `Invalid 'X-Bizflow-Network' header '${headerVal}'. Must be 'mainnet' or 'testnet'.`,
          code: "INVALID_NETWORK_HEADER",
          activeNetwork: cookieNetwork,
        },
        { status: 409 }
      );
      return {
        success: false,
        network: cookieNetwork,
        db: getDb(cookieNetwork),
        response: errRes,
        errorResponse: errRes,
      };
    }

    if (normalizedHeader !== cookieNetwork) {
      const errRes = NextResponse.json(
        {
          error: `Network conflict: Tab target network '${normalizedHeader}' does not match active session network '${cookieNetwork}'. Reload the tab to synchronize.`,
          code: "NETWORK_MISMATCH_CONFLICT",
          headerNetwork: normalizedHeader,
          cookieNetwork: cookieNetwork,
        },
        { status: 409 }
      );
      return {
        success: false,
        network: cookieNetwork,
        db: getDb(cookieNetwork),
        response: errRes,
        errorResponse: errRes,
      };
    }
  }

  return {
    success: true,
    network: cookieNetwork,
    db: getDb(cookieNetwork),
  };
}

/**
 * Helper for Server Actions or Server Components to resolve network and DB.
 */
export function getServerContext(cookieVal?: string | null): {
  network: NetworkMode;
  db: PrismaClient;
} {
  const network = getServerActiveNetwork(cookieVal);
  return {
    network,
    db: getDb(network),
  };
}
