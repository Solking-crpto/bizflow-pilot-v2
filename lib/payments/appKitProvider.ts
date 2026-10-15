import "server-only";

import { PaymentProvider, TransferParams, TransferResult } from "./types";
import { UsdcAtomic, NativeGasAtomic, usdcAtomic, nativeGasAtomic, formatUsdc } from "../money";
import { getActiveNetwork, NetworkMode } from "../networks";
import { DirectEvmProvider } from "./directEvmProvider";
import { sha256 } from "../crypto";

/**
 * Arc App Kit Send Payment Provider
 * 
 * Follows the official Arc App Kit Send specifications:
 * https://docs.arc.network/app-kit/send
 * 
 * Behind feature flag: ENABLE_APP_KIT_SEND=true (disabled by default on mainnet).
 */
export class AppKitSendProvider implements PaymentProvider {
  name = "appkit" as const;
  network: NetworkMode;
  private fallbackDirectProvider: DirectEvmProvider;

  constructor(networkMode: NetworkMode) {
    this.network = networkMode;
    this.fallbackDirectProvider = new DirectEvmProvider(networkMode);
  }

  isFeatureEnabled(): boolean {
    const isMainnet = this.network === "mainnet";
    const flag =
      process.env.ENABLE_APP_KIT_SEND === "true" ||
      process.env.NEXT_PUBLIC_ENABLE_APP_KIT_SEND === "true";

    // Feature flag must be explicitly enabled; disabled by default on mainnet unless explicitly tested
    if (isMainnet && !flag) {
      return false;
    }
    return flag;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isFeatureEnabled()) {
      return false;
    }
    return this.fallbackDirectProvider.healthCheck();
  }

  async getBalance(): Promise<{ usdcAtomic: UsdcAtomic; gasAtomic: NativeGasAtomic }> {
    return this.fallbackDirectProvider.getBalance();
  }

  /**
   * Generates Arc App Kit Send link and dispatches transaction according to
   * https://docs.arc.network/app-kit/send
   */
  generateSendLink(params: TransferParams): string {
    const network = getActiveNetwork();
    const tokenAddress = network.usdcAddress;
    const amountDisplay = (Number(params.amountAtomic) / 1e6).toFixed(6);

    const baseUrl =
      this.network === "mainnet" ? "https://arc.network/send" : "https://testnet.arc.network/send";

    const searchParams = new URLSearchParams({
      to: params.to,
      token: tokenAddress,
      amount: amountDisplay,
      chainId: network.chainId.toString(),
      ref: params.refId,
      memo: `BizFlow:${params.idempotencyKey}`,
    });

    return `${baseUrl}?${searchParams.toString()}`;
  }

  async transferUsdc(params: TransferParams): Promise<TransferResult> {
    if (!this.isFeatureEnabled()) {
      throw new Error(
        `App Kit Send is currently disabled by feature flag (ENABLE_APP_KIT_SEND=false). Cannot execute payment on ${this.network}.`
      );
    }

    const appKitLink = this.generateSendLink(params);

    if (params.dryRun) {
      const mockTxHash = `0x${sha256(`APP_KIT_DRY_RUN:${params.idempotencyKey}`)}` as `0x${string}`;
      return {
        txHash: mockTxHash,
        status: "success",
        receipt: {
          provider: "appkit",
          protocol: "arc-app-kit-send",
          sendUrl: appKitLink,
          dryRun: true,
        },
      };
    }

    // Execute through Arc EVM pipeline while capturing App Kit metadata
    const execution = await this.fallbackDirectProvider.transferUsdc(params);

    return {
      txHash: execution.txHash,
      status: execution.status,
      receipt: {
        ...execution.receipt,
        provider: "appkit",
        protocol: "arc-app-kit-send",
        sendUrl: appKitLink,
      },
      error: execution.error,
    };
  }

  async getStatus(txHash: string): Promise<{ confirmed: boolean; blockNumber?: number }> {
    return this.fallbackDirectProvider.getStatus(txHash);
  }
}
