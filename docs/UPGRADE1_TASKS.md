# BizFlow Pilot V2 — Upgrade 1: Delivery Proof & Payment Conditions Task List

Branch: `upgrade-1-verification`

- [x] **Phase 1: Data Model & Testnet Database Migration**
  - [x] Update `prisma/schema.prisma` with additive models: `DeliveryRequest`, `EvidenceFile`, `VerificationSubmission`, `ConditionTemplate`, `VerificationReport`, `Notification`
  - [x] Add optional `deliveryProofMode` to `Invoice` and `Organization`
  - [x] Run `scripts/db-push-network.ps1 -Network testnet` (Applied to `v2_testnet` schema)
  - [x] Verify Prisma Client generation (`npx prisma generate`)

- [x] **Phase 2: Database Security Hardening (RLS)**
  - [x] Create `scripts/secure-schemas.sql` (enables RLS on all tables in `v2_testnet` and `v2_mainnet`, revokes anon/authenticated)
  - [x] Create `scripts/secure-schemas.ps1` (safe PowerShell runner for testnet schema)
  - [x] Add `tests/rls.test.ts` (read-only assertion that RLS is enabled for all tables in `v2_testnet`)
  - [x] Update `scripts/scan-client-bundle.ts` to scan for `sb_secret_` and `service_role`

- [x] **Phase 3: Storage Provider & File Verification**
  - [x] Install `@supabase/supabase-js` and verify version accepts `sb_secret_`
  - [x] Implement `lib/storage/types.ts` (`StorageProvider` interface)
  - [x] Implement `lib/storage/supabase.ts` (private bucket check, signed upload/download URLs, network isolation)
  - [x] Implement `lib/storage/local.ts` (dev-only fallback, forbidden in production)
  - [x] Implement `lib/storage/validator.ts` (magic bytes, size limits, SHA-256 calculation, executable rejection)

- [x] **Phase 4: Token Security, Access Codes & Link Management**
  - [x] Implement `lib/verification/security.ts` (32-byte token SHA-256 hash, 6-char access code hash, lockout logic, constant-time compare)
  - [x] Implement rate limiting and lockout state (5 failed attempts -> 30m lock)
  - [x] Integrate session cookie for validated verifier sessions

- [x] **Phase 5: Conditions Engine**
  - [x] Implement `lib/verification/conditions.ts` (pure functional evaluator: `evaluate(inputs, rules)`)
  - [x] Implement all 10 rule evaluators (`min_files`, `required_kinds`, `quantities_match`, `delivery_window`, `verifier_identified`, `challenge_code_visible`, `no_duplicate_evidence`, `ai_matches_po`, `invoice_matches_po`, `owner_approval_above_amount`)
  - [x] Write exhaustive truth table unit tests in `tests/conditions.test.ts`

- [x] **Phase 6: AI Evidence Assessment**
  - [x] Implement `lib/verification/ai.ts` (Zod structured output, provider-agnostic, prompt isolation)
  - [x] Implement daily rate limit budget (`LLM_DAILY_CALL_LIMIT`)
  - [x] Enforce "AI-assisted, may be wrong" disclaimer

- [x] **Phase 7: Owner UI & Management APIs**
  - [x] Implement `/api/delivery-proof/request` (create link, access code, challenge code, WhatsApp share links, email draft)
  - [x] Implement `/api/delivery-proof/[id]` and decision endpoints (approve, reject, request more evidence, revoke, regenerate)
  - [x] Build "Request delivery proof" modal on PO & Invoice pages
  - [x] Build Evidence & Report inspection view (PO vs Verifier vs AI side-by-side, signed preview URLs)
  - [x] Add payment readiness badge to Invoices and Payment Desk

- [ ] **Phase 8: Mobile-First Verifier Portal (`/verify-delivery/[token]`)**
  - [ ] Build `/verify-delivery/[token]` page with 390px mobile responsiveness
  - [ ] Access code verification form with lockout protection
  - [ ] Order summary (no confidential pricing or org secrets) & challenge code instruction
  - [ ] Privacy consent notice (photos/contact only, no location, no ID docs)
  - [ ] Direct-to-storage signed file upload with progress bar
  - [ ] Client-side canvas video keyframe extractor
  - [ ] Confirmation and single-submission handling

- [ ] **Phase 9: Payment Gating Policy & Audit Integration**
  - [ ] Add `RULE_DELIVERY_VERIFICATION` to Policy Engine (`lib/policy/engine.ts`)
  - [ ] Add owner override with logged reason
  - [ ] Ensure `deliveryProofMode: "off"` invoices remain 100% unaffected (regression proof)
  - [ ] Record all verification lifecycle events into SHA-256 hash-chained audit ledger

- [ ] **Phase 10: In-App Notifications & Retention Cleanup**
  - [ ] Build Notification model & top nav bell with unread count
  - [ ] Build `/notifications` page
  - [ ] Build `/api/cron/cleanup` daily retention cleanup route (`EVIDENCE_RETENTION_DAYS`, `CRON_SECRET`)
  - [ ] Update Privacy page with retention and deletion terms

- [ ] **Phase 11: Testing, Verification & Final Report**
  - [ ] Run unit tests: `npm test`
  - [ ] Run Playwright tests: `npm run test:e2e` with mobile 390px screenshots in `docs/qa-part1/`
  - [ ] Run client bundle scan: `npm run scan:bundle`
  - [ ] Run Next.js build: `npm run build`
  - [ ] Generate comprehensive final report
