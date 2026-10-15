# BizFlow Pilot V2 — Tameion Agents Hackathon Submission

**Competition**: Tameion Agents Hackathon (Canteen x Circle x Arc)  
**Submission Date**: October 2026  
**Track**: AP/AR Automation & Autonomous Business Operator  
**License**: MIT  

---

## 1. Project Overview & Pitch

* **Project Title**: **BizFlow Pilot V2 (Tameion Edition)**
* **One-Line Pitch**: The autonomous, non-custodial financial operations engine that turns real enterprise procurement into policy-approved USDC settlements on Arc Mainnet, with cryptographic proof anchoring and public verification passports.
* **Live Web Application**: [https://bizflow-pilot.vercel.app](https://bizflow-pilot.vercel.app) *(or deployed Vercel domain)*
* **Interactive Judge Guide**: Open `/judges` directly on the site for an unauthenticated 5-minute evaluation walkthrough.
* **Public GitHub Repository**: [https://github.com/iamoracle/bizflow-pilot](https://github.com/iamoracle/bizflow-pilot) *(configured via `NEXT_PUBLIC_REPO_URL`)*
* **Target Blockchain**: **Arc Mainnet (Chain ID `5042`)** & Arc Testnet (Chain ID `5042002`)
* **Settlement & Gas Token**: Native USDC on Arc

---

## 2. Real Arc Mainnet Artifacts & On-Chain Proof

All transactions and contract deployments below are confirmed on live **Arc Mainnet (Chain ID 5042)**:

| Artifact | Identifier / Address | Explorer Link |
|---|---|---|
| **Settlement Transaction (0.50 USDC)** | `0x9f5a7d65b758269d6c42939b4cb0e7e17eaec596b42b6559d2824dfb5dbd0e82` | [View Settlement on Arc Explorer](https://explorer.arc.io/tx/0x9f5a7d65b758269d6c42939b4cb0e7e17eaec596b42b6559d2824dfb5dbd0e82) |
| **Audit Anchor Contract** | `0x2b18fe9d3a63710da242092571744520ea8effe0` | [View Audit Anchor Contract](https://explorer.arc.io/address/0x2b18fe9d3a63710da242092571744520ea8effe0) |
| **Audit Commitment Tx** | `0x600e31431faba6022dbc5d259961ddc4fbd89e7c2867b1e590ca76f8d74b83e4` | [View Anchor Commitment Tx](https://explorer.arc.io/tx/0x600e31431faba6022dbc5d259961ddc4fbd89e7c2867b1e590ca76f8d74b83e4) |
| **Native USDC System Contract** | `0x3600000000000000000000000000000000000000` | [View Native USDC Contract](https://explorer.arc.io/address/0x3600000000000000000000000000000000000000) |
| **Builder-Operated Treasury** | `0x061F5c70D68A246b654724C0f9595F3a14cF9b0B` | [View Treasury on Arc Explorer](https://explorer.arc.io/address/0x061F5c70D68A246b654724C0f9595F3a14cF9b0B) |
| **Public Verification Passport** | Invoice `inv-mainnet-101` | [View Public Passport](https://bizflow-pilot.vercel.app/verify/inv-mainnet-101) |

---

## 3. Addressing the Four Judging Criteria

### 3.1 Agentic Sophistication (30%)
* **Advisory AI with Dynamic Cash Intelligence**: Rather than simple robotic process automation, BizFlow's AI agent analyzes cash flow reserves, upcoming obligations, and early-payment discounts (e.g. 2/10 net 30). It computes whether capturing a 2% discount yields higher APR than holding liquidity, outputting explicit financial reasoning.
* **Air-Gapped Safety Model**: AI proposes (`propose_payment`), but **never signs or holds keys**. A deterministic 10-rule policy engine acts as the ultimate gatekeeper, overriding AI proposals if any corporate safety rule is violated.
* **Autonomous & Assisted Modes**: In autonomous mode, the agent settles pre-approved recurring micro-payments within strict daily spending ceilings (`AUTO_APPROVE_LIMIT_USDC`, `MAX_DAILY_AUTONOMOUS_USDC`).
* **Human Escalation Queue & Agreement Tracking**: Non-standard or high-value invoices are escalated to a human approver. Owner decisions are logged to compute a live **Human-Agent Agreement Rate**.
* **Zero-Hallucination Fallback**: If LLM API connectivity is unavailable, BizFlow seamlessly fails over to an internal deterministic timing algorithm, logging the execution source (`model` vs `fallback`).

### 3.2 Traction & Real Usage (30%)
* **Zero Fake Volume Invariant**: Absolutely no hardcoded placeholder amounts, fake balances, or synthetic seeds exist in production paths. All metrics on `/metrics` are queried live from PostgreSQL rows.
* **Public Beta (Non-Custodial)**: Opened to real small businesses. Businesses connect their own wallets via Sign-In With Ethereum (SIWE), onboard their profile, configure risk parameters, and pay their vendors with their own funds.
* **$25 Beta Safety Ceiling**: To ensure prudent risk management during public beta, transactions are capped at 25.00 USDC per payment.
* **Verified Pilot**: Includes benchmark pilot engagement with BuildPro Infrastructure Ltd for construction materials procurement.

### 3.3 Circle Tool Usage (20%)
* **Circle Developer-Controlled Wallets SDK**: Deeply integrated via `@circle-fin/developer-controlled-wallets` to manage programmatic treasury wallets on Arc Testnet (`ARC-TESTNET`).
* **Testnet Judge Sandbox**: Evaluators can test full automated settlements without an owner passcode under `PUBLIC_SANDBOX=true`, using Circle testnet infrastructure with sliding-window rate limiting.
* **Native USDC Architecture**: Settles in native USDC on Arc, where USDC functions as both transaction currency and native gas.

### 3.4 Innovation (20%)
* **Non-Custodial Enterprise AP Flow**: The server prepares cryptographic payment intents, and the user's browser wallet signs the ERC-20 transfer. The server verifies on-chain receipts directly against Arc RPC (`eth_getTransactionReceipt`).
* **Multi-Tenant AuditAnchor.sol on Arc**: Smart contract compiled targeting Parisian EVM that commits `(msg.sender, invoiceHash, paymentTxHash, ledgerHash)` to Arc without leaking confidential commercial line items.
* **Prompt Injection Defense**: Inbound invoice text is quarantined and sanitized for hostile instructions before reaching the LLM.
* **Public Payment Passport (`/verify/[id]`)**: Instant, zero-login cryptographic proof page for vendors and external auditors.

---

## 4. Comprehensive Testing & Verification Summary

BizFlow Pilot V2 has been rigorously verified across unit, integration, IDOR security, and end-to-end tests:

* **Test Suite Status**: **121 tests passing across 20 test files (0 failures)**.
* **IDOR Security Testing**: Proves complete multi-tenant isolation across all procurement, payment, and audit routes.
* **Next.js Production Build**: `npm run build` succeeds cleanly with zero TypeScript or lint errors across 18 static/dynamic routes.
* **Mainnet Preflight**: Tested against live Arc Mainnet RPC (`5042`) with sub-second response times.

---

## 5. Quick Links for Evaluators
- **Judge Guide**: `/judges`
- **Public Metrics (Live Data)**: `/metrics`
- **Live Health Diagnostics**: `GET /api/health`
- **Public JSON Proof**: `GET /api/proof`
- **Terms & Non-Custodial Beta Notice**: `/terms`, `/privacy`, `/risk`
