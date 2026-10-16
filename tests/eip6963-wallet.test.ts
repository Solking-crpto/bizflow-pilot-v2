import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sortWalletsMetaMaskFirst,
  isMetaMask,
  mapWalletError,
  EIP6963ProviderDetail,
  subscribeToEip6963,
  resetDiscoveredProviders,
} from "@/lib/auth/eip6963";

describe("EIP-6963 Multi-Wallet Discovery & Error Handling", () => {
  beforeEach(() => {
    resetDiscoveredProviders();
    vi.restoreAllMocks();
  });

  const mockMetaMask: EIP6963ProviderDetail = {
    info: {
      uuid: "metamask-uuid-1234",
      name: "MetaMask",
      icon: "data:image/svg+xml;base64,mockMetaMaskIcon",
      rdns: "io.metamask",
    },
    provider: {
      isMetaMask: true,
      request: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    },
  };

  const mockRabby: EIP6963ProviderDetail = {
    info: {
      uuid: "rabby-uuid-5678",
      name: "Rabby Wallet",
      icon: "data:image/svg+xml;base64,mockRabbyIcon",
      rdns: "io.rabby",
    },
    provider: {
      isRabby: true,
      request: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    },
  };

  const mockCoinbase: EIP6963ProviderDetail = {
    info: {
      uuid: "coinbase-uuid-9999",
      name: "Coinbase Wallet",
      icon: "data:image/svg+xml;base64,mockCoinbaseIcon",
      rdns: "com.coinbase.wallet",
    },
    provider: {
      isCoinbaseWallet: true,
      request: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    },
  };

  it("identifies MetaMask providers accurately", () => {
    expect(isMetaMask(mockMetaMask)).toBe(true);
    expect(isMetaMask(mockRabby)).toBe(false);
    expect(isMetaMask(mockCoinbase)).toBe(false);
  });

  it("sorts wallets with MetaMask strictly prioritized to the top", () => {
    const unsorted = [mockRabby, mockCoinbase, mockMetaMask];
    const sorted = sortWalletsMetaMaskFirst(unsorted);

    expect(sorted[0].info.rdns).toBe("io.metamask");
    expect(sorted[0].info.name).toBe("MetaMask");
    expect(sorted[1].info.name).toBe("Coinbase Wallet");
    expect(sorted[2].info.name).toBe("Rabby Wallet");
  });

  it("maps error code 4001 to user declined message", () => {
    const err4001 = { code: 4001, message: "User rejected the request." };
    expect(mapWalletError(err4001)).toBe(
      "You closed or declined the request in your wallet. Try again."
    );

    const errStr = new Error("Connection request rejected by user");
    expect(mapWalletError(errStr)).toBe(
      "You closed or declined the request in your wallet. Try again."
    );
  });

  it("maps error code -32002 to pending request message", () => {
    const err32002 = {
      code: -32002,
      message: "Request of type 'eth_requestAccounts' already pending for origin.",
    };
    expect(mapWalletError(err32002)).toBe(
      "A request is already open. Open your wallet extension and approve it."
    );

    const errCause = {
      cause: { code: -32002 },
      message: "Resource unavailable",
    };
    expect(mapWalletError(errCause)).toBe(
      "A request is already open. Open your wallet extension and approve it."
    );
  });

  it("maps missing wallet to Install MetaMask message", () => {
    const errNoWallet = new Error("No Web3 wallet detected");
    expect(mapWalletError(errNoWallet)).toBe("Install MetaMask");
  });

  it("simulates two mock providers: one rejecting (4001) and one pending (-32002)", async () => {
    // Wallet 1: User explicitly declines (4001)
    const rejectingWallet: EIP6963ProviderDetail = {
      info: {
        uuid: "wallet-rejecting",
        name: "Rejecting Wallet",
        icon: "",
        rdns: "app.rejecting",
      },
      provider: {
        request: vi.fn(async ({ method }) => {
          if (method === "eth_requestAccounts") {
            const err: any = new Error("User rejected");
            err.code = 4001;
            throw err;
          }
          return [];
        }),
      },
    };

    // Wallet 2: Request is queued/already pending (-32002)
    const pendingWallet: EIP6963ProviderDetail = {
      info: {
        uuid: "wallet-pending",
        name: "Pending Wallet",
        icon: "",
        rdns: "app.pending",
      },
      provider: {
        request: vi.fn(async ({ method }) => {
          if (method === "eth_requestAccounts") {
            const err: any = new Error("Already pending");
            err.code = -32002;
            throw err;
          }
          return [];
        }),
      },
    };

    // Test rejecting wallet directly inside synchronous click handler
    let error1: string | null = null;
    try {
      // Synchronous call in click event
      await rejectingWallet.provider.request({ method: "eth_requestAccounts" });
    } catch (err: any) {
      error1 = mapWalletError(err);
    }

    expect(error1).toBe("You closed or declined the request in your wallet. Try again.");

    // Test pending wallet directly inside synchronous click handler
    let error2: string | null = null;
    try {
      // Synchronous call in click event
      await pendingWallet.provider.request({ method: "eth_requestAccounts" });
    } catch (err: any) {
      error2 = mapWalletError(err);
    }

    expect(error2).toBe("A request is already open. Open your wallet extension and approve it.");
  });

  it("dispatches eip6963:requestProvider and receives eip6963:announceProvider", () => {
    const listenersMap = new Map<string, Function[]>();
    const originalWindow = (globalThis as any).window;

    (globalThis as any).window = {
      addEventListener: (type: string, listener: Function) => {
        const list = listenersMap.get(type) || [];
        list.push(listener);
        listenersMap.set(type, list);
      },
      removeEventListener: (type: string, listener: Function) => {
        const list = listenersMap.get(type) || [];
        listenersMap.set(
          type,
          list.filter((l) => l !== listener)
        );
      },
      dispatchEvent: (event: any) => {
        const list = listenersMap.get(event.type) || [];
        list.forEach((fn) => fn(event));
        return true;
      },
    };

    let capturedWallets: EIP6963ProviderDetail[] = [];

    const unsubscribe = subscribeToEip6963((wallets) => {
      capturedWallets = wallets;
    });

    // Simulate extension announcing provider
    const event = {
      type: "eip6963:announceProvider",
      detail: mockMetaMask,
    };
    (globalThis as any).window.dispatchEvent(event);

    expect(capturedWallets.some((w) => w.info.rdns === "io.metamask")).toBe(true);

    unsubscribe();
    (globalThis as any).window = originalWindow;
  });
});
