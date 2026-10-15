# BizFlow Pilot V2 — Single Project Production Deployment Guide

BizFlow Pilot V2 runs as **one unified Next.js application** on Vercel with runtime network switching between Arc Mainnet (Chain `5042`) and Arc Testnet (Chain `5042002`).

This guide details how to configure a single production deployment with physical database schema separation and end-to-end verification.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │    Single Vercel Deployment (App)    │
                      │  Runtime Switch: TESTNET | MAINNET   │
                      └──────────────────┬───────────────────┘
                                         │
             ┌───────────────────────────┴───────────────────────────┐
             │                                                       │
             ▼                                                       ▼
   [ Arc Mainnet: 5042 ]                                   [ Arc Testnet: 5042002 ]
   • Real USDC ($25 beta cap)                              • Free test USDC ($1,000 cap)
   • PostgreSQL: schema=v2_mainnet                         • PostgreSQL: schema=v2_testnet
   • AuditAnchor.sol (Mainnet)                             • AuditAnchor.sol (Testnet)
   • Server Treasury: Admin only                           • Non-custodial only (No server key)
```

---

## Step 1: PostgreSQL Database Setup (Dual Schema)

BizFlow Pilot V2 enforces physical data isolation across networks using two separate PostgreSQL schemas in your database (e.g. Neon Serverless Postgres or Supabase).

1. Connect to your PostgreSQL database with `psql` or the Neon console.
2. Create the two isolated schemas:
   ```sql
   CREATE SCHEMA IF NOT EXISTS v2_mainnet;
   CREATE SCHEMA IF NOT EXISTS v2_testnet;
   ```
3. Prepare the two connection strings with connection pooling enabled:
   - **Mainnet**: `postgresql://[user]:[password]@[host]/[database]?schema=v2_mainnet&sslmode=require`
   - **Testnet**: `postgresql://[user]:[password]@[host]/[database]?schema=v2_testnet&sslmode=require`

---

## Step 2: Push Prisma Schemas to Both Databases

Run Prisma schema sync separately for each network schema:

```powershell
# 1. Sync Testnet database schema
$env:DATABASE_URL_TESTNET="postgresql://[user]:[password]@[host]/[database]?schema=v2_testnet&sslmode=require"
$env:DATABASE_URL=$env:DATABASE_URL_TESTNET
npx prisma db push

# 2. Sync Mainnet database schema
$env:DATABASE_URL_MAINNET="postgresql://[user]:[password]@[host]/[database]?schema=v2_mainnet&sslmode=require"
$env:DATABASE_URL=$env:DATABASE_URL_MAINNET
npx prisma db push
```

> [!IMPORTANT]
> Never use `--accept-data-loss` or `prisma db push --force-reset` in production environments.

---

## Step 3: Deploy Smart Contracts (Optional / First Deployment)

1. **Arc Testnet AuditAnchor**:
   ```powershell
   npm run deploy:anchor:testnet
   ```
2. **Arc Mainnet AuditAnchor**:
   ```powershell
   npm run deploy:anchor:mainnet -- --yes
   ```

Note the deployed contract addresses and set them in your environment variables.

---

## Step 4: Configure Vercel Project Environment Variables

Create **one single Vercel project** linked to your repository. Add the following environment variables in **Project Settings → Environment Variables**:

| Variable | Scope | Description |
|---|---|---|
| `DEFAULT_NETWORK` | Production, Preview | `"mainnet"` |
| `DATABASE_URL_MAINNET` | Production, Preview | Neon URL containing `schema=v2_mainnet` |
| `DIRECT_URL_MAINNET` | Production, Preview | Direct connection URL with `schema=v2_mainnet` |
| `DATABASE_URL_TESTNET` | Production, Preview | Neon URL containing `schema=v2_testnet` |
| `DIRECT_URL_TESTNET` | Production, Preview | Direct connection URL with `schema=v2_testnet` |
| `SESSION_SECRET` | Production, Preview | Cryptographically random string (min 32 characters) |
| `ADMIN_WALLET_ADDRESS` | Production, Preview | Builder admin EOA address |
| `OWNER_PASSCODE` | Production, Preview | Builder admin operations passcode |
| `CRON_SECRET` | Production, Preview | Secret for Vercel Cron invocation |
| `TREASURY_PRIVATE_KEY` | Production | Builder admin treasury key (Mainnet only) |
| `AUDIT_ANCHOR_ADDRESS` | Production, Preview | Deployed Mainnet `AuditAnchor.sol` address |
| `NEXT_PUBLIC_AUDIT_ANCHOR_ADDRESS` | Production, Preview | Deployed Mainnet `AuditAnchor.sol` address |
| `NEXT_PUBLIC_APP_URL` | Production | Production domain URL (e.g., `https://bizflow-pilot-v2.vercel.app`) |

---

## Step 5: Preflight Checks

Run preflight scripts locally against both targets:

```powershell
# Preflight Arc Testnet
npm run preflight:testnet

# Preflight Arc Mainnet (read-only, zero transactions)
npm run preflight:mainnet
```

Both preflight checks must report `[PASS]` across all checks before going live.

---

## Step 6: Verify Runtime Switch in Production

After deployment to Vercel, verify the runtime experience:

1. **Initial Visit**: Navigate to the production URL. Observe default network is **Mainnet** (or First-Visit choice modal).
2. **TopNav Segmented Switcher**:
   - Click `TESTNET`: Banner turns amber, active network displays `Arc Testnet (5042002)`.
   - Click `MAINNET`: Confirmation modal appears explaining that real USDC will be spent. Confirm switch. Banner updates to navy Mainnet.
3. **Cross-Tab Race Condition Defense**:
   - Open Tab A on Testnet and Tab B on Mainnet.
   - Submitting a mutation on Tab A returns `HTTP 409 Conflict` (`NETWORK_MISMATCH_CONFLICT`), protecting against stale-tab data corruption.
4. **Public Verification Passport**:
   - Visit `/verify/mainnet/[paymentId]` or `/verify/testnet/[paymentId]`.
   - The TopNav switcher on the verify page updates the URL directly to reflect the inspected network.
