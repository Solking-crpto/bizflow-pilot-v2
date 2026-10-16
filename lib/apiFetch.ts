"use client";

import { NETWORK_COOKIE_NAME, NETWORK_HEADER_NAME, NetworkMode, isValidNetwork } from "./networks";

/**
 * Retrieves the current active network mode on the client from document.cookie or localStorage.
 */
export function getClientActiveNetwork(): NetworkMode {
  if (typeof document === "undefined") return "mainnet";

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${NETWORK_COOKIE_NAME}=([^;]+)`));
  if (match && isValidNetwork(match[1])) {
    return match[1];
  }

  try {
    const stored = localStorage.getItem(NETWORK_COOKIE_NAME);
    if (stored && isValidNetwork(stored)) return stored;
  } catch {}

  return "mainnet";
}

/**
 * Standardized client-side fetch wrapper for all BizFlow API requests.
 * - Injects 'X-Bizflow-Network' from the active client network context.
 * - Enforces same-origin credentials so session cookies are reliably transmitted.
 * - Preserves standard fetch API signature and response streaming.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const activeNetwork = getClientActiveNetwork();

  const headers = new Headers(init?.headers || {});

  // Inject target network header if not already explicitly provided
  if (!headers.has(NETWORK_HEADER_NAME) && !headers.has("x-bizflow-network")) {
    headers.set(NETWORK_HEADER_NAME, activeNetwork);
  }

  // Ensure same-origin credentials by default
  const credentials = init?.credentials || "same-origin";

  return fetch(input, {
    ...init,
    headers,
    credentials,
  });
}
