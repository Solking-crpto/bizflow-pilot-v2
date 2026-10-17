# Arc Network & Circle Documentation Sources

Compiled on: 12 Oct 2026

## 1. Arc Network Core Parameters

| Parameter | Arc Mainnet | Arc Testnet | Source / Verification |
|---|---|---|---|
| **Chain ID** | `5042` (`0x13b2`) | `5042002` (`0x4cef52`) | Arc official docs (`docs.arc.network`, Chainlist) |
| **Native Gas Token** | USDC (18 decimals for native `eth_getBalance`) | USDC (18 decimals for native `eth_getBalance`) | Arc native stablecoin architecture specs |
| **ERC-20 System Contract** | `0x3600000000000000000000000000000000000000` (6 decimals) | `0x3600000000000000000000000000000000000000` (6 decimals) | Arc docs & LabLab developer guides |
| **Primary RPC URL** | `https://rpc.mainnet.arc.io` | `https://rpc.testnet.arc.io` | Arc official documentation |
| **Fallback RPC URLs** | `https://rpc.arc.network` | `https://rpc.testnet.arc.io` | Arc developer community / solidrpc |
| **Block Explorer** | `https://explorer.arc.io` | `https://testnet.arcscan.app` | Arc official explorer index |
| **Faucet** | Bridge via Circle CCTP or direct point of contact | `https://faucet.circle.com` | Circle Faucet |

## 2. Circle Developer-Controlled Wallets

* **SDK Package:** `@circle-fin/developer-controlled-wallets`
* **Supported Blockchain Identifiers:**
  * Testnet: `"ARC-TESTNET"` (verified in Circle Developer documentation)
  * Mainnet: Unconfirmed in public docs. To be supplied via `CIRCLE_ARC_MAINNET_BLOCKCHAIN` if assigned; otherwise, the app automatically relies on the battle-tested `DirectEvmProvider` (viem EOA with server-only key).
* **Account Types:** Externally Owned Accounts (EOA) and Smart Contract Accounts (SCA). EOA is used for direct token transfers.

## 3. Decimal Trap Mitigation

* Native gas queries via `eth_getBalance` return atomic units scaled to **18 decimals**.
* ERC-20 token queries (`balanceOf`, `transfer`, `Transfer` events) on contract `0x3600000000000000000000000000000000000000` use **6 decimals**.
* **BizFlow Pilot Standard:** All application logic stores and transfers money using `UsdcAtomic` (bigint 6 decimals, e.g. 1 USDC = 1,000,000 atomic units). Gas checks explicitly use `NativeGasAtomic` (bigint 18 decimals). Any conversions must pass through strictly typed helper functions in `lib/money.ts`.

## 4. EVM Compiler Compatibility

* EVM Target: `paris` (`evmVersion: "paris"`).
* Avoids the `PUSH0` opcode introduced in Shanghai, which has known incompatibilities with certain Arc testnet nodes and Circle infrastructure.
