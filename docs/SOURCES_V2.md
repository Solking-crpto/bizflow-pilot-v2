# Arc Network & Circle V2 Sources and Reference Notes

Compiled on: 15 Oct 2026 for Tameion Agents Hackathon (BizFlow Pilot V2)

## 1. Verified Official Documentation URLs
- **Circle Agent Stack Documentation**: `https://developers.circle.com/agent-stack`
  - Canonical Markdown index: `https://developers.circle.com/agent-stack.md` and `https://developers.circle.com/llms.txt`
  - Covers agent-native tooling, agent wallets, spending limits, x402 nanopayments via Gateway, and Circle Developer-Controlled Wallets (`@circle-fin/developer-controlled-wallets`).
- **Arc Network Official Documentation**: `https://docs.arc.network` / `https://docs.arc.io`
  - Canonical LLM index: `https://docs.arc.io/llms.txt`
  - Osaka EVM baseline notes: Native gas token is USDC (18 decimals for `eth_getBalance`, 6 decimals for ERC-20 `0x3600000000000000000000000000000000000000`).
  - System emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` logs all USDC Transfer events.
  - Sub-second finality.
- **Arc App Kit SDK Send**: `https://docs.arc.network/app-kit/send.md`
  - Single-call transfer pattern:
    ```typescript
    const result = await kit.send({
      from: { adapter, chain: "Arc_Testnet" },
      to: "RECIPIENT_ADDRESS",
      amount: "1.00",
      token: "USDC",
    });
    ```
  - App Kit integration guidelines and adapter architecture for multi-provider settlement.

## 2. Circle Wallets SDK & Agent Stack
- Package: `@circle-fin/developer-controlled-wallets`
- Blockchain identifiers:
  - Testnet: `"ARC-TESTNET"`
  - Mainnet: `"ARC-MAINNET"` or Direct EVM provider fallback.
- Idempotency: Circle APIs enforce client idempotency keys via UUID v4.

## 3. EVM Architecture Rules
- EVM Target: `paris` compiler target (`evmVersion: "paris"`).
- Solidity `^0.8.20` or compatible, avoids `PUSH0` incompatibility across certain node configurations.
- PolicyVault Contract: Parisian EVM target with atomic daily and per-tx limits.
