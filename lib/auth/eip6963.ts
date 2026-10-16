/**
 * BizFlow Pilot V2 — EIP-6963 Multi-Wallet Provider Discovery
 *
 * Implements standard EIP-6963 discovery protocol for Web3 wallets:
 * - Listens for "eip6963:announceProvider" events
 * - Dispatches "eip6963:requestProvider" window event
 * - Sorts MetaMask to the top of the provider list
 * - Persists selected wallet provider (by RDNS / UUID) in localStorage
 * - Maps standard EIP-1193 / JSON-RPC error codes (4001, -32002)
 *
 * Reference: https://eips.ethereum.org/EIPS/eip-6963
 */

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: any; // EIP-1193 provider
}

export interface EIP6963AnnounceProviderEvent extends CustomEvent {
  type: "eip6963:announceProvider";
  detail: EIP6963ProviderDetail;
}

export const STORAGE_WALLET_KEY = "bizflow_selected_wallet_rdns";

/**
 * Checks whether a discovered wallet provider is MetaMask.
 */
export function isMetaMask(wallet: EIP6963ProviderDetail): boolean {
  if (!wallet || !wallet.info) return false;
  const rdns = (wallet.info.rdns || "").toLowerCase();
  const name = (wallet.info.name || "").toLowerCase();
  return (
    rdns === "io.metamask" ||
    rdns.includes("metamask") ||
    name.includes("metamask") ||
    Boolean(wallet.provider?.isMetaMask)
  );
}

/**
 * Sorts discovered wallets prioritizing MetaMask first, followed by alphabetical order.
 */
export function sortWalletsMetaMaskFirst(
  wallets: EIP6963ProviderDetail[]
): EIP6963ProviderDetail[] {
  return [...wallets].sort((a, b) => {
    const aIsMm = isMetaMask(a);
    const bIsMm = isMetaMask(b);
    if (aIsMm && !bIsMm) return -1;
    if (!aIsMm && bIsMm) return 1;
    return a.info.name.localeCompare(b.info.name);
  });
}

/**
 * Standard error mapping for wallet connection issues.
 */
export function mapWalletError(err: any): string {
  if (!err) return "An unexpected wallet error occurred.";
  const code = err.code ?? err?.cause?.code;
  const msg = String(err.message || err.details || "").toLowerCase();

  // 4001: User rejected request
  if (code === 4001 || msg.includes("user rejected") || msg.includes("declined") || msg.includes("rejected by user")) {
    return "You closed or declined the request in your wallet. Try again.";
  }

  // -32002: Request already pending
  if (
    code === -32002 ||
    msg.includes("-32002") ||
    msg.includes("already pending") ||
    msg.includes("request is already open") ||
    msg.includes("resource unavailable")
  ) {
    return "A request is already open. Open your wallet extension and approve it.";
  }

  // No wallet detected
  if (msg.includes("no web3 wallet") || msg.includes("install metamask") || msg.includes("no wallet")) {
    return "Install MetaMask";
  }

  return err.message || "Failed to connect wallet.";
}

/**
 * Retrieves the saved wallet RDNS from localStorage.
 */
export function getSavedWalletRdns(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_WALLET_KEY);
  } catch {
    return null;
  }
}

/**
 * Saves the chosen wallet RDNS into localStorage.
 */
export function setSavedWalletRdns(rdns: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_WALLET_KEY, rdns);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clears the saved wallet selection from localStorage.
 */
export function clearSavedWalletRdns(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_WALLET_KEY);
  } catch {
    // Ignore storage errors
  }
}

// In-memory registry of discovered providers across window lifetime
let discoveredProviders: EIP6963ProviderDetail[] = [];
let listeners: Array<(providers: EIP6963ProviderDetail[]) => void> = [];
let isListening = false;

function notifyListeners() {
  const sorted = sortWalletsMetaMaskFirst(discoveredProviders);
  listeners.forEach((fn) => fn(sorted));
}

/**
 * Subscribes to EIP-6963 provider announcements.
 * Automatically dispatches "eip6963:requestProvider" upon initialization.
 */
export function subscribeToEip6963(
  callback: (wallets: EIP6963ProviderDetail[]) => void
): () => void {
  listeners.push(callback);

  if (typeof window !== "undefined") {
    if (!isListening) {
      const handleAnnounce = (event: Event) => {
        const customEvent = event as EIP6963AnnounceProviderEvent;
        const detail = customEvent.detail;
        if (!detail || !detail.info || !detail.provider) return;

        const exists = discoveredProviders.some(
          (p) =>
            p.info.uuid === detail.info.uuid ||
            (p.info.rdns && detail.info.rdns && p.info.rdns === detail.info.rdns)
        );

        if (!exists) {
          discoveredProviders.push({
            info: detail.info,
            provider: detail.provider,
          });
          notifyListeners();
        }
      };

      window.addEventListener("eip6963:announceProvider", handleAnnounce as EventListener);
      isListening = true;

      // Dispatch discovery request
      try {
        window.dispatchEvent(new Event("eip6963:requestProvider"));
      } catch {
        // Fallback for older environments
      }
    }

    // Immediately trigger callback with currently discovered providers
    callback(sortWalletsMetaMaskFirst(discoveredProviders));

    // Also re-dispatch requestProvider to catch any late announcements
    try {
      window.dispatchEvent(new Event("eip6963:requestProvider"));
    } catch {
      // Ignored
    }
  }

  return () => {
    listeners = listeners.filter((fn) => fn !== callback);
  };
}

/**
 * Returns the currently discovered providers list synchronously.
 */
export function getDiscoveredProviders(): EIP6963ProviderDetail[] {
  return sortWalletsMetaMaskFirst(discoveredProviders);
}

/**
 * Resets discovered providers (primarily for unit testing).
 */
export function resetDiscoveredProviders(): void {
  discoveredProviders = [];
  notifyListeners();
}
