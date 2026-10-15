# BizFlow Pilot V2 — Tameion Upgrade Task Checklist

Status: COMPLETED
Started: 15 Oct 2026
Completed: 15 Oct 2026

## Tier 1 — Agency on Mainnet (Target: Must Ship)
- [x] **1. V2 Identity & Links**
  - [x] Package name updated to `bizflow-pilot-v2` in package.json
  - [x] App name "BizFlow Pilot V2" across title, navigation, headers
  - [x] Footer "Tameion edition"
  - [x] Environment URLs `NEXT_PUBLIC_REPO_URL` and `NEXT_PUBLIC_APP_URL` used everywhere; remove hardcoded links to original app
  - [x] README header linking to original Arc Microgrants version with V2 upgrade rationale
- [x] **2. Schema & Database Guardrails**
  - [x] Verify Prisma schema parameter (`?schema=v2_mainnet` / `v2_testnet`) support
  - [x] Add unit test ensuring no raw queries or seeders hardcode "public" schema
  - [x] Update Prisma schema with new models and fields:
    - `Setting`: `agentMode` ("assisted" | "autonomous"), `autoApproveLimitUsdc` (BigInt), `maxDailyAutonomousUsdc` (BigInt)
    - `Invoice`: `dueDate` (DateTime?), `earlyPayDiscountPct` (Float/Int?), `earlyPayDays` (Int?)
    - `AgentDecision`: model for detailed autonomous decision logs
- [x] **3. Autonomous Agent Loop & API**
  - [x] Implement `POST /api/agent/run` with authentication via owner passcode OR `CRON_SECRET` bearer token
  - [x] Add "Run agent now" button on `/agent` page
  - [x] Add daily Vercel cron entry in `vercel.json`
  - [x] Loop logic for open invoices:
    - 3-way match, duplicate detection, injection screening, wallet screening
    - Read cash position and obligations
    - Autonomous execution criteria: autonomous mode, policy approved, within auto-approve limit & daily cap, kill switch OFF, network guard passes
    - Re-evaluate policy at execution time via server-side idempotent path with actor "agent"
    - Automatic escalation when criteria not met
- [x] **4. Decision Log & Metrics Header**
  - [x] Decision logging with observation snapshot hash, cash position, choice, reasoning, source (`llm` or `fallback`), model name, prompt version, escalated status, outcome, tx hash
  - [x] New page "Agent Decisions" (`/agent/decisions` / `/decisions`) with filterable table
  - [x] Real metrics computation (no mock data, "n/a" when empty): invoices processed, USDC payment volume, duplicates caught, injections blocked, decisions made, auto-executed, escalated, human agreement rate
  - [x] Add identical real metrics header to Command Center (`/`)
- [x] **5. Escalation Queue & Human Agreement**
  - [x] UI for escalated decisions with agent rationale
  - [x] Owner approve/reject modal with passcode
  - [x] Store human response (approved/rejected) to update human agreement rate
  - [x] Approved escalations execute through the safe idempotent payment path
- [x] **6. Payment Timing Intelligence**
  - [x] Compute discount capture value vs cash reserve buffer and upcoming obligations
  - [x] Explain timing reasoning ("pay now to capture 2% discount, reserve stays above X" vs "hold until Y")
  - [x] Later runs pick up scheduled invoices when due
- [x] **7. LLM Integration with Strict Zod Validation**
  - [x] Provider support (Anthropic / Google) with structured outputs
  - [x] Tools: `get_cash_position`, `list_obligations`, `get_invoice_verification`, `propose_payment`
  - [x] Deterministic fallback mechanism
  - [x] Source tracking (`llm` vs `fallback`)
  - [x] Deterministic policy override: policy engine always overrides LLM if in conflict, logging the conflict
- [x] **8. Proof, Addresses & Traction Docs**
  - [x] `scripts/writeAddressesReadme.ts`: auto-generate "Addresses and proof" table in README from env and database (no private keys)
  - [x] `docs/TRACTION.md` honesty template
- [x] **9. V2 Seed Data (`scripts/seedV2.ts`)**
  - [x] Seed invoices with due dates, early-pay discounts, and realistic scenarios
  - [x] Safe guard: refuse to run if confirmed payments exist
  - [x] Demo data clearly labelled in UI
- [x] **10. Tier 1 Testing & Verification**
  - [x] Unit tests for autonomous limits, daily cap, kill switch, escalation, idempotency, schema
  - [x] Update `tests/leak.test.ts` and `tests/endpoints.test.ts` to run reliably
  - [x] Playwright E2E for new pages and run button (dry run)
  - [x] All tests passing (`npm test`), build passing (`next build`), local git commit
 
## Tier 2 — Traction & Judge Hands-on
- [x] **11. Pilot Organizations**
  - [x] Update `Organization` schema: `isPilot`, `proofUrls` (website, X, LinkedIn), `publicConsent`, `createdAt`
  - [x] Owner-passcode admin page "Pilot businesses" to create/manage orgs
  - [x] Org switcher and org-scoping for queries and payments
  - [x] Public read-only `/pilots` page showing ONLY orgs with `publicConsent=true` with real per-org metrics
  - [x] Builder-operated treasury label ("builder-operated treasury, funded by the business")
- [x] **12. Judge Sandbox Mode**
  - [x] `PUBLIC_SANDBOX=true` mode on testnet with Circle Wallets (`ARC-TESTNET`)
  - [x] Hard refuse at startup if `PUBLIC_SANDBOX=true` on mainnet
  - [x] Rate limiting and tiny cap for sandbox visitors
  - [x] Banner: "Sandbox: test USDC only"
  - [x] Verified Circle Wallets testnet flow documented in `docs/CIRCLE_USAGE.md`
- [x] **13. Tier 2 Verification & Commit**
  - [x] Tests and build pass; local git commit

## Tier 3 — Extensions behind Feature Flags
- [x] **14. Arc App Kit Send Provider**
  - [x] Implement `AppKitSendProvider` adhering to `https://docs.arc.network/app-kit/send`
  - [x] Feature flag `ENABLE_APP_KIT_SEND=true` (off by default on mainnet)
- [x] **15. PolicyVault Smart Contract**
  - [x] Solidity contract (`contracts/PolicyVault.sol`) with `paris` EVM target
  - [x] Unit/ABI tests for limits, approved vendors, operator execution
  - [x] Safe deployment script with `--yes` gate
- [x] **16. Sanctions Screening Interface**
  - [x] Interface for vendor sanctions screening
  - [x] Clear UI disclaimer when official provider is not connected
- [x] **17. Final Preflight & Acceptance Report**
  - [x] Unit/Acceptance tests passing (16 test suites, 96 tests)
  - [x] Mainnet preflight passing against `v2_mainnet` schema and live Arc Mainnet RPC
  - [x] Local git commit with clean tree
