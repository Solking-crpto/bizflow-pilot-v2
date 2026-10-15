import { UsdcAtomic, NativeGasAtomic } from "../money";

export interface TransferParams {
  to: `0x${string}`;
  amountAtomic: UsdcAtomic;
  idempotencyKey: string;
  refId: string;
  dryRun?: boolean;
}

export interface TransferResult {
  txHash: string;
  status: "success" | "pending" | "failed";
  receipt?: any;
  error?: string;
}

export interface PaymentProvider {
  name: "circle" | "direct" | "appkit";
  network: "testnet" | "mainnet";
  getBalance(): Promise<{ usdcAtomic: UsdcAtomic; gasAtomic: NativeGasAtomic }>;
  transferUsdc(params: TransferParams): Promise<TransferResult>;
  getStatus(txHash: string): Promise<{ confirmed: boolean; blockNumber?: number }>;
  healthCheck(): Promise<boolean>;
}
