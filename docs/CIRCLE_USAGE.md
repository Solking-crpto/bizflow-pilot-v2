# Circle Agent Stack & Developer-Controlled Wallets Integration Guide

**BizFlow Pilot V2 — Tameion Agents Hackathon (Canteen x Circle x Arc)**  
**Target Blockchain**: Arc Mainnet (Chain ID `5042`) & Arc Testnet (Chain ID `5042002`)

---

## 1. Overview & Dual Settlement Architecture

BizFlow Pilot V2 supports a flexible settlement architecture tailored to both builder-operated pilot staging and independent non-custodial business operations:

1. **Circle Developer-Controlled Wallets (`@circle-fin/developer-controlled-wallets`)**:
   - Deployed for the builder-operated administrative organization and testnet judge sandbox (`ARC-TESTNET`).
   - Enables institutional API-driven programmatic USDC transfers with entity secret cryptographic signing and client-side UUID idempotency.
   - Powers the autonomous agent cron loop for automated sub-dollar disbursements inside strict policy limits.

2. **Native USDC Non-Custodial Transfer on Arc**:
   - Deployed for self-service public small businesses.
   - Businesses connect their existing Web3 wallets via EIP-1193 in the browser; the BizFlow server never touches their keys.
   - Payments are executed directly via the Arc native USDC contract (`0x3600000000000000000000000000000000000000`).

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
└─────────────────┬─────────────────┘ └─────────────────┬─────────────────┘
                  │                                     │
                  ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Arc Blockchain (Chain 5042 / 5042002)               │
│                  USDC Settlement + AuditAnchor.sol Proof               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Comparison: Circle Developer Wallets vs. Non-Custodial Wallets

| Feature / Dimension | Circle Developer-Controlled Wallets | Non-Custodial Browser Wallets |
|---|---|---|
| **Primary Audience** | Builder admin org, automated cron, testnet sandbox | Self-service public small businesses (beta) |
| **Private Key Custody** | Held in Circle's secure MPC HSM infrastructure | Held exclusively by the user in their Web3 wallet |
| **Server Interaction** | Server calls Circle REST API with entity secret | Server sends payment intent; user signs in browser |
| **Idempotency** | Circle client-side UUID `idempotencyKey` | BizFlow intent UUID + Arc RPC tx receipt verification |
| **Mainnet Safety** | Guarded by owner passcode & `ADMIN_WALLET_ADDRESS` | Guarded by $25 beta cap, policy engine & user wallet |
| **Asset** | USDC on `ARC-TESTNET` | Native USDC on Arc Mainnet (`0x3600...0000`) |

---

## 3. Environment Configuration for Circle Integration

The Circle integration is configured via standard environment variables:

| Variable | Description | Example / Default |
|---|---|---|
| `PAYMENT_PROVIDER` | Settlement provider switch (`"circle"` or `"direct"`) | `direct` (Mainnet default) |
| `NEXT_PUBLIC_NETWORK_MODE` | Blockchain target | `testnet` or `mainnet` |
| `PUBLIC_SANDBOX` | Judge sandbox bypass (`testnet` ONLY) | `false` (**FORBIDDEN ON MAINNET**) |
| `CIRCLE_API_KEY` | Circle Developer Portal API Key | `TEST_API_KEY:...` |
| `CIRCLE_ENTITY_SECRET` | 32-byte hexadecimal registered entity secret | `0x0123456789abcdef...` |
| `CIRCLE_WALLET_SET_ID` | Developer-Controlled Wallet Set ID | `b7999818-7f99-4458-8b5e-4efbb8e7f174` |
| `CIRCLE_USDC_TOKEN_ID` | Token symbol / ID | `USDC` |

> [!CAUTION]
> **Mainnet Safety Guard**: `assertValidSandboxMode()` in `lib/networks.ts` actively validates at server boot that `PUBLIC_SANDBOX=true` is never enabled on Arc Mainnet. If misconfigured, the application throws a fatal initialization error and halts immediately.

---

## 4. Circle Developer-Controlled Wallets SDK Workflow

### Step 1: Client Initialization
```typescript
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const circle = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});
```

### Step 2: Provisioning Wallet Set & Arc Testnet Wallet
```typescript
// 1. Create Developer-Controlled Wallet Set
const walletSet = await circle.createWalletSet({
  name: "BizFlow Pilot V2 Treasury",
});

// 2. Provision Arc Testnet Wallet
const wallet = await circle.createWallets({
  walletSetId: walletSet.data.walletSet.id,
  blockchains: ["ARC-TESTNET"],
  count: 1,
});

const treasuryWalletAddress = wallet.data.wallets[0].address;
```

### Step 3: Testnet Faucet Funding
Fund the provisioned wallet using Circle's official faucet:
- **Faucet URL**: `https://faucet.circle.com`
- **Network**: Arc Testnet (`ARC-TESTNET`)
- **Token**: USDC

### Step 4: Autonomous Disbursement Execution
When an invoice is approved by the deterministic policy engine:
```typescript
const res = await circle.createTransaction({
  walletId: wallet.data.wallets[0].id,
  destinationAddress: vendorWallet,
  tokenId: "USDC",
  amount: ["0.30"], // 0.30 USDC
  fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  idempotencyKey: `PAY-INV-V2-${invoiceId}-${Date.now()}`,
});

const circleTxId = res.data.id;
```

### Step 5: Verification & On-Chain Audit Anchoring
1. Poll Circle transaction status until confirmed.
2. Record settlement in PostgreSQL ledger (`prisma.payment`).
3. Commit SHA-256 hash to `AuditAnchor.sol` on Arc for public verification:
```typescript
await recordAuditEvent({
  orgId: "org-buildpro-v2",
  eventType: "payment_settled",
  actor: "agent",
  eventData: {
    provider: "circle",
    circleTxId,
    vendor: vendorName,
    amount: "0.30 USDC",
  },
});
```

---

## 5. Judge Sandbox Mode Guarantees

When running with `PUBLIC_SANDBOX=true` on testnet:
1. **Passcode Exemption**: Evaluators can trigger "Execute Settlement" or "Run Agent Now" without entering the administrative passcode.
2. **Micro-Cap Ceiling**: Sandbox disbursements are capped at **0.05 USDC** per settlement.
3. **Sliding-Window Rate Limiting**: Enforces a strict quota of **5 executions per minute per client IP**.
4. **Visual Disclosure**: Persistent amber banner across all views: `Sandbox: test USDC only (Circle Wallets, ARC-TESTNET)`.
5. **Zero Synthetic Fallbacks**: Transactions execute against real Circle APIs and Arc testnet RPCs.

---

## 6. Official References & Documentation
- **Circle Agent Stack & Wallets**: [https://developers.circle.com/agent-stack](https://developers.circle.com/agent-stack)
- **Circle Developer Controlled Wallets API**: [https://developers.circle.com/developer-controlled-wallets](https://developers.circle.com/developer-controlled-wallets)
- **Arc Network Official Documentation**: [https://docs.arc.network](https://docs.arc.network)
- **Arc App Kit Send SDK**: [https://docs.arc.network/app-kit/send.md](https://docs.arc.network/app-kit/send.md)
