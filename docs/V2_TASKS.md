# BizFlow Pilot V2 — Upgrade Task Checklist

## Runtime Network Switch (One App, Dual Network) Upgrade
Status: COMPLETED
Started: 15 Oct 2026
Completed: 15 Oct 2026
Verification: All 33 Vitest test suites (167 tests) passing; Next.js 14 production build passing with 22 dynamic static/server routes; Client bundle scan clean with zero leaked private keys or secrets.

### Section A — Runtime Network Architecture
- [x] A.1 `lib/networks.ts`: `NETWORKS = { mainnet, testnet }`, remove build-time `NEXT_PUBLIC_NETWORK_MODE`, request-scoped `getActiveNetwork()` reading `bizflow_network` cookie with `DEFAULT_NETWORK` fallback
- [x] A.2 `lib/db.ts`: Dual Prisma clients for `DATABASE_URL_MAINNET` (`schema=v2_mainnet`) and `DATABASE_URL_TESTNET` (`schema=v2_testnet`) with `connection_limit=1`. Expose ONLY `getDb(network)`. Remove global `prisma` export.
- [x] A.3 Server components, route handlers, actions and lib functions accept explicit `network` from request context
- [x] A.4 `X-Bizflow-Network` header validation: verify match against cookie on state-changing requests, return 409 Conflict on mismatch
- [x] A.5 Dynamic rendering (`force-dynamic`) on all data routes; no shared cache across networks
- [x] A.6 Session proves wallet ownership; Organization resolved by `(wallet, network)` via `getDb(network)`
- [x] A.7 Builder/admin features (server treasury, cron, autonomous agent) restricted to Mainnet only; no server-signed transfer for public orgs
- [x] A.8 Standardize exact per-network env variables (`ARC_*_RPC_URL`, `NEXT_PUBLIC_ARC_*_PUBLIC_RPC`, `ARC_*_USDC_ADDRESS`, etc.)
- [x] A.9 Network-scoped public pages: `/verify/[...slug]`, dual-column `/metrics`, network-filtered `/pilots`, updated Judge Guide and About

### Section B — The Switch (UX)
- [x] B.1 Segmented control `TESTNET | MAINNET` with clear badges (amber testnet banner / navy mainnet badge)
- [x] B.2 Mainnet switch confirmation modal ("You are switching to real USDC. Payments are final."); immediate testnet switch; cookie sync and wrong-chain wallet switch/add
- [x] B.3 Deep links `?network=testnet` and `?network=mainnet` with confirmation modal
- [x] B.4 Cross-tab sync via BroadcastChannel and storage event
- [x] B.5 First-visit chooser ("Try it free on testnet" vs "Use real USDC on mainnet")
- [x] B.6 Block signing on wrong chain with clear prompt
- [x] B.7 Testnet extras: Circle faucet helper, sample data loader in user's testnet org
- [x] B.8 Mainnet extras: one-time risk acknowledgement, zero-balance helper, payment confirmation step, "Try testnet first" link

### Section C — Safety Tests
- [x] C.1 Test: switching never shows rows from other network (`tests/runtime-network-isolation.test.ts`)
- [x] C.2 Test: header/cookie mismatch returns 409 on write routes (`tests/network-header-mismatch.test.ts`)
- [x] C.3 Test: stale-tab scenario handled (`tests/stale-tab-safety.test.ts`)
- [x] C.4 Test: mainnet-only features unreachable on testnet (`tests/mainnet-only-features.test.ts`)
- [x] C.5 Test: cache isolation across networks (`tests/cache-isolation.test.ts`)
- [x] C.6 Test: startup guards (schema separation, session secret strength, DRY_RUN / PUBLIC_SANDBOX safety) (`tests/startup-guards.test.ts`)
- [x] C.7 Test: no unscoped prisma imports across codebase (`tests/no-unscoped-prisma-import.test.ts`)
- [x] C.8 Client bundle scan for private RPC, secrets, or server database URLs (`tests/client-bundle-safety.test.ts`)

### Section D — Scripts, Environment & Deploy Tooling
- [x] D.1 Package scripts: `db:push:mainnet`, `db:push:testnet`, `preflight:mainnet`, `preflight:testnet`, `deploy:anchor:mainnet`, `deploy:anchor:testnet`, dev on port 3002
- [x] D.2 Updated `.env.example` with all variables and server-only vs public comments
- [x] D.3 `docs/DEPLOY.md` single-Vercel deployment guide

### Section E & F — Verification Gaps & Documentation
- [x] E.1 Visual QA screenshots across 1440, 1024, 390px saved to `docs/qa/`
- [x] E.2 Playwright test suite with mocked wallet and network switch test
- [x] E.3 OFAC / sanctions honesty verified
- [x] E.4 CSP verified in real browser
- [x] E.5 Circle usage honesty in `docs/CIRCLE_USAGE.md`
- [x] F.1 Update README, ARCHITECTURE, SECURITY, TRACTION, SUBMISSION, Judge Guide, About, and footer

---

## Public Beta (Non-Custodial) Upgrade
Status: COMPLETED
Started: 15 Oct 2026
Completed: 15 Oct 2026

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
- [x] 3.1 Onboarding wizard for new sign-ins: business name, country, optional website/X/LinkedIn, contact email, user governance settings (limits, tolerance, reserve) with beta hard cap `APP_MAX_PAYMENT_USDC`
- [x] 3.2 Suppliers management (CRUD): name, category, payout wallet (checksummed, non-blocklisted, screening checked), email, cooldown on wallet change
- [x] 3.3 Purchase Orders with line items (description, quantity, atomic USDC price) and Goods Receipts with running atomic totals
- [x] 3.4 Invoices entry: manual form, paste-text, and file upload (SHA-256 hash stored, untrusted extraction)
- [x] 3.5 Consistent atomic integer storage, formatted USDC display ("1,250.00 USDC"), inline validation, loading and error states
- [x] 3.6 Phase 3 verification and local commit

### Phase 4 — Non-Custodial Payment Flow
- [x] 4.1 Payment Intent lifecycle: `POST /api/payments/intent` with policy gate re-evaluation, atomic amount, recipient, token, expiry, idempotency key
- [x] 4.2 Client-side signing with user's wallet via viem: chain check, gas check, USDC balance check, ERC-20 transfer
- [x] 4.3 On-chain receipt verification: `POST /api/payments/verify-receipt` fetching receipt from Arc RPC, verifying token address, sender, recipient, amount, status
- [x] 4.4 Non-custodial Audit Anchor: update `AuditAnchor.sol` uniqueness key to `(msg.sender, invoiceHash)`, compile Paris EVM target, user signs anchor tx
- [x] 4.5 Public `/verify/[id]` privacy filter (displays only org-approved public proof data from live RPC)
- [x] 4.6 Strict non-custodial guard: prevent public orgs from accessing server-treasury execution path
- [x] 4.7 Phase 4 verification and local commit

### Phase 5 — Agent for Public Orgs
- [x] 5.1 Public org "Analyze my invoices" action: reads org's open invoices and cash position directly from connected wallet, recommends pay now / schedule / hold / review with reasons
- [x] 5.2 Model vs deterministic fallback transparency with per-org decision logs
- [x] 5.3 Per-org and daily LLM rate limiting with `LLM_DAILY_CALL_LIMIT` global safety budget
- [x] 5.4 Phase 5 verification and local commit

### Phase 6 — Safety, Legal and Public Readiness
- [x] 6.1 Legal pages: Terms of Use, Privacy Policy, Risk & Non-custodial Notice (Beta labelled) with onboarding acknowledgement
- [x] 6.2 Security headers, write-route rate limiting, CSRF/Origin validation, no stack traces
- [x] 6.3 Public `/metrics` page computed exclusively from real database records (opt-in pilot businesses only)
- [x] 6.4 Clean mainnet vs testnet separation (`PUBLIC_SANDBOX` strictly refused on mainnet; testnet sample data loader)
- [x] 6.5 Phase 6 verification and local commit

### Phase 7 — UI Finish & Design System
- [x] 7.1 Visual QA at 1440px, 1024px, 390px (mobile responsiveness, table scrolling, modals overlay, chip styling, long address truncation)
- [x] 7.2 Reorganize navigation: Dashboard, Suppliers, Purchase Orders, Invoices, Payments, Agent, Audit, Settings
- [x] 7.3 Consistent design system (spacing, typography, buttons, toasts, skeleton loaders, WCAG AA contrast)
- [x] 7.4 Phase 7 verification and local commit

### Phase 8 — Comprehensive Testing
- [x] 8.1 Unit & integration tests (payment intent, receipt verification, session security, IDOR matrix, leak tests)
- [x] 8.2 Playwright E2E full user journey with mocked injected wallet
- [x] 8.3 Verify `npm test` and `next build` pass with zero errors (121 tests across 20 suites)
- [x] 8.4 Phase 8 verification and local commit

### Phase 9 — Documentation & Submission Updates
- [x] 9.1 Update README.md, docs/SUBMISSION.md, docs/TRACTION.md, docs/CIRCLE_USAGE.md, docs/SOURCES_V2.md, docs/SECURITY.md, docs/ARCHITECTURE.md, .env.example
- [x] 9.2 Final acceptance verification against all prompt criteria
- [x] 9.3 Final report with PowerShell commands and manual QA steps

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
  - [x] Unit/Acceptance tests passing (34 test suites, 172 tests)
  - [x] Mainnet preflight passing against `v2_mainnet` schema and live Arc Mainnet RPC
  - [x] Local git commit with clean tree

---

## Section G — Defect Remediation & Comprehensive Verification (16 Oct 2026)
Status: COMPLETED
- [x] **Defect 1**: Created `lib/apiFetch.ts` auto-injecting `X-Bizflow-Network` and `credentials: same-origin`. Replaced all client-side `fetch("/api/...")` calls. Exempted `/api/auth/*` and `/api/network`. Static test `tests/no-direct-api-fetch.test.ts` passing.
- [x] **Defect 2**: Resolved Mainnet crashes and auth nonce issues. Loaded `.env.v2.local` safely in `next.config.mjs` and `lib/db.ts`. Verified all 20 tables exist in `v2_mainnet` schema. Replaced database nonce dependency with stateless HMAC-signed, single-use httpOnly cookie nonces (5-min TTL) in `lib/auth/stateless-nonce.ts`.
- [x] **Defect 3**: Enforced signed-out visitor isolation. All private pages (`/`, `/inventory`, `/invoices`, `/payments`, `/suppliers`, `/agent`, `/audit`, `/settings`) show designed "Connect your wallet to begin" empty states. Public pages (`/judges`, `/metrics`, `/verify`, `/pilots`, `/terms`, `/privacy`, `/risk`, `/about`) remain open. Purged hardcoded org names ("BuildPro", "Public Beta Org", "Default Org", "Dangote", "Northgate"). Authored `scripts/clean-testnet-seed.ts` (requires `--yes`, refuses mainnet).
- [x] **Defect 4**: Elevated modal and overlay z-indices to `z-[100]` with `bg-black/60 backdrop-blur-sm`, focus trapping, click-outside dismissal, and Escape key listener across all modals.
- [x] **Defect 5**: Updated Sidebar footer version to "BizFlow Pilot V2 · Tameion edition" reading `version` directly from `package.json`.
- [x] **Defect 6**: Updated footer anchor address resolution to read ONLY from `AUDIT_ANCHOR_ADDRESS_TESTNET` / `AUDIT_ANCHOR_ADDRESS_MAINNET`. Unset addresses cleanly display "Audit anchor: not deployed yet" with disabled link and clear title tooltip.
- [x] **Defect 7**: Converted wallet sign-in errors to clean floating toasts near button with dismiss `X`. Resolved responsive header layout for 1024px and 390px viewports (dedicated second row for mobile network switcher, zero horizontal overflow).
- [x] **Defect 8**: Keyed mainnet risk notice banner dismissal per wallet (`bizflow_mainnet_risk_ack_${address.toLowerCase()}`).
- [x] **Verification**:
  - Playwright E2E suite (`tests-e2e/e2e-journey.spec.ts`) passing 4/4 tests against `http://localhost:3002`.
  - Visual QA script (`scripts/capture-qa-screenshots.ts`) captured 102 screenshots across Testnet and Mainnet (1440px, 1024px, 390px) into `docs/qa/` with 0 defects.
  - Full Vitest suite passing 34/34 suites (172/172 tests).
  - Production build (`npm run build`) passing cleanly.
  - Client bundle scan (`npm run scan:bundle`) verified clean with negative testing verified.

---

## Section H — EIP-6963 Multi-Wallet Discovery, Arc Endpoints & Gas Guardrails (16 Oct 2026)
Status: COMPLETED
- [x] **1. Wallet Connect & EIP-6963 Discovery**:
  - [x] Implemented standard EIP-6963 discovery (`lib/auth/eip6963.ts`): listens for `eip6963:announceProvider`, dispatches `eip6963:requestProvider`.
  - [x] Sorted MetaMask to top of discovered wallets list; persisted wallet choice in `localStorage`.
  - [x] Created `WalletPickerModal.tsx` listing all announced wallets when >1 wallet detected, with "Install MetaMask" fallback link.
  - [x] Enforced synchronous `eth_requestAccounts` execution inside user click handler with zero prior `await` to prevent Chrome user activation suppression.
  - [x] Hard rule: zero calls to `wallet_switchEthereumChain` or `wallet_addEthereumChain` before accounts are granted.
  - [x] Error mapping: `4001` -> "You closed or declined the request in your wallet. Try again.", `-32002` -> "A request is already open. Open your wallet extension and approve it.", missing wallet -> "Install MetaMask".
  - [x] Added "Connecting... check your wallet extension" card with a working Cancel button.
  - [x] Displayed detected wallet names in About page via `<DetectedWallets />`.
  - [x] Created `tests/eip6963-wallet.test.ts` testing two mock providers: one rejecting (4001) and one pending (-32002).
- [x] **2. Arc Network Endpoints & RPC Resilience**:
  - [x] Updated `lib/networks.ts` and `.env.example` per official Arc documentation (`https://docs.arc.io/arc/references/rpc-endpoints` & `connect-to-arc`):
    - Testnet RPC: `https://rpc.testnet.arc.io` (replacing dead `rpc.testnet.arc.network`).
    - Mainnet RPC: `https://rpc.mainnet.arc.io` (anonymous, open CORS).
    - Explorers: `https://explorer.arc.io` (mainnet) and `https://explorer.testnet.arc.io` (testnet).
    - `wallet_addEthereumChain` parameters: exact from Connect to Arc page, with **18 decimals** explicitly specified for native USDC currency.
  - [x] Added `withRpcRetry()` with exponential backoff for Arc load balancer lag error code `-32014`.
  - [x] Added server-side fallback RPC lists across official node providers (Blockdaemon, dRPC, QuickNode).
  - [x] Created `tests/rpc-resilience.test.ts` verifying -32014 backoff retry and non-lag pass-through.
- [x] **3. Receipt Verification (Dual Log Disambiguation)**:
  - [x] Implemented `lib/payment/receipt-verifier.ts` (`verifyArcTransferReceiptLogs`):
    - Disambiguates Arc USDC dual emitters: ERC-20 contract (`0x3600000000000000000000000000000000000000`, 6 decimals) and system emitter (`0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE`, 18 decimals).
    - Filters strictly by emitter address; never matches `topic[0]` alone.
    - Requires exactly 1 matching ERC-20 log.
    - Cross-checks 18-decimal system emitter log without double-counting.
  - [x] Integrated into `app/api/payments/verify-receipt/route.ts`.
  - [x] Created `tests/receipt-dual-log-verification.test.ts` testing all 5 cases: only ERC-20 log, both logs, wrong emitter, wrong amount, wrong recipient.
- [x] **4. Fee Floor & Gas Guard**:
  - [x] Configured `ARC_GAS_CONFIG` with `MIN_MAX_FEE_PER_GAS_WEI = 20_000_000_000n` (20 Gwei floor per `https://docs.arc.io/arc/references/gas-and-fees`).
  - [x] Enforced 20 Gwei `maxFeePerGas` floor in `NonCustodialPaymentModal.tsx` for transfer and anchor proof transactions.
  - [x] Added gas balance validation for Arc native USDC gas with informative warnings.
  - [x] Added clear error guidance when gas is too low.
- [x] **5. Client Bundle Safety Scanner**:
  - [x] Updated allow-list in `scripts/scan-client-bundle.ts` with documented open-source mathematical curve constants from `@noble/curves` (secp256k1 isogeny map coefficients) and viem.
  - [x] Bundle scanner test `tests/client-bundle-safety.test.ts` passing 3/3 tests, including negative leak injection test.
