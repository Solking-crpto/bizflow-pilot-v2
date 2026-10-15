# BizFlow Pilot V2 — Traction, Pilot Engagements & Honesty Policy

**Edition**: Tameion Agents Hackathon (Canteen x Circle x Arc) — October 2026  
**Status**: Live Non-Custodial Public Beta on Arc Mainnet (Chain ID `5042`)

---

## 1. Zero Fake Traction & Transparency Invariant

> [!IMPORTANT]
> **Strict Honesty & Zero-Synthetic Data Invariant**:
> BizFlow Pilot V2 enforces absolute honesty regarding users, volume, and traction metrics.
> - **No Synthetic Data in Production**: All seed fallbacks (`lib/demoData.ts`) have been completely purged from production routes.
> - **Live Database Aggregation**: Metrics on the `/metrics` page and Command Center are computed strictly from real database rows. If no public transactions have occurred, the metrics honestly display `0` or `"n/a"`.
> - **Separation of Builder vs. Public Volume**: Payments executed between the builder's own wallets or during engineering validation are explicitly declared as builder test transactions and excluded from organic public customer claims.

---

## 2. Platform Architecture: Two Distinct Operational Tracks

To ensure complete clarity for judges and auditors, BizFlow Pilot V2 distinguishes between two operational models:

### Track A: Builder-Operated Admin Org (Engineering Verification & Pilot Benchmark)
- **Purpose**: Operational benchmark demonstrating end-to-end autonomous policy execution, Arc Mainnet settlement, and on-chain anchoring.
- **Treasury Model**: Builder-operated EOA treasury funded directly by the team.
- **Real Arc Mainnet Settlements**:
  - **Settlement Transaction (0.50 USDC)**: [`0x9f5a7d65b758269d6c42939b4cb0e7e17eaec596b42b6559d2824dfb5dbd0e82`](https://explorer.arc.io/tx/0x9f5a7d65b758269d6c42939b4cb0e7e17eaec596b42b6559d2824dfb5dbd0e82)
    - Block: `25822380`
    - Recipient Vendor: `0x3B5D2009e6c2d05413AB77853158fE3f445A174d`
  - **AuditAnchor.sol Deployment**: [`0x2b18fe9d3a63710da242092571744520ea8effe0`](https://explorer.arc.io/address/0x2b18fe9d3a63710da242092571744520ea8effe0)
  - **Audit Anchor Commitment Tx**: [`0x600e31431faba6022dbc5d259961ddc4fbd89e7c2867b1e590ca76f8d74b83e4`](https://explorer.arc.io/tx/0x600e31431faba6022dbc5d259961ddc4fbd89e7c2867b1e590ca76f8d74b83e4)
- **Public Verification Passport**: [Verify Invoice inv-mainnet-101](https://bizflow-pilot.vercel.app/verify/inv-mainnet-101)

### Track B: Public Non-Custodial Beta (Small Business Self-Service)
- **Purpose**: Real self-service onboarding for independent small businesses transacting in USDC on Arc Mainnet.
- **Treasury Model**: **100% Non-Custodial**. Small businesses connect their own Web3 wallets (SIWE) and sign their own USDC disbursements. The BizFlow server holds zero funds, keys, or spending permissions.
- **Safety Safeguards**:
  - Maximum single payment limit capped at **25.00 USDC** (`APP_MAX_PAYMENT_USDC`).
  - Mandatory 24-hour settlement cooldown on vendor wallet changes.
  - Organization-level cash reserve floors and emergency kill switches.
- **Current Public Beta Status**: Live open onboarding at `/onboarding`.

---

## 3. Real-Time Metrics & Verification Endpoints

Auditors and hackathon judges can query live platform statistics at any time:

- **Public Metrics Webpage**: `/metrics`
  - Transparently displays total organizations, active pilot businesses, processed invoices, total settled USDC volume, blocked prompt injections, duplicates caught, and human-in-the-loop agreement rates.
  - All counters read directly from PostgreSQL with zero mock fallbacks.
- **Public JSON Metrics API**: `GET /api/metrics`
  - Fast, unauthenticated endpoint returning atomic metrics as JSON.
- **Public Proof API**: `GET /api/proof`
  - Returns the latest confirmed on-chain transaction hash, anchor transaction hash, block height, and timestamp.
- **Automated Health API**: `GET /api/health`
  - Validates live database connectivity, Arc RPC responsiveness, and smart contract bytecode verification in <200ms.

---

## 4. Pilot Organization Directory

| Business Name | Operating Sector | Operational Mode | Public Consent | Verification Link |
|---|---|---|---|---|
| **BuildPro Infrastructure Ltd** | Civil Engineering & Construction Logistics | Builder-Operated Benchmark | **Granted** (`publicConsent: true`) | [Operational Proof](/verify/inv-mainnet-101) |
| *Public Beta Orgs (Self-Service)* | Diverse SMEs (Logistics, SaaS, Services) | Non-Custodial (Self-Signed) | Managed per Org Settings | Live Database Scoped |

---

## 5. Pilot Onboarding & Verification Protocol

For new businesses joining the BizFlow Pilot V2 Public Beta:

1. **Self-Service Wallet Connection**: Connect an Arc-compatible Web3 wallet (MetaMask, Rabby, etc.) at `/onboarding`.
2. **Profile Creation**: Configure corporate identity, contact email, tolerance threshold (default 1.00%), and cash reserve buffer.
3. **Vendor Registry**: Add verified supplier payout addresses with automated OFAC sanctions screening and 24h cooldown verification.
4. **Three-Way Reconciliation**: Issue POs, log warehouse receipts, and upload invoices.
5. **Non-Custodial Settlement**: Run the AI advisory timing engine (`/agent`), review the payment intent, and sign the ERC-20 transfer directly in your wallet.
6. **Public Audit Passport**: Issue immutable verification passports at `/verify/[invoiceId]` for vendor transparency.
