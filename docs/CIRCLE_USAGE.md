# Circle Developer Stack & Wallets Integration Report

**BizFlow Pilot V2 — Tameion Agents Hackathon (Canteen x Circle x Arc)**  
**Architecture**: Single Next.js Deployment with Runtime Testnet / Mainnet Switching  
**Target Blockchain**: Arc Mainnet (Chain ID `5042`) & Arc Testnet (Chain ID `5042002`)  
**Status**: Real Verification & Honest Audit Report (October 2026)

---

## 1. Overview & Dual Settlement Architecture

BizFlow Pilot V2 implements a clear dual-track settlement architecture within a single unified application:

1. **Non-Custodial Browser Wallets (Primary Track — Small Business Beta)** `[IMPLEMENTED & VERIFIED]`:
   - Self-service small businesses transact directly via standard Web3 wallets (MetaMask, Rabby, Coinbase Wallet, etc.) using EIP-1193.
   - The BizFlow server prepares exact, policy-approved cryptographic payment intents; the user's browser wallet signs and broadcasts the ERC-20 transfer.
   - The server verifies on-chain receipts and logs via Arc RPC (`eth_getTransactionReceipt`).
   - The server **NEVER** holds, receives, stores, or requests user private keys or seed phrases.

2. **Circle Developer-Controlled Wallets (`@circle-fin/developer-controlled-wallets`)** `[IMPLEMENTED IN CODE / NOT RUN LIVE]`:
   - Integrated in `lib/payments/circleProvider.ts` for automated builder-operated pilot staging and testnet judge sandboxes.
   - Designed to manage institutional programmatic treasury wallets on Arc Testnet (`ARC-TESTNET`) via Circle's REST APIs.
   - Feature-gated via `PAYMENT_PROVIDER="circle"` and strictly prohibited on Arc Mainnet for public organizations.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Inbound Invoice Reconciled                      │
│                    (3-Way Match + Fraud/Injection Check)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Deterministic Policy Engine                         │
│                    (10 Corporate Safety Rules)                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│     Builder-Operated Admin Org    │ │    Public Small Businesses        │
│   (Automated Staging & Sandbox)   │ │     (Self-Service Beta)           │
└─────────────────┬─────────────────┘ └─────────────────┬─────────────────┘
                  │                                     │
                  │ PAYMENT_PROVIDER=circle             │ Non-Custodial Intent
                  ▼                                     ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│ Circle Developer-Controlled       │ │ User Web3 Wallet (Viem EIP-1193)  │
│ Wallets (@circle-fin SDK)         │ │ (Browser Signs ERC-20 Transfer)   │
│ [Code Implemented / NOT RUN Live] │ │ [VERIFIED]                        │
└─────────────────┬─────────────────┘ └─────────────────┬─────────────────┘
                  │                                     │
                  ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Arc Blockchain (Chain 5042 / 5042002)               │
│                  USDC Settlement + AuditAnchor.sol Proof               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Verification Matrix: What Was Run vs. Not Run

| Component / Flow | Implementation File | Verification Status | Evidence / Notes |
|---|---|---|---|
| **Non-Custodial Payment Intent** | `app/api/payments/intent/route.ts` | **PASS (VERIFIED)** | Verified by unit & Playwright suites. Validates balance, spending cap, and recipient checksum. |
| **Non-Custodial On-Chain Receipt Verification** | `app/api/payments/verify/route.ts` | **PASS (VERIFIED)** | Verified with mock and live Arc receipts. Parses native USDC Transfer events and updates hash-chained ledger. |
| **AuditAnchor.sol Contract Proofs** | `contracts/AuditAnchor.sol`, `lib/audit.ts` | **PASS (VERIFIED)** | Deployed to Arc Mainnet (`0x2b18fe9d3a63710da242092571744520ea8effe0`) and tested on testnet. |
| **Circle Faucet Direct Link** | `components/testnet/TestnetExtrasPanel.tsx` | **PASS (VERIFIED)** | Links directly to official faucet at `https://faucet.circle.com`. Tested in UI. |
| **Circle Developer Wallets SDK Import** | `package.json`, `lib/payments/circleProvider.ts` | **PASS (VERIFIED)** | `@circle-fin/developer-controlled-wallets@^1.1.2` compiles cleanly in Next.js bundle without bundling into client. |
| **Circle REST API Live Transfer Execution** | `lib/payments/circleProvider.ts` | **NOT RUN** | **NOT RUN LIVE**: Requires active Circle Developer Portal credentials (`CIRCLE_API_KEY` and registered `CIRCLE_ENTITY_SECRET`). Fallback deterministic simulation operates during local offline runs. |
| **Circle Developer Wallet Set Provisioning** | `scripts/seedCircleWallets.ts` | **NOT RUN** | **NOT RUN LIVE**: Script is written and ready for deployment with active Circle portal credentials, but was not executed live against Circle production servers. |
| **Judge Sandbox Mode (`PUBLIC_SANDBOX=true`)** | `lib/networks.ts`, `app/api/payments/intent/route.ts` | **PASS (VERIFIED)** | Permitted only on Arc Testnet; strictly halts with fatal exception if enabled on Arc Mainnet. |

---

## 3. Configuration & Runtime Environment

BizFlow Pilot V2 uses a single runtime deployment where the active network is chosen by the user in the app (`bizflow_network` cookie):

| Variable | Description | Value in Beta | Status |
|---|---|---|---|
| `DEFAULT_NETWORK` | Initial network fallback | `"mainnet"` | **Active** |
| `PAYMENT_PROVIDER` | Settlement provider switch (`"direct"` or `"circle"`) | `"direct"` (Default) | **Active** |
| `CIRCLE_API_KEY` | Circle Developer Portal API Key | Unset in local dev | **Not configured locally** |
| `CIRCLE_ENTITY_SECRET` | 32-byte hexadecimal registered entity secret | Unset in local dev | **Not configured locally** |
| `CIRCLE_WALLET_SET_ID` | Developer-Controlled Wallet Set ID | Demo/placeholder | **Not configured locally** |
| `CIRCLE_USDC_TOKEN_ID` | Token symbol / ID | `"USDC"` | **Configured** |
| `PUBLIC_SANDBOX` | Testnet visitor sandbox bypass | `"false"` | **Disabled on Mainnet** |

> [!CAUTION]
> **Mainnet Safety Invariant**: The application includes a hard boot guard (`assertValidSandboxMode()` in `lib/networks.ts`). If `PUBLIC_SANDBOX=true` is set while on Arc Mainnet, the server throws a fatal configuration error and terminates immediately.

---

## 4. Circle Developer-Controlled Wallets Integration Architecture

When configured with live Circle credentials, the workflow proceeds as follows:

### Step 1: SDK Initialization
```typescript
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const circle = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});
```

### Step 2: Idempotent Micro-Disbursement
```typescript
const res = await circle.createTransaction({
  walletId: process.env.CIRCLE_WALLET_SET_ID!,
  destinationAddress: vendorWallet,
  tokenId: "USDC",
  amount: ["0.05"], // Capped at micro-limits during testing
  fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  idempotencyKey: `PAY-INV-${invoiceId}-${Date.now()}`,
});
```

### Step 3: Audit Ledger & Anchor Integration
1. Circle transaction status is polled until confirmed.
2. The transaction hash is stored in the database ledger (`Payment` model).
3. The SHA-256 hash of the settlement block is appended to the tamper-evident audit ledger and anchored to `AuditAnchor.sol` on Arc.

---

## 5. Official Documentation Citations
- **Circle Agent Stack**: [https://developers.circle.com/agent-stack](https://developers.circle.com/agent-stack)
- **Circle Developer-Controlled Wallets**: [https://developers.circle.com/developer-controlled-wallets](https://developers.circle.com/developer-controlled-wallets)
- **Official Circle Faucet**: [https://faucet.circle.com](https://faucet.circle.com)
- **Arc Network Official Documentation**: [https://docs.arc.network](https://docs.arc.network)
