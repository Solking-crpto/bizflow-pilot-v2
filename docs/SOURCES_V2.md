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
  - Arc Testnet: `5042002` (`0x4CECE2`)
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

### Non-Custodial Browser Interaction (EIP-1193)
- **Standards**: EIP-1193 (Ethereum Provider JavaScript API).
- **Network Switching**:
  - Automated detection and switching via `wallet_switchEthereumChain` and `wallet_addEthereumChain` using parameters configured centrally in `lib/networks.ts`.
- **Client Execution**:
  - Viem `createWalletClient({ transport: custom(window.ethereum) })`.
  - Non-custodial ERC-20 `transfer` and `AuditAnchor.commitAnchor` transactions executed entirely client-side.
