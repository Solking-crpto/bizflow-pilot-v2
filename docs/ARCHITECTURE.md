# BizFlow Pilot V2 — System Architecture Specification

**Edition**: Tameion Agents Hackathon (Canteen x Circle x Arc) — October 2026  
**Status**: Non-Custodial Public Beta on Arc Mainnet (Chain ID `5042`)

---

## 1. Architectural Philosophy

BizFlow Pilot V2 transforms enterprise procurement into policy-governed USDC settlements on Arc. Its architecture is built on three core pillars:

1. **Air-Gapped Non-Custodial Invariant**: Small businesses own and control their funds. The server never holds, receives, or signs transactions for public users. All transfers are signed in the user's browser using their Web3 wallet.
2. **AI Proposes, Deterministic Code Decides**: The AI agent acts strictly in an advisory capacity. It analyzes invoices, computes cash obligations, and proposes optimal payment timing. A deterministic 10-point policy engine holds final approval authority.
3. **Cryptographic Proof Chain & On-Chain Audit Anchoring**: Every invoice verification, policy evaluation, payment receipt, and ledger hash is bound into a SHA-256 chain and committed to `AuditAnchor.sol` on Arc for public, zero-login verification.

---

## 2. High-Level Architecture Diagram

```mermaid
flowchart TB
    subgraph Client["User Browser (Non-Custodial)"]
        UI["Next.js 14 App Router UI"]
        WALLET["Web3 Wallet\n(MetaMask / Rabby / Viem EIP-1193)"]
        SIWE["SIWE Signer\n(EIP-191)"]
    end

    subgraph Server["BizFlow Advisory & Policy Server"]
        AUTH["Auth Controller\n(Nonce + HMAC-SHA256 Sessions)"]
        INTAKE["Procurement Intake\n(PO, GR, Invoices + Anti-Injection)"]
        AI["AI Finance Agent\n(Advisory Proposal: Pay/Schedule/Hold)"]
        POLICY{"10-Rule Deterministic\nPolicy Engine"}
        INTENT["Payment Intent Service\n(UUID, Expiry, Idempotency)"]
        VERIFY["Receipt Verifier\n(Arc RPC eth_getTransactionReceipt)"]
        LEDGER["SHA-256 Audit Ledger\n(Append-Only Cryptographic Chain)"]
    end

    subgraph ArcBlockchain["Arc Network (Chain 5042 Mainnet / 5042002 Testnet)"]
        RPC["Arc RPC Gateway\n(https://rpc.mainnet.arc.io)"]
        USDC["Native USDC Contract\n(0x3600000000000000000000000000000000000000)"]
        ANCHOR["AuditAnchor.sol\n(Parisian EVM Smart Contract)"]
    end

    %% Auth Flow
    WALLET -.->|EIP-191 Signature| SIWE
    SIWE -->|POST /api/auth/verify| AUTH
    AUTH -->|Secure httpOnly Cookie| UI

    %% Procurement & Advisory
    UI -->|Create PO/GR/Invoice| INTAKE
    INTAKE -->|3-Way Reconciliation| POLICY
    INTAKE -->|Anonymized Context| AI
    AI -->|Advisory Recommendation| UI
    
    %% Payment Flow
    UI -->|POST /api/payments/intent| INTENT
    POLICY -->|Approve Intent| INTENT
    INTENT -->|Payment Intent Specs| UI
    UI -->|Sign USDC Transfer| WALLET
    WALLET -->|Broadcast raw tx| RPC
    RPC -->|Execute Transfer| USDC

    %% Verification & Anchoring
    RPC -->|Receipt & Transfer Event| VERIFY
    UI -->|POST /api/payments/verify-receipt| VERIFY
    VERIFY -->|Log Verified Settlement| LEDGER
    WALLET -->|Sign commitAnchor()| ANCHOR
    ANCHOR -->|Emit AnchorCommitted| RPC
    LEDGER -->|Public Proof Verification| PASSPORT["Public Payment Passport\n(/verify/[id])"]
```

---

## 3. Subsystem Breakdown

### 3.1 Authentication & Multi-Tenant Isolation
- **EIP-191 Sign-In With Ethereum (SIWE)**: Wallets authenticate by requesting a cryptographically random nonce (`GET /api/auth/nonce`) and signing an authentication challenge.
- **HMAC-SHA256 Session Tokens**: Verified signatures issue an `httpOnly`, `Secure`, `SameSite=Lax` session cookie containing `{ address, orgId, role, expiresAt }` signed with server `SESSION_SECRET`.
- **Tenant Scoping**: All Prisma queries, mutations, and API routes are scoped to `session.orgId`. IDOR security tests prove that orgs cannot access or modify each other's suppliers, invoices, decisions, or payments.

### 3.2 Procurement & Intake Engine
- **Suppliers**: Validated payout addresses with checksumming, blocked-address screening (known test-wallet blocklist; not an official regulatory sanctions screen), and a mandatory 24-hour settlement cooldown on payout wallet updates.
- **Purchase Orders & Goods Receipts**: Line-item tracking storing atomic integer values (`BigInt`) to eliminate floating-point rounding errors.
- **Invoice Processing**: Text/PDF ingestion with prompt injection quarantine defenses, computing deterministic SHA-256 content hashes to detect zero-day duplicates.

### 3.3 AI Finance Advisory Agent
- **Air-Gapped Role**: The AI agent (`POST /api/agent/analyze`) evaluates open invoices, queries live Arc wallet balances via `readContract`, and calculates timing optimizations (such as early-payment discounts like 2/10 net 30).
- **Zero-Key Sandbox**: The agent is strictly isolated from private keys and settlement execution. It outputs structured JSON conforming to a strict Zod schema:
  - Recommendation: `pay_now` | `schedule` | `hold` | `request_review`
  - Rationale & Discount Capture Analysis
  - Source tracking (`model: "claude-3-5-sonnet"` or `fallback: "deterministic-timing-engine"`)
- **Safety Quotas**: Limited to 20 calls/day per organization and 100 calls/day globally (`LLM_DAILY_CALL_LIMIT`).

### 3.4 Deterministic Policy Engine (10-Point Gatekeeper)
Every payment intent must pass 10 server-side rules before issuance:
1. **Active Whitelisted Vendor**: Supplier must be registered with active status in the organization.
2. **Wallet Authenticity**: Destination wallet must match supplier's registered address with no active cooldowns.
3. **Price Tolerance**: Invoiced unit price matches PO within configured tolerance (default 1.00%).
4. **Quantity Reconciliation**: Invoiced quantity $\le$ received goods receipt quantity.
5. **Zero-Day Duplicate Hash**: Invoice SHA-256 hash has not been previously settled.
6. **Prompt-Injection Defense**: Invoice payload free of quarantined injection strings.
7. **Single Transaction Cap**: Amount $\le$ Organization payment limit and Beta safety ceiling ($25.00 USDC).
8. **Daily Volume Limit**: 24-hour cumulative spending within organizational threshold.
9. **Treasury Reserve Floor**: User wallet balance minus payment preserves the configured reserve floor.
10. **Emergency Kill-Switch**: Master kill-switch is disarmed.

### 3.5 Non-Custodial Payment Protocol
1. **Intent Issuance**: `POST /api/payments/intent` verifies policy, locks invoice status, and creates an intent with a 15-minute TTL.
2. **Browser Signing**: Viem client in `components/payments/NonCustodialPaymentModal.tsx` prompts the connected wallet to execute an ERC-20 `transfer(to, amount)` on Arc (`0x3600...0000`).
3. **On-Chain Receipt Verification**: `POST /api/payments/verify-receipt` fetches the mined transaction receipt directly from the Arc RPC node, parses the native `Transfer` log, and verifies sender, recipient, amount, and token contract.
4. **Custodial Rejection Guard**: `/api/payments/execute` enforces `assertNonCustodialIsolation()` to reject any public organization attempting custodial execution.

### 3.6 On-Chain Cryptographic Audit Anchor (`AuditAnchor.sol`)
- **Target EVM**: Compiled to the `paris` EVM specification, guaranteeing zero `PUSH0` incompatibility across all Arc nodes.
- **Anchor Key**: Multi-tenant key $\text{keccak256}(\text{msg.sender}, \text{invoiceHash})$ ensures complete privacy and isolation between businesses.
- **Zero-Token Footprint**: The contract holds no assets; it emits the `AnchorCommitted` event to create an unforgeable public record on Arc block explorers.

---

## 4. Network Specifications

| Parameter | Arc Mainnet | Arc Testnet |
|---|---|---|
| **Chain ID** | `5042` | `5042002` |
| **RPC Endpoint** | `https://rpc.mainnet.arc.io` | `https://rpc.testnet.arc.io` |
| **Explorer** | `https://explorer.arc.io` | `https://testnet.arcscan.io` |
| **Native Gas Currency** | USDC (18 decimals) | USDC (18 decimals) |
| **Settlement USDC Token** | `0x3600000000000000000000000000000000000000` | `0x3600000000000000000000000000000000000000` |
| **App Max Beta Limit** | 25.00 USDC | Unlimited (Faucet) |

---

## 5. Runtime Dual-Network Architecture & Physical Isolation

BizFlow Pilot V2 provides a seamless, instant runtime switch between Arc Mainnet (`5042`) and Arc Testnet (`5042002`) within a single deployment:

### 5.1 Request-Scoped Network Resolution
- The active network is request-scoped via the `bizflow_network` cookie (`mainnet` or `testnet`), validated against a strict whitelist with `SameSite=Lax`, `Secure` in production, and falling back to `DEFAULT_NETWORK` (`mainnet`).
- Build-time flags like `NEXT_PUBLIC_NETWORK_MODE` are eliminated as sources of truth. All Server Components, Server Actions, and Route Handlers resolve network dynamically.

### 5.2 Physical Database Isolation (Zero Cross-Talk)
- **Mainnet Database**: Uses `DATABASE_URL_MAINNET` / `DIRECT_URL_MAINNET` enforcing `schema=v2_mainnet`.
- **Testnet Database**: Uses `DATABASE_URL_TESTNET` / `DIRECT_URL_TESTNET` enforcing `schema=v2_testnet`.
- Exposes exclusively `getDb(network)`. The legacy global `prisma` import is removed across the codebase, guaranteed by compile-time assertions and `tests/no-unscoped-prisma-import.test.ts`.

### 5.3 Anti-Desync & Stale-Tab Protection (HTTP 409 Conflict)
- All state-changing mutations (`POST`, `PUT`, `PATCH`, `DELETE`) require the `X-Bizflow-Network` header matching the active cookie.
- If a user changes networks in one browser tab, any pending mutations in older tabs are immediately rejected with **HTTP 409 Conflict**, preventing accidental transactions or database writes on the wrong network.
- Cross-tab synchronization is maintained via `BroadcastChannel` and `storage` events.

### 5.4 Public Routes & Data Presentation
- **Public Verification Passport**: `/verify/[network]/[id]` displays verified on-chain proofs and audit blocks for the selected network. Legacy `/verify/[id]` links automatically 301-redirect to the appropriate network.
- **Public Real-Time Metrics**: `/metrics` and `/api/metrics` display real Mainnet and Testnet metrics in dedicated side-by-side columns with zero aggregation or cross-network blending.
- **Judge & Pilot Discovery**: `/pilots` filters pilot businesses by the active network context.
