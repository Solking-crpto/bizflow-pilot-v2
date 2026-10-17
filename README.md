# BizFlow Pilot V2 — Non-Custodial Public Beta on Arc Mainnet

> **The autonomous, non-custodial financial operations engine that turns real enterprise procurement into policy-governed USDC settlements on Arc Mainnet.**  
> Built with an air-gapped architecture where AI proposes, deterministic code verifies, and private keys are never held by the server. Small businesses pay suppliers directly from their own Web3 wallets.  
> Every settlement anchors an immutable SHA-256 cryptographic audit trail to `AuditAnchor.sol` on Arc for public, zero-login verification.

Built for the **Tameion Agents Hackathon (Canteen x Circle x Arc)** — October 2026.  
Upgraded from the original [BizFlow Pilot (Arc Microgrants edition)](https://github.com/iamoracle/bizflow-pilot).

---

### What V2 Adds:
1. **100% Non-Custodial Public Beta**: The server never holds, stores, or spends user funds. Small businesses connect their own Web3 wallets (SIWE) and sign USDC disbursements directly in their browser.
2. **Autonomous & Advisory Agent Modes**:
   - **Public Orgs**: AI advisory engine analyzes cash position and obligations, recommending `pay_now`, `schedule`, `hold`, or `request_review` with early-pay discount calculations (e.g. 2/10 net 30).
   - **Builder Admin Org**: Autonomous loop with daily cron execution and strict spending limits (`AUTO_APPROVE_LIMIT_USDC`, `MAX_DAILY_AUTONOMOUS_USDC`).
3. **Wallet Sign-In & Multi-Tenant Cryptographic Isolation**: EIP-191 Sign-In With Ethereum (SIWE) with one-time nonces and HMAC-SHA256 authenticated cookies. Full IDOR isolation between organizations.
4. **Onboarding & Procurement Suite**: Full CRUD for suppliers (with blocked-address check against known test accounts and 24h wallet update cooldowns; not an official regulatory sanctions screen), line-item Purchase Orders, Goods Receipts, and Invoices with prompt injection quarantine.
5. **Multi-Tenant Audit Anchor (`AuditAnchor.sol`)**: Compiled to `paris` EVM target (no `PUSH0`), partitioning on-chain audit proofs by `(msg.sender, invoiceHash)` on Arc Mainnet.
6. **Honest Public Metrics (`/metrics`)**: Computed strictly from live database rows with zero synthetic data or mock fallbacks. Shows `0` or `"n/a"` when empty.
7. **Comprehensive Test Suite**: 121 tests passing across 20 Vitest test files + Playwright E2E testing + strict TypeScript build.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14_App_Router-black.svg)](https://nextjs.org/)
[![Arc Mainnet](https://img.shields.io/badge/Arc_Mainnet-Chain_5042-teal.svg)](https://explorer.arc.io)
[![Arc Testnet](https://img.shields.io/badge/Arc_Testnet-Chain_5042002-amber.svg)](https://testnet.arcscan.app)
[![Tests Passing](https://img.shields.io/badge/Tests-167_passed-brightgreen.svg)](tests/)

---

## Live Deployment & Real Arc Mainnet Artifacts

- **Live Application:** [https://bizflow-pilot.vercel.app](https://bizflow-pilot.vercel.app) *(or your deployed production URL)*
- **Interactive Judge Guide:** Open `/judges` directly on the site for an unauthenticated 5-minute evaluation walkthrough.
- **Public Metrics:** Open `/metrics` to view live, honest platform metrics computed from real database rows.
- **Target Blockchain:** **Arc Mainnet (Chain ID `5042`)**
- **Native Gas Asset:** USDC (18 decimals native gas token)
- **Settlement Asset:** USDC (System ERC-20 `0x3600000000000000000000000000000000000000`)
- **Real Settlement Transaction (0.50 USDC):**
  - **Tx Hash:** [`0x9f5a7d65b758269d6c42939b4cb0e7e17eaec596b42b6559d2824dfb5dbd0e82`](https://explorer.arc.io/tx/0x9f5a7d65b758269d6c42939b4cb0e7e17eaec596b42b6559d2824dfb5dbd0e82)
  - **Live Verification Passport:** Open `/verify/inv-mainnet-101`
- **Deployed AuditAnchor Contract:**
  - **Address:** [`0x2b18fe9d3a63710da242092571744520ea8effe0`](https://explorer.arc.io/address/0x2b18fe9d3a63710da242092571744520ea8effe0)
  - **Anchor Tx:** [`0x600e31431faba6022dbc5d259961ddc4fbd89e7c2867b1e590ca76f8d74b83e4`](https://explorer.arc.io/tx/0x600e31431faba6022dbc5d259961ddc4fbd89e7c2867b1e590ca76f8d74b83e4)
  - **Block Height:** `25822380`

> [!WARNING]
> **Wallet Security Notice:** Some wallet security filters may flag new websites. BizFlow Pilot V2 is open source and non-custodial: it asks only for a free sign-in signature and for USDC transfers you explicitly review and approve. We have asked for a review. To try it safely, use TESTNET with a fresh wallet that holds no real funds, or run it locally (`npm install`, `npm run dev`). Never connect a wallet that holds real funds to any site you are unsure about.

---

<!-- ADDRESSES_PROOF_START -->
### Addresses and Proof

| Entity / Contract | Address / Identifier | Network | Explorer Link |
|---|---|---|---|
| **Builder-Operated Treasury** | `0x061F5c70D68A246b654724C0f9595F3a14cF9b0B` | Arc Mainnet (`5042`) | [View Treasury on Arc Explorer](https://explorer.arc.io/address/0x061F5c70D68A246b654724C0f9595F3a14cF9b0B) |
| **Audit Anchor Contract** | `0xf277e351656699c2a0e1a0d9e4ecb5e786916ba9` | Arc Mainnet (`5042`) | [View Audit Anchor Contract](https://explorer.arc.io/address/0xf277e351656699c2a0e1a0d9e4ecb5e786916ba9) |
| **Native USDC System Contract** | `0x3600000000000000000000000000000000000000` | Arc Mainnet (`5042`) | [View USDC Contract](https://explorer.arc.io/address/0x3600000000000000000000000000000000000000) |
| **Active Verified Vendor (Northgate Cement Supply (demo vendor))** | `0x3B5D2009e6c2d05413AB77853158fE3f445A174d` | Arc Mainnet (`5042`) | [View Vendor Wallet](https://explorer.arc.io/address/0x3B5D2009e6c2d05413AB77853158fE3f445A174d) |
<!-- ADDRESSES_PROOF_END -->

---

## Non-Custodial Architecture & Trust Boundary

```mermaid
flowchart LR
    subgraph Browser["User Browser (Non-Custodial)"]
        WALLET["Web3 Wallet\n(MetaMask / Rabby)"]
        UI["BizFlow UI\n(Next.js App)"]
    end

    subgraph Server["BizFlow Advisory Engine"]
        MATCH["3-Way Match & Anti-Injection"]
        AI["AI Finance Agent\n(Timing & Discounts)"]
        POLICY{"10-Point Deterministic\nPolicy Engine"}
        INTENT["Payment Intent Service"]
        VERIFIER["Arc RPC Receipt Verifier"]
    end

    subgraph Arc["Arc Mainnet (Chain 5042)"]
        TRANSFER["Native USDC Transfer\n(0x3600...0000)"]
        ANCHOR["AuditAnchor.sol\n(Cryptographic Proof)"]
    end

    UI -->|1. Submit PO / GR / Invoice| MATCH
    MATCH -->|2. Reconciled Context| AI
    AI -->|3. Propose Pay/Schedule/Hold| UI
    UI -->|4. Request Payment Intent| INTENT
    POLICY -->|5. Validate 10 Rules| INTENT
    INTENT -->|6. Cryptographic Intent| UI
    UI -->|7. Prompt Signature| WALLET
    WALLET -->|8. Sign & Broadcast Transfer| TRANSFER
    TRANSFER -->|9. Mined Receipt| VERIFIER
    UI -->|10. POST /verify-receipt| VERIFIER
    WALLET -->|11. Sign commitAnchor()| ANCHOR
    ANCHOR -->|12. Public Proof| PASSPORT["Public Payment Passport\n(/verify/[id])"]
```

### The Trust Model: Three-Tier Separation of Concerns

| Dimension | AI Advisory Layer | Deterministic Policy Gate | User Web3 Wallet |
|---|---|---|---|
| **Role** | **Proposal only**. Evaluates discounts and timing. | **Validation gatekeeper**. Enforces corporate rules. | **Execution authority**. Holds private key. |
| **Private Keys** | **Never exposed**. Runs in isolated sandbox. | **Zero custody**. Server holds no user keys. | **Client-side only**. Stored securely in user's wallet. |
| **Authority** | Suggests payment action with reasoning. | Grants or denies payment intent UUID. | Authorizes and signs on-chain USDC transfer. |
| **Prompt Injection** | Quarantined and neutralized via schema. | Hard failure if 3-way match does not pass. | User reviews recipient address in wallet popup. |
| **Auditability** | Snapshot reasoning logged in `AgentDecision`. | Policy evaluation recorded in audit trail. | Mined on Arc Mainnet, anchored in `AuditAnchor.sol`. |

---

## 10-Point Deterministic Policy Guardrails

Every payment intent must pass all 10 deterministic server-side rules before issuance:

1. **Active Whitelisted Vendor**: Beneficiary must be registered with active status in the organization.
2. **Wallet Authenticity**: Destination wallet must match vendor record with no pending address cooldowns.
3. **Price Tolerance**: Invoiced unit price must match approved PO within 1.00% (100 bps).
4. **Quantity Reconciliation**: Invoiced quantity cannot exceed goods receipt note count.
5. **Zero-Day Duplicate Hash Screen**: SHA-256 invoice content hash must be unique across all time.
6. **Prompt-Injection Defense**: Text payloads scanned and quarantined for adversarial prompt injection strings.
7. **Single Transaction Spending Cap**: Payment must not exceed organization limit or beta safety ceiling ($25.00 USDC).
8. **Daily Volume Limit**: Cumulative 24-hour spending cannot exceed organizational threshold.
9. **Treasury Reserve Floor**: Settlement must preserve configured cash reserve buffer in user wallet.
10. **Governance Emergency Kill-Switch**: Master emergency halt switch must be in disarmed state.

---

## Step-by-Step User Walkthrough

### 1. Sign-In With Ethereum (SIWE)
- Visit `/onboarding` or click **"Connect Wallet"** in the top navigation.
- Sign the standard EIP-191 authentication challenge in your Web3 wallet.
- The server issues a secure, signed `httpOnly` session cookie tied to your wallet address.

### 2. Configure Your Business Profile
- Set your business name, country, and contact email.
- Configure corporate governance parameters: per-payment ceiling, price matching tolerance (e.g. 1.00%), and cash reserve buffer.

### 3. Register Suppliers & Issue Procurement Documents
- **Suppliers (`/suppliers`)**: Add your suppliers with validated payout wallets. Includes automated blocked-address check (known test-wallet blocklist; not an official regulatory sanctions screen) and a 24-hour settlement cooldown on payout wallet updates.
- **Purchase Orders (`/inventory`)**: Create line-item POs with atomic integer USDC pricing.
- **Goods Receipts (`/inventory`)**: Log warehouse receiving slips to enable 3-way matching.
- **Invoices (`/invoices`)**: Ingest vendor invoices via manual entry, text paste, or PDF upload.

### 4. Run AI Advisory Analysis (`/agent`)
- Click **"Analyze My Invoices"** on the Agent Dashboard.
- The agent reads open invoices, queries live Arc wallet balances, analyzes payment terms (e.g., 2% early-pay discount), and outputs a structured financial recommendation (`pay_now`, `schedule`, `hold`, or `request_review`).

### 5. Sign Non-Custodial Payment
- Click **"Review & Sign Payment"** on any approved invoice.
- BizFlow prepares a verified Payment Intent (UUID, recipient address, atomic amount, 15-minute expiry).
- Your browser wallet pops up to sign the ERC-20 `transfer` on Arc Mainnet.
- BizFlow independently verifies the mined transaction receipt directly from the Arc RPC node.

### 6. Anchor Proof & Share Public Passport
- Optionally click **"Anchor Audit Proof"** to commit the cryptographic hashes to `AuditAnchor.sol`.
- Share the public verification URL (`/verify/[invoiceId]`) with suppliers or auditors for instant, zero-login transparency.

---

## Public Review Endpoints (No Login Required)

BizFlow Pilot V2 is designed for frictionless hackathon review:

- **`/`**: Command Center with live proof banner, live Arc RPC metrics, and navigation desk.
- **`/judges`**: Dedicated Judge Guide with hackathon compliance checklist and links.
- **`/metrics`**: Live public metrics computed from real database records (zero synthetic data).
- **`/verify/[id]`**: Public Payment Passport with live Arc RPC receipt verification, gas details, and 10-rule audit certificate.
- **`/audit`**: Append-only cryptographic ledger with in-browser "Verify Chain" SHA-256 re-hashing.
- **`/terms` / `/privacy` / `/risk`**: Complete legal disclosures detailing the non-custodial public beta terms.
- **`GET /api/metrics`**: Fast JSON endpoint reporting live platform statistics.
- **`GET /api/proof`**: Public JSON endpoint returning the latest confirmed settlement and anchor transactions.
- **`GET /api/health`**: Automated diagnostics reporting database health, Arc RPC latency, and contract bytecode status.

---

## Running Locally

### Prerequisites
- Node.js 18+ (tested on Node 20 LTS)
- PowerShell (Windows) or bash (macOS/Linux)
- Git

### 1. Installation
```powershell
git clone https://github.com/iamoracle/bizflow-pilot.git
cd "bizflow-pilot-v2"
npm install
```

### 2. Database Initialization
```powershell
# Generate Prisma Client
npm run db:generate

# Push schema to Arc Testnet database (schema=v2_testnet)
npm run db:push:testnet

# Push schema to Arc Mainnet database (schema=v2_mainnet)
npm run db:push:mainnet
```

### 3. Running Development Server
```powershell
# Start dev server on port 3002 (with runtime network switcher enabled)
npm run dev
```
Visit [http://localhost:3002](http://localhost:3002) in your browser.

### 4. Running Test Suites & Bundle Verification
```powershell
# Run all 167 unit, integration, and security tests across 33 test suites
npm test

# Run preflight verification for Arc Testnet / Mainnet
npm run preflight:testnet
npm run preflight:mainnet

# Build optimized production bundle
npm run build

# Verify client bundles contain zero leaked secrets
npm run scan:bundle
```

---

## Transparent Public Beta Disclosures & Risk Limits

1. **Non-Custodial Beta**: BizFlow Pilot V2 is provided as-is during its public beta. Users retain sole custody of their private keys and are responsible for signing transactions.
2. **Beta Transaction Safety Cap**: To protect public beta users, single transactions are capped at **25.00 USDC** (`APP_MAX_PAYMENT_USDC`).
3. **Experimental Blockchain**: Arc is an emerging, high-performance EVM network. Users should maintain adequate gas reserves for sub-second confirmations.
4. **Zero Synthetic Data in Production**: All metrics and tables represent authentic database records. Testnet sandbox data is strictly segregated and clearly labelled `SAMPLE`.

---

## License

This project is licensed under the [MIT License](LICENSE) — free and open source.
