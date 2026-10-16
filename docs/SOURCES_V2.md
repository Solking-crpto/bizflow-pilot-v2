# Arc Network & Circle V2 Documentation Citations & References

**Compiled**: October 2026 for Tameion Agents Hackathon (BizFlow Pilot V2)  
**Standard**: Verified Official Documentation Citations & Technical Integration Notes

---

## 1. Arc Network Official Documentation

### Primary Documentation & LLM References
- **Official Documentation**: [https://docs.arc.network](https://docs.arc.network) and [https://docs.arc.io](https://docs.arc.io)
- **Canonical LLM Index**: `https://docs.arc.io/llms.txt`

### Arc EVM Architecture Specifications
- **Chain Identifiers**:
  - Arc Mainnet: `5042` (`0x13B2`)
  - Arc Testnet: `5042002` (`0x4CEF52`)
- **Native Gas Token**: USDC
  - For standard EVM gas accounting and `eth_getBalance`, USDC is represented with **18 decimals** (native gas asset).
  - For standard ERC-20 token interactions, USDC uses the system contract at address `0x3600000000000000000000000000000000000000` with **6 decimals**.
- **System Emitter & Event Logging**:
  - System emitter address: `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` logs all native USDC Transfer events.
  - Sub-second block finality.
- **EVM Compiler Target**:
  - Smart contracts must be compiled with `paris` EVM target (`evmVersion: "paris"`).
  - Target ensures complete compatibility by avoiding the `PUSH0` opcode (introduced in Shanghai), which is rejected by certain Arc node RPCs.
  - Applied to `AuditAnchor.sol` and `PolicyVault.sol` in `hardhat.config.js` and `scripts/compileContracts.js`.

### Arc App Kit SDK & Send Provider
- **App Kit Documentation**: [https://docs.arc.network/app-kit](https://docs.arc.network/app-kit)
- **App Kit Send Provider Spec**: [https://docs.arc.network/app-kit/send.md](https://docs.arc.network/app-kit/send.md)
- **Single-Call Transfer Pattern**:
  ```typescript
  const result = await kit.send({
    from: { adapter, chain: "Arc_Testnet" },
    to: "RECIPIENT_ADDRESS",
    amount: "1.00",
    token: "USDC",
  });
  ```
- **Implementation in BizFlow**:
  - Integrated via `lib/payments/appKitProvider.ts` as an extensible adapter.
  - Feature-gated via `ENABLE_APP_KIT_SEND` (defaults to false on Mainnet in favor of direct Viem EOA signing or non-custodial browser wallet signing).

---

## 2. Circle Developer Agent Stack & Wallets

### Primary Documentation & LLM References
- **Circle Agent Stack Documentation**: [https://developers.circle.com/agent-stack](https://developers.circle.com/agent-stack)
- **Canonical Markdown Index**: [https://developers.circle.com/agent-stack.md](https://developers.circle.com/agent-stack.md)
- **LLM Context Index**: [https://developers.circle.com/llms.txt](https://developers.circle.com/llms.txt)

### Circle Developer-Controlled Wallets SDK
- **Package**: `@circle-fin/developer-controlled-wallets` (v1.x)
- **Architecture**:
  - Entity Secret 32-byte hexadecimal ciphertext registration.
  - Wallet Sets and Wallets provisioning.
  - Blockchain identifier: `"ARC-TESTNET"` on Circle Testnet sandbox.
- **Idempotency Standards**:
  - Circle APIs require client-generated UUID v4 idempotency keys (`idempotencyKey`) on all transfer requests to eliminate double-spend risks.
- **Implementation in BizFlow**:
  - Implemented in `lib/payments/circleWallets.ts`.
  - Used for automated testnet staging and builder-controlled sandboxing (`PUBLIC_SANDBOX=true` on testnet only).
  - Guaranteed refusal on Mainnet via `assertValidSandboxMode()`.

---

## 3. Web3 & Cryptographic Standards

### EIP-191 & Sign-In With Ethereum (SIWE)
- **Standards**: EIP-191 (Signed Data Standard) and EIP-4361 (Sign-In with Ethereum).
- **Viem Implementation**:
  - Verification: `verifyMessage({ address, message, signature })` from `viem`.
  - Used in `app/api/auth/verify/route.ts` with 5-minute single-use cryptographically random nonces.
  - Secure session storage via HMAC-SHA256 authenticated cookies (`SESSION_SECRET`).

### EIP-6963 Multi-Injected Provider Discovery
- **Standard**: EIP-6963 (Multi-Injected Provider Discovery).
- **Specification**: `https://eips.ethereum.org/EIPS/eip-6963`
- **Purpose**: Eliminates wallet extension conflicts where multiple Web3 extensions (MetaMask, Rabby, Coinbase, Phantom) overwrite `window.ethereum`.
- **Implementation**:
  - `lib/auth/eip6963.ts`: listens for `eip6963:announceProvider` and dispatches `eip6963:requestProvider`.
  - MetaMask sorted first; saved selection persisted in `localStorage`.
  - Synchronous `eth_requestAccounts` execution in the user click handler ensures browser popups are never blocked by Chrome.

---

## 4. Official Arc Documentation Endpoints & Specifications (docs.arc.io)

### RPC Endpoints & Multi-Provider Architecture
- **Reference**: [https://docs.arc.io/arc/references/rpc-endpoints](https://docs.arc.io/arc/references/rpc-endpoints)
- **Primary Circle Endpoints**:
  - Mainnet: `https://rpc.mainnet.arc.io` (anonymous, open CORS)
  - Testnet: `https://rpc.testnet.arc.io` (replaces outdated `rpc.testnet.arc.network`)
- **Block Explorers**:
  - Mainnet: `https://explorer.arc.io`
  - Testnet: `https://explorer.testnet.arc.io`
- **Server-Side Fallback Providers**:
  - Blockdaemon (`rpc.blockdaemon.mainnet.arc.io` / `rpc.blockdaemon.testnet.arc.io`)
  - dRPC (`rpc.drpc.mainnet.arc.io` / `rpc.drpc.testnet.arc.io`)
  - QuickNode (`rpc.quicknode.mainnet.arc.io` / `rpc.quicknode.testnet.arc.io`)
- **Error Code -32014 & Load Balancer Lag**:
  - Caused when load-balanced backends serve requests at slightly different block heights.
  - Resolved via `withRpcRetry()` with exponential backoff (200ms initial, factor 2).

### Wallet Add Chain Parameters (Connect to Arc)
- **Reference**: [https://docs.arc.io/arc/references/connect-to-arc](https://docs.arc.io/arc/references/connect-to-arc)
- **Chain Parameters**:
  - Mainnet: Chain ID `5042` (`0x13B2`), Chain Name `"Arc"`, `nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }`.
  - Testnet: Chain ID `5042002` (`0x4CEF52`), Chain Name `"Arc Testnet"`, `nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }`.
  - **Decimals Notice**: Arc's `wallet_addEthereumChain` explicitly specifies **18 decimals** for native USDC gas accounting.

### Gas & Fee Specifications (20 Gwei Floor)
- **Reference**: [https://docs.arc.io/arc/references/gas-and-fees](https://docs.arc.io/arc/references/gas-and-fees)
- **Mempool Invariant**:
  - Arc enforces a **20 Gwei** `maxFeePerGas` floor.
  - Transactions submitted below 20 Gwei fail with: `"transaction underpriced: maxFeePerGas is lower than the 20 Gwei minimum base fee floor"`.
  - Enforced in `lib/networks.ts` (`ARC_GAS_CONFIG`) and client payments (`NonCustodialPaymentModal.tsx`).

### Dual-Log Receipt Verification (Arc EVM Differences)
- **Reference**: [https://docs.arc.io/arc/references/evm-differences](https://docs.arc.io/arc/references/evm-differences)
- **EVM Differences Invariant**:
  - ERC-20 `transfer()` on native USDC emits Transfer events from:
    1. ERC-20 contract (`0x3600000000000000000000000000000000000000`, 6 decimals)
    2. System emitter (`0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE`, 18 decimals)
  - Verified via `verifyArcTransferReceiptLogs()` in `lib/payment/receipt-verifier.ts`:
    - Emitter address filtering strictly applied (never matches `topic[0]` alone).
    - Requires exactly 1 matching ERC-20 log.
    - System log (18 decimals) cross-checked and never counted as the ERC-20 log.
