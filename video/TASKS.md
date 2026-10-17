# BizFlow Pilot V2 — Professional Demo Video Production Checklist

## Hard Rules & Constraints
- [x] Work strictly within workspace, `video/`, and `video-out/`. App code untouched.
- [x] `.env.video.local` verified (API key present, never logged or printed).
- [x] `.gitignore` updated with `*.mp4, *.mov, *.mkv, *.mp3, *.wav, video/raw/, video/audio/, video/cache/, video/assets/generated/, video-out/`.
- [x] Zero fabricated evidence / zero simulated wallet transactions or confirmations.
- [x] Supported claims only; honest variants selected.

## Phase 0 — Tooling & Inspection
- [x] Check tools: `node` (v26.9.0), `ffmpeg` (Gyan build), `ffprobe` (Gyan build).
- [x] Copy source screen recordings (`BizFlow!.mp4` through `BizFlow8.mp4`) into `video/raw/`.
- [x] Probe all raw clips (resolutions, durations, fps, codecs).
- [x] Extract frames (first, every 2s, last) into `video/cache/frames/`.
- [x] Visual inspection and clip-to-scene mapping:
  - **Scene 0** (Title card): Generated vector motion graphics (`video/assets/logo-mark.svg`, Ink-Navy gradient).
  - **Scene 1** (Home, switch, banner, guide): `BizFlow2.mp4` / `BizFlow!.mp4` (Duration: 18.03s / 13.63s) — Confidence: 100%. Shows TESTNET/MAINNET switch, banner, Judge Guide.
  - **Scene 2** (Connect wallet, onboarding, limits): `BizFlow3.mp4` (Duration: 22.74s) — Confidence: 100%. Shows authenticated wallet, Delency Electronics onboarding, setting 0.50/5.00/2.00 USDC limits.
  - **Scene 3** (Orders, delivery, invoices): `BizFlow4.mp4` (Duration: 33.28s) — Confidence: 100%. Shows supplier registration (White Lion Merchant) and purchase order PO-01-02 (Portland Cement, 10 units @ 0.05 = 0.50 USDC). Note: duplicate and injection invoices are not recorded in footage; dropping those sentences per instructions.
  - **Scene 4** (Agent and decision log): `BizFlow5.mp4` (Duration: 20.10s) — Confidence: 100%. Shows AI Finance Agent advisory proposal and Agent Decisions log showing FALLBACK deterministic-heuristics with reasoning.
  - **Scene 5** (Payment desk): `BizFlow6.mp4` (Duration: 9.97s) + Motion Graphic Illustration (4-step flow) — Confidence: 100%. Uses Narration Version B.
  - **Scene 6** (Ledger, tamper-evident hash chain): `BizFlow7.mp4` (Duration: 26.82s) — Confidence: 100%. Shows Trust & Audit Ledger, 100% Intact verification, Genesis block. Uses variant narration (ledger verification without public passport navigation).
  - **Scene 7** (Mainnet switch, beta cap, end): `BizFlow8.mp4` (Duration: 24.04s) + Generated End Card — Confidence: 100%. Shows Mainnet switch and 25 USDC beta cap warning banner.
- [x] Privacy scan: Checked all extracted frames. No passwords, private keys, personal emails, or bookmarks visible.
- [x] Normalize raw clips to 1920x1080 @ 30fps CFR (no audio, letterbox with Ink `#0B1F33`).

## Phase 1 — Narration Script & Claims Audit
- [x] Finalize exact script text with phonetic spacing ("A I", "U S D C") for TTS, standard for captions:
  - **Scene 0**: "Paying suppliers is risky: duplicate invoices, wrong wallets, and now A I agents that can be tricked by hidden text. BizFlow Pilot checks first, so the owner pays with confidence."
  - **Scene 1**: "This is BizFlow Pilot V2, built on Arc. One app, one switch. Testnet is free practice with test U S D C. Mainnet is real money. Anyone can try it free before risking anything."
  - **Scene 2**: "A business signs in with its own wallet. The signature is free and moves no money. BizFlow never holds funds or keys. Then the owner sets personal limits and adds a supplier."
  - **Scene 3** (Honest cut): "Next, the order and the delivery. When an invoice arrives, BizFlow matches all three. BizFlow treats invoice text as untrusted, flags it, and it never reaches payment." (Duplicate blocked & hidden instruction sentences dropped as not visible in footage).
  - **Scene 4**: "The agent ranks what to pay and when, and explains why. It can only recommend. Every decision is logged with its reasoning, and whether a model or the fallback rules made it."
  - **Scene 5** (Version B): "To pay, fixed rules must approve. Then the owner signs in their own wallet. Only after the server checks the blockchain receipt, the right token, the right recipient and the exact amount, is a payment marked settled."
  - **Scene 6** (Supported variant): "Every step goes into a tamper-evident ledger, and the owner can verify the chain at any time."
  - **Scene 7**: "This is an early beta, capped at 25 U S D C per payment, built solo, and looking for its first pilot businesses. Try it free on testnet at bizflow-pilot-v2 dot vercel dot app."
- [x] Write `video-out/claims-audit.md`.

## Phase 2 — ElevenLabs Narration Generation
- [x] Implement `video/scripts/generate-narration.js` calling ElevenLabs TTS API.
- [x] Use voice `uH7gCqB801c6y7oEmaew` and model `eleven_multilingual_v2`.
- [x] Cache audio clips in `video/cache/audio/`.
- [x] Post-process audio: silence trimming, 150ms head / 350ms tail, loudnorm (-16 LUFS, true peak < -1.5 dB).
- [x] Pronunciation check and duration validation.

## Phase 3 — Video Timeline & Matching
- [x] Compute durations $T = A + 0.5\text{s}$ per scene.
- [x] Normalize and adjust video pacing (remove static idle stretches, speed up / slow down within allowed bounds).
- [x] Ensure total timeline is $\le 175$ seconds (Actual: 86.67 seconds).

## Phase 4 — Scene 5 Motion Graphic Illustration
- [x] Build 4-step motion graphic illustration vector: "How a payment is checked".
- [x] Watermark corner label: "Illustration, not a recording".
- [x] Combine with real 9.97s footage of payment modal and policy 10/10 screen.

## Phase 5 — Visual Design & Composition
- [x] Title Card (Scene 0): Ink-to-Navy gradient `#0B1F33` -> `#12355B`, logo mark, typography.
- [x] End Card (Scene 7): Logo, live URL, repo URL, beta disclosures.
- [x] Lower-thirds (36px, 96px safe margins) for all scenes.
- [x] Teal `#0E9F8E` callouts with soft glow.
- [x] Burned-in captions + `captions.srt`.

## Phase 6 — Render & Outputs
- [x] Render `video-out/BizFlow-Pilot-V2-Demo.mp4` (1920x1080, 30fps, H.264, AAC 192k 48kHz, +faststart).
- [x] Generate `video-out/thumbnail.png` (1280x720).
- [x] Generate `video-out/contact-sheet.png`.
- [x] Generate `video-out/qa-report.md`.
- [x] Generate `video-out/claims-audit.md`.

## Phase 7 — Quality Gates Verification
- [x] ffprobe check: 1920x1080, 30fps, $\le 175$s, audio present, $< 100$MB.
- [x] Visual verification of scene stills.
- [x] Privacy scan verification.
- [x] Audio loudness check (-16 LUFS, true peak < -1.5 dB).
- [x] Claims audit completeness.
