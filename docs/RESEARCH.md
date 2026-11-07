# Official-source research

Read on 2026-11-05. Git checkout source is preferred over cached search snippets.

| Source | Finding / source revision |
|---|---|
| [Arena ideas](https://arena.mainnet.romeprotocol.xyz/ideas) | HTTP 200 via PowerShell after web reader failed. Identity Manager is under **EVM and Solana wallets**. It describes an app profile associating wallets after proof of control, and states that the EVM/Solana identities are separate until the app associates them. No idea-specific milestone rubric was present in the server-rendered page. |
| [Application](https://arena.mainnet.romeprotocol.xyz/apps/new?idea=Identity+Manager) | HTTP 200, server-rendered content only says Loading. Authenticated registration fields and milestone requirements not verified; no submission performed. |
| [Rome website](https://rome.builders/) | HTTP 200 via direct request. Consulted as product context; implementation facts come from docs and source. |
| [Docs](https://docs.rome.builders/) | Read index, Hadrian, deployment, call-EVM-from-Solana, dual-lane app, precompiles. Current guides recommend submitRomeTxV1, explain legacy DoTxUnsigned and its runtime-derived sender, and require receipt status checks on relayed calls. |
| [Official organization](https://github.com/rome-protocol) | Verified official repositories and current reference projects. |
| [Starter](https://github.com/rome-protocol/create-rome-app) | `8b140105224e418ad365b66e075a53f1e0fcf4f0`. Executed its bin/create-rome-app.mjs, then moved generated contents into this existing workspace. Original Vault implementation retained in examples/starter. Starter is Vite, not Next.js; migrated only the product UI to Next.js and kept Rome configuration/helpers. |
| [Agent instructions](https://github.com/rome-protocol/create-rome-app/blob/main/template/AGENTS.md) | Current git v3.6 differs from cached web page: prefers submitRomeTxV1, warns Phantom cannot sign v1 on devnet, documents fresh synthetic provisioning, USDC gas and CLI installation pitfalls. Root AGENTS.md is preserved. |
| [SDK](https://github.com/rome-protocol/rome-sdk-ts) | v0.4.0; source `33e904d2d3e546d709834f43c3987311a7ed4f7d`. Verified exports and signatures in src/solana.ts, write.ts, solanaV1.ts. Legacy submitRomeTxSolanaLane auto-provisions; result is `{signature, from}`. It does not return an EVM receipt/hash. |
| [Registry](https://github.com/rome-protocol/rome-registry) | v0.3.0; `db0bf1f331c9b81be62d09f180965a64746b5991`. Current starter pins older v0.2.0; updated to documented v0.3.0 and generated browser projection. Hadrian id, RPC, program, explorer, mint and wrappers all resolved from package. |
| [Solidity SDK](https://github.com/rome-protocol/rome-solidity) | `a5a166c906370c97fd1c8594f16b8f2c96fa95aa`. Read README, precompile surface. No documented arbitrary Ed25519 Solidity verifier used. Identity contract needs no CPI or token wrapper. |
| [CLI](https://github.com/rome-protocol/rome-cli) | v0.12.0. `rome new romeid --chain hadrian` is documented and wraps the same scaffolder. Read core/actions.ts: deployment uses viem deployContract with Rome fee settings; normal writes use SDK. Verified fund/verify/tx command shapes in README. No funding/deploy commands executed. |
| [Aerarium](https://github.com/rome-protocol/aerarium) | `bb6298cfed5752847c15c636771cfb1959042cef`. Solidity core + synthetic sender; inspected Next.js package pins, registry projection and integration notes. |
| [Rome DEX](https://github.com/rome-protocol/rome-dex) | `b754bbd62c6dcb5d5b8b7488752b4f1e85c640b0`. Native Solana core + router reference; not confused with a Phantom-to-Solidity lane. |
| [Rome EVM](https://github.com/rome-protocol/rome-evm) | `d0d91d48178f12944cfd701fe924c6343ace2e0a`. Windows checkout fails on reserved aux.rs path. Used git show/grep on committed objects for README and do_tx_unsigned/ed25519/transaction derivation. Runtime verifies Solana transaction signing; synthetic = low 20 bytes of keccak(pubkey). A legacy transaction hash must not be guessed from the v1 hash algorithm. |

## Installed toolchain

Windows PowerShell; Node v24.14.0; npm 11.9.0; Git 2.53.0.windows.2. Forge absent. Solidity compiled with pinned solc-js 0.8.26, optimizer 200, Paris EVM target to avoid unsupported new opcodes. Local contract execution uses Ganache; its native uWS module does not support this Node ABI and falls back to JavaScript. No public funds or real-wallet secrets were used.

Dependency compatibility: Next.js initially followed Aerarium 15.5.19, then patched to 15.5.29 after npm audit. viem updated from 2.52.0 to 2.57.16. Exact versions and git commit resolutions are recorded in package-lock.json. Remaining dependency advisories are documented in SECURITY.md, not suppressed by audit fix --force.

## Verified funding facts

Hadrian is a public testnet; native EVM gas is USDC with 18 decimal accounting. Solana devnet USDC is SPL with 6 decimals. No Rome faucet. Current [Hadrian guide](https://docs.rome.builders/networks/hadrian.md) links Circle test USDC and Solana devnet SOL faucets. Current CLI documents `rome fund hadrian --from sepolia --amount 1` (also base-sepolia examples). It signs/bridges and requires separate approval; never use mainnet funds. Identity operations do not transfer SPL assets and do not need wrapper allowances.
