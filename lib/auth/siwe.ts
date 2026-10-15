/**
 * Client-safe SIWE (Sign-In With Ethereum) and EIP-191 message formatting utilities.
 * Does not import any Node.js or server-only modules so it can be safely used in client components.
 */

export const SESSION_COOKIE_NAME = "bizflow_session";

/**
 * Constructs a standard EIP-191 Sign-In With Ethereum format message.
 */
export function buildSiweMessage({
  domain,
  address,
  uri,
  nonce,
  chainId,
  issuedAt = new Date().toISOString(),
  expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  statement = "Sign in to BizFlow Pilot V2 with your Web3 wallet to manage suppliers, invoices, and policy-governed settlements on Arc.",
}: {
  domain: string;
  address: string;
  uri: string;
  nonce: string;
  chainId: number;
  issuedAt?: string;
  expirationTime?: string;
  statement?: string;
}): string {
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    statement,
    "",
    `URI: ${uri}`,
    "Version: 1",
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
    let chainId = 0;
    let nonce = "";
    let issuedAt = "";
    let expirationTime = "";

    for (const line of lines) {
      if (line.startsWith("URI: ")) uri = line.substring(5).trim();
      else if (line.startsWith("Chain ID: ")) chainId = parseInt(line.substring(10).trim(), 10);
      else if (line.startsWith("Nonce: ")) nonce = line.substring(7).trim();
      else if (line.startsWith("Issued At: ")) issuedAt = line.substring(11).trim();
      else if (line.startsWith("Expiration Time: ")) expirationTime = line.substring(17).trim();
    }

    if (!domain || !address || !nonce || !chainId || !expirationTime) {
      return null;
    }

    return { domain, address, uri, chainId, nonce, issuedAt, expirationTime };
  } catch {
    return null;
  }
}
