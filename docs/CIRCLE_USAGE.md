# Circle Agent Stack & Developer-Controlled Wallets Integration Guide

**BizFlow Pilot V2 — Tameion Agents Hackathon (Canteen x Circle x Arc)**

---

## 1. Overview & Architecture

BizFlow Pilot V2 integrates **Circle Developer-Controlled Wallets** as a first-class settlement engine alongside direct EVM key settlement. When configured with `PAYMENT_PROVIDER=circle`, the autonomous payment pipeline delegates USDC disbursements to Circle's institutional-grade API infrastructure while retaining deterministic policy enforcement and cryptographic audit anchoring on Arc.

```
┌────────────────────────────────┐
│  Inbound Invoice Reconciled    │
│  (3-Way Match + Fraud Defense) │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│   Autonomous Policy Engine     │
│   (10 Corporate Safety Rules)  │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│      Payment Provider Router   │
│       (lib/payments/index.ts)  │
└───────┬────────────────┬───────┘
        │                │
        │ direct         │ circle
        ▼                ▼
┌──────────────┐  ┌──────────────────────────────────────┐
│ Direct EVM   │  │ Circle Developer-Controlled Wallets │
│ Arc Viem Tx  │  │ (@circle-fin/developer-controlled)  │
└──────────────┘  └──────────────────┬───────────────────┘
                                     │
                                     ▼
                  ┌──────────────────────────────────────┐
                  │ Arc Testnet (5042002) / ARC-TESTNET  │
                  │ USDC Transfer + Hash Audit Anchor    │
                  └──────────────────────────────────────┘
```

---

## 2. Environment Configuration

To enable Circle Wallets for Judge Sandbox or testnet staging, the following environment variables are utilized:

| Variable | Description | Example / Default |
|---|---|---|
| `PAYMENT_PROVIDER` | Selects active provider | `circle` (or `direct`) |
| `NEXT_PUBLIC_NETWORK_MODE` | Blockchain target | `testnet` (Circle Sandbox) |
| `PUBLIC_SANDBOX` | Allows judges to test without passcode | `true` (**STRICTLY FORBIDDEN ON MAINNET**) |
| `CIRCLE_API_KEY` | Circle Developer Portal API Key | `TEST_API_KEY:...` |
| `CIRCLE_ENTITY_SECRET` | 32-byte hex registered entity secret | `0x...` |
| `CIRCLE_WALLET_SET_ID` | Developer-Controlled Wallet Set ID | `ws_demo_buildpro_01` |
| `CIRCLE_USDC_TOKEN_ID` | Testnet USDC token ID or symbol | `USDC` |

> [!CAUTION]
> **Mainnet Safety Invariant:** `PUBLIC_SANDBOX=true` is hard-blocked at startup by `assertValidSandboxMode()` in `lib/networks.ts`. If `PUBLIC_SANDBOX=true` is detected while running on Arc Mainnet, the application immediately throws a fatal exception and refuses to boot.

---

## 3. Step-by-Step Testnet Payment Flow

### Step 1: Wallet Set Creation & Initialization
Using `@circle-fin/developer-controlled-wallets`:
```typescript
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const circle = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

// 1. Create Developer-Controlled Wallet Set
const walletSet = await circle.createWalletSet({
  name: "BizFlow Pilot V2 Treasury",
});
```

### Step 2: Provisioning Arc Testnet Wallet
Create a wallet within the set targeting the Arc Testnet EVM environment:
```typescript
const wallet = await circle.createWallets({
  walletSetId: walletSet.data.walletSet.id,
  blockchains: ["ARC-TESTNET"],
  count: 1,
});

const treasuryWalletAddress = wallet.data.wallets[0].address;
```

### Step 3: Faucet Funding
Fund the provisioned wallet with testnet USDC from the official Circle Faucet:
- **Faucet URL:** `https://faucet.circle.com`
- **Network:** Arc Testnet (or Arc compatible testnet EVM)
- **Token:** USDC

### Step 4: Autonomous Transfer Execution
When BizFlow's autonomous loop or human operator triggers settlement, `CircleWalletsProvider.transferUsdc` constructs the idempotent transaction:
```typescript
const res = await circle.createTransaction({
  walletId: wallet.data.wallets[0].id,
  destinationAddress: vendorWallet,
  tokenId: "USDC",
  amount: ["0.30"], // 0.30 USDC
  fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  idempotencyKey: `PAY-INV-V2-DEMO-01-testnet`,
});

const circleTxId = res.data.id;
```

### Step 5: Dual Verification & Audit Anchoring
1. Circle confirms the transaction through its developer console / status API (`getStatus`).
2. BizFlow records the settlement in the PostgreSQL cryptographic ledger (`prisma.payment`).
3. BizFlow hashes the settlement record and anchors it to the immutable Arc Audit Anchor contract:
```typescript
await recordAuditEvent({
  orgId: "org-buildpro-v2",
  eventType: "payment_settled",
  actor: "agent",
  eventData: {
    provider: "circle",
    circleTxId,
    vendor: "Northgate Cement Supply [DEMO VENDOR]",
    amount: "0.30 USDC",
  },
});
```

---

## 4. Judge Sandbox Mode Guarantees

When running with `PUBLIC_SANDBOX=true` on testnet:
1. **Passcode Exemption:** Judges and evaluators can click "Execute Settlement" or "Run Agent Now" without entering the owner passcode.
2. **Tiny Cap Guard:** Sandbox transactions are hard-limited to a maximum of **0.05 USDC** per settlement.
3. **Sliding-Window Rate Limiting:** Restricted to **5 executions per minute per client IP** to prevent abuse.
4. **Visual Indicator:** Persistent amber banner across all pages: `Sandbox: test USDC only (Circle Wallets, ARC-TESTNET)`.
5. **No Synthetic Fallback:** Settlements reflect real cryptographic simulation or live Circle testnet calls—never fake mock balances.

---

## 5. Official References & Documentation
- Circle Agent Stack & Wallets: `https://developers.circle.com/agent-stack`
- Circle Developer Controlled Wallets API: `https://developers.circle.com/developer-controlled-wallets`
- Arc Network & EVM Specs: `https://docs.arc.network`
- Arc App Kit: `https://docs.arc.network/app-kit`
