/**
 * Client-safe SIWE (Sign-In With Ethereum) and EIP-191 message formatting utilities.
 * Does not import any Node.js or server-only modules so it can be safely used in client components.
 */

export function getSessionCookieName(networkMode?: string): string {
  const mode = networkMode || (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_NETWORK_MODE : "testnet");
  return mode === "mainnet" ? "bizflow_session_mainnet" : "bizflow_session_testnet";
}

export const SESSION_COOKIE_NAME = getSessionCookieName();

/**
 * Constructs a standard EIP-191 Sign-In With Ethereum format message.
 * Embeds network and chain ID explicitly to guarantee network isolation.
 */
export function buildSiweMessage({
  domain,
  address,
  uri,
  nonce,
  chainId,
  networkName,
  issuedAt = new Date().toISOString(),
  expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  statement,
}: {
  domain: string;
  address: string;
  uri: string;
  nonce: string;
  chainId: number;
  networkName?: string;
  issuedAt?: string;
  expirationTime?: string;
  statement?: string;
}): string {
  const activeNetwork = networkName || (chainId === 5042 ? "Arc Mainnet" : "Arc Testnet");
  const defaultStatement = `Sign in to BizFlow Pilot V2 (${activeNetwork}) with your Web3 wallet to manage suppliers, invoices, and policy-governed settlements on Arc.`;

  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    statement || defaultStatement,
    "",
    `URI: ${uri}`,
    "Version: 1",
    `Network: ${activeNetwork}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expirationTime}`,
  ].join("\n");
}

/**
 * Parses structured parameters from an EIP-191 SIWE message.
 */
export function parseSiweMessage(message: string): {
  domain: string;
  address: string;
  uri: string;
  network?: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
} | null {
  try {
    const lines = message.split("\n");
    const headerMatch = lines[0]?.match(/^(.+) wants you to sign in with your Ethereum account:$/);
    if (!headerMatch) return null;
    const domain = headerMatch[1].trim();
    const address = lines[1]?.trim();

    let uri = "";
    let network = "";
    let chainId = 0;
    let nonce = "";
    let issuedAt = "";
    let expirationTime = "";

    for (const line of lines) {
      if (line.startsWith("URI: ")) uri = line.substring(5).trim();
      else if (line.startsWith("Network: ")) network = line.substring(9).trim();
      else if (line.startsWith("Chain ID: ")) chainId = parseInt(line.substring(10).trim(), 10);
      else if (line.startsWith("Nonce: ")) nonce = line.substring(7).trim();
      else if (line.startsWith("Issued At: ")) issuedAt = line.substring(11).trim();
      else if (line.startsWith("Expiration Time: ")) expirationTime = line.substring(17).trim();
    }

    if (!domain || !address || !nonce || !chainId || !expirationTime) {
      return null;
    }

    return { domain, address, uri, network: network || undefined, chainId, nonce, issuedAt, expirationTime };
  } catch {
    return null;
  }
}
