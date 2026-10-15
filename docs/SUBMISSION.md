# BizFlow Pilot V2 — Tameion Agents Hackathon Submission

**Competition**: Tameion Agents Hackathon (Canteen x Circle x Arc)  
**Submission Date**: October 2026  
**Track**: AP/AR Automation & Autonomous Business Operator  
**License**: MIT  
**Architecture**: Single Unified Application with Runtime Testnet/Mainnet Switch

---

## 1. Project Overview & Pitch

* **Project Title**: **BizFlow Pilot V2 (Tameion Edition)**
* **One-Line Pitch**: The autonomous, non-custodial financial operations engine that turns real enterprise procurement into policy-approved USDC settlements on Arc Mainnet, with cryptographic proof anchoring and public verification passports.
* **Unified Single Application**: One deployed application supporting instant in-app switching between **Arc Mainnet (Chain ID 5042, real USDC)** and **Arc Testnet (Chain ID 5042002, free test USDC)**.
* **Physical Data Isolation**: Strict dual PostgreSQL schema separation (`schema=v2_mainnet` vs `schema=v2_testnet`), request-scoped database routing (`getDb(network)`), and `X-Bizflow-Network` state mutation guards preventing cross-network data contamination.
* **Interactive Judge Guide**: Open `/judges` directly on the site for an unauthenticated 5-minute evaluation walkthrough.
* **Public GitHub Repository**: [https://github.com/Solking-crpto/bizflow-pilot-v2](https://github.com/Solking-crpto/bizflow-pilot-v2) *(configured via `NEXT_PUBLIC_REPO_URL`)*
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
| **Recipient Vendor Address** | `0x3B5D2009e6c2d05413AB77853158fE3f445A174d` | [View Vendor on Arc Explorer](https://explorer.arc.io/address/0x3B5D2009e6c2d05413AB77853158fE3f445A174d) |

---

## 3. Addressing the Four Judging Criteria

### 3.1 Agentic Sophistication (30%)
* **Advisory AI with Dynamic Cash Intelligence**: Rather than simple robotic process automation, BizFlow's AI agent analyzes cash reserves, upcoming obligations, and early-payment discounts (e.g. 2/10 net 30). It computes whether capturing a discount yields higher APR than holding liquidity, outputting explicit financial reasoning.
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
* **Circle Developer-Controlled Wallets SDK**: Integrated via `@circle-fin/developer-controlled-wallets` to manage programmatic treasury wallets on Arc Testnet (`ARC-TESTNET`).
* **Testnet Judge Sandbox**: Evaluators can test full automated settlements risk-free under `PUBLIC_SANDBOX=true`, using Circle testnet infrastructure with sliding-window rate limiting.
* **Native USDC Architecture**: Settles in native USDC on Arc, where USDC functions as both transaction currency and native gas token.
* **Circle Faucet Integration**: Deep links to `https://faucet.circle.com` with automated wallet address copying for seamless evaluator testing.

### 3.4 Innovation (20%)
* **Runtime Single-Deployment Switch**: Eliminates confusing dual deployments. A segmented controller (`TESTNET` | `MAINNET`) switches networks instantly in-app, setting an authenticated `bizflow_network` cookie with cross-tab BroadcastChannel synchronization and HTTP 409 stale-tab protection.
* **Non-Custodial Enterprise AP Flow**: The server prepares cryptographic payment intents, and the user's browser wallet signs the ERC-20 transfer. The server verifies on-chain receipts directly against Arc RPC (`eth_getTransactionReceipt`).
* **Multi-Tenant AuditAnchor.sol on Arc**: Smart contract compiled targeting Parisian EVM that commits `(msg.sender, invoiceHash, paymentTxHash, ledgerHash)` to Arc without leaking confidential commercial line items.
* **Prompt Injection Defense**: Inbound invoice text is quarantined and sanitized for hostile instructions before reaching the LLM.
* **Public Payment Passport (`/verify/[network]/[id]`)**: Instant, zero-login cryptographic proof page for vendors and external auditors with network-aware verification.

---

## 4. Comprehensive Testing & Verification Summary

BizFlow Pilot V2 has been rigorously verified across unit, integration, IDOR security, and bundle safety tests:

* **Test Suite Status**: **33 test suites passing cleanly with zero failures (170+ tests)**.
* **Client Bundle Scanner**: Verified clean via AST scanner; negative testing confirms automatic build failure on planted secrets.
* **IDOR Security Testing**: Proves complete multi-tenant isolation across all procurement, payment, and audit routes.
* **Next.js Production Build**: `npm run build` succeeds cleanly with zero TypeScript or lint errors.
* **Database Safety Guard**: Prevents any test execution from touching `schema=v2_mainnet`.

---

## 5. Quick Links for Evaluators
- **Judge Guide**: `/judges`
- **Public Metrics (Live Data)**: `/metrics`
- **Live Health Diagnostics**: `GET /api/health`
- **Public JSON Proof**: `GET /api/proof`
- **Terms & Non-Custodial Beta Notice**: `/terms`, `/privacy`, `/risk`
