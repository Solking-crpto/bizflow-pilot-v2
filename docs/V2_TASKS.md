# BizFlow Pilot V2 — Upgrade Task Checklist

## Public Beta (Non-Custodial) Upgrade
Status: IN_PROGRESS
Started: 15 Oct 2026

### Phase 1 — Remove the Demo, Add Real Empty States
- [x] 1.1 Quarantine / delete `seedMainnet` and `seedV2` from running against mainnet; isolate sample data loader for testnet only
- [x] 1.2 Remove demo data fallbacks (`lib/demoData.ts` fallbacks) across `lib/data.ts`, `InvoiceDeskClient`, `PaymentDeskClient`, etc.
- [x] 1.3 Add designed empty states with primary calls to action on every page (Suppliers, POs, Invoices, Payments, Agent, Decisions, Audit)
- [x] 1.4 Remove all hardcoded company names ("BuildPro", "Northgate", etc.), demo wallet addresses, and fake tx hashes from UI (TopNav, Footer, Command Center, Judge Guide, About, Passport)
- [x] 1.5 Phase 1 verification and local commit

### Phase 2 — Wallet Sign-In and Multi-User Isolation
- [x] 2.1 Nonce-based Sign-In With Ethereum (EIP-191) authentication: `GET /api/auth/nonce`, `POST /api/auth/verify`, `POST /api/auth/logout`, `GET /api/auth/me`
- [x] 2.2 Secure httpOnly SameSite=Lax signed session cookies with viem `verifyMessage` and one-time nonces
- [x] 2.3 Client-side wallet connection component using `window.ethereum` with viem (wrong network detection, Arc chain switch / add via `lib/networks.ts`, account switch / disconnect)
- [x] 2.4 Organization ownership mapped to connected wallet address; scope all queries and mutations to the session's organization
- [x] 2.5 Admin guard for builder-operated features (`ADMIN_WALLET_ADDRESS` or owner passcode); public orgs strictly isolated
- [x] 2.6 IDOR matrix and session security tests (cross-org data isolation, expired sessions, replayed nonces, wrong signers)
- [x] 2.7 Phase 2 verification and local commit

### Phase 3 — Onboarding and Data Entry (Zod Validated)
- [ ] 3.1 Onboarding wizard for new sign-ins: business name, country, optional website/X/LinkedIn, contact email, user governance settings (limits, tolerance, reserve) with beta hard cap `APP_MAX_PAYMENT_USDC`
- [ ] 3.2 Suppliers management (CRUD): name, category, payout wallet (checksummed, non-blocklisted, screening checked), email, cooldown on wallet change
- [ ] 3.3 Purchase Orders with line items (description, quantity, atomic USDC price) and Goods Receipts with running atomic totals
- [ ] 3.4 Invoices entry: manual form, paste-text, and file upload (SHA-256 hash stored, untrusted extraction)
- [ ] 3.5 Consistent atomic integer storage, formatted USDC display ("1,250.00 USDC"), inline validation, loading and error states
- [ ] 3.6 Phase 3 verification and local commit

### Phase 4 — Non-Custodial Payment Flow
- [ ] 4.1 Payment Intent lifecycle: `POST /api/payments/intent` with policy gate re-evaluation, atomic amount, recipient, token, expiry, idempotency key
- [ ] 4.2 Client-side signing with user's wallet via viem: chain check, gas check, USDC balance check, ERC-20 transfer
- [ ] 4.3 On-chain receipt verification: `POST /api/payments/verify-receipt` fetching receipt from Arc RPC, verifying token address, sender, recipient, amount, status
- [ ] 4.4 Non-custodial Audit Anchor: update `AuditAnchor.sol` uniqueness key to `(msg.sender, invoiceHash)`, compile Paris EVM target, user signs anchor tx
- [ ] 4.5 Public `/verify/[id]` privacy filter (displays only org-approved public proof data from live RPC)
- [ ] 4.6 Strict non-custodial guard: prevent public orgs from accessing server-treasury execution path
- [ ] 4.7 Phase 4 verification and local commit

### Phase 5 — Agent for Public Orgs
- [ ] 5.1 Public org "Analyze my invoices" action: reads org's open invoices and cash position directly from connected wallet, recommends pay now / schedule / hold / review with reasons
- [ ] 5.2 Model vs deterministic fallback transparency with per-org decision logs
- [ ] 5.3 Per-org and daily LLM rate limiting with `LLM_DAILY_CALL_LIMIT` global safety budget
- [ ] 5.4 Phase 5 verification and local commit

### Phase 6 — Safety, Legal and Public Readiness
- [ ] 6.1 Legal pages: Terms of Use, Privacy Policy, Risk & Non-custodial Notice (Beta labelled) with onboarding acknowledgement
- [ ] 6.2 Security headers, write-route rate limiting, CSRF/Origin validation, no stack traces
- [ ] 6.3 Public `/metrics` page computed exclusively from real database records (opt-in pilot businesses only)
- [ ] 6.4 Clean mainnet vs testnet separation (`PUBLIC_SANDBOX` strictly refused on mainnet; testnet sample data loader)
- [ ] 6.5 Phase 6 verification and local commit

### Phase 7 — UI Finish & Design System
- [ ] 7.1 Visual QA at 1440px, 1024px, 390px (mobile responsiveness, table scrolling, modals overlay, chip styling, long address truncation)
- [ ] 7.2 Reorganize navigation: Dashboard, Suppliers, Purchase Orders, Invoices, Payments, Agent, Audit, Settings
- [ ] 7.3 Consistent design system (spacing, typography, buttons, toasts, skeleton loaders, WCAG AA contrast)
- [ ] 7.4 Phase 7 verification and local commit

### Phase 8 — Comprehensive Testing
- [ ] 8.1 Unit & integration tests (payment intent, receipt verification, session security, IDOR matrix, leak tests)
- [ ] 8.2 Playwright E2E full user journey with mocked injected wallet
- [ ] 8.3 Verify `npm test` and `next build` pass with zero errors
- [ ] 8.4 Phase 8 verification and local commit

### Phase 9 — Documentation & Submission Updates
- [ ] 9.1 Update README.md, docs/SUBMISSION.md, docs/TRACTION.md, docs/CIRCLE_USAGE.md, docs/SOURCES_V2.md, docs/SECURITY.md, docs/ARCHITECTURE.md, .env.example
- [ ] 9.2 Final acceptance verification against all prompt criteria
- [ ] 9.3 Final report with PowerShell commands and manual QA steps

---

## Tameion Tier 1-3 Upgrade (Completed Archive)
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
