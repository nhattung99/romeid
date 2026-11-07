# Hadrian deployment and Vercel preparation

**Hadrian deployment verified on 2026-11-07.** The transaction used MetaMask through the local deployment page. The receipt and creation bytecode match the compiled contract. Identity #1 completed the MetaMask and Phantom browser walkthrough.

## Before approval

Run `npm ci`, `npm run compile`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Review docs/SECURITY.md and dependency audit. Establish a clean Git commit with no secrets; the script records null if none exists. Have the user approve the exact testnet deployment/signing budget before providing credentials locally. Never request a seed phrase or key in chat.

## Funding (separate approval)

Use current [Hadrian instructions](https://docs.rome.builders/networks/hadrian.md). EVM wallet needs test USDC bridged to Hadrian gas; Solana wallet needs devnet SOL and appropriate devnet USDC. There is no Rome faucet. The [CLI](https://github.com/rome-protocol/rome-cli) documents a pinned one-shot entry:

```text
npx github:rome-protocol/rome-cli#v0.12.0 facts chain hadrian
npx github:rome-protocol/rome-cli#v0.12.0 fund hadrian --from sepolia --amount 1
```

The first command is read-only. The second signs/bridges: do not run without explicit approval. Confirm source/destination are testnets. No mainnet funding, real funds or automatic bridging. Fees/rent vary; do not promise a fixed sufficient budget.

## Deploy only after user approves

Copy `.env.example` to `.env` locally. Supply an isolated testnet key through a secure local environment; never commit it. Set `ALLOW_TESTNET_SPEND=I_APPROVE_HADRIAN_DEPLOYMENT`, set `ROME_DEPLOY_MAX_USDC` to the approved fee ceiling, then run `npm run deploy`. The script uses the live deployment gas estimate and a fee cap of 1.5× the current gas price. It stops before signing if the resulting ceiling exceeds the approved amount or the wallet balance. Deployment uses viem deployContract; deployments are the documented exception to SDK app writes. All user contract mutations use Rome SDK submission. Compiler uses Paris EVM target and solc 0.8.26.

The script refuses a mismatching chain, requires a successful receipt/address, and writes deployments/hadrian.json with actual address/hash/block/timestamp/commit. Timestamp is recording time, not a fabricated block timestamp. Reset/remove ALLOW_TESTNET_SPEND after use. Set `NEXT_PUBLIC_IDENTITY_ADDRESS` to the actual address and rebuild. Run `npm run verify` for a read-only chain/code presence check. Review actual deployed bytecode independently.

## Real both-lane proof

After separate approval for all smoke writes, use fresh funded test wallets, `ROME_EVM_KEY`, and `ROME_SOLANA_KEY` (local JSON secret-key array), and set `ALLOW_TESTNET_SPEND=I_APPROVE_HADRIAN_DUAL_LANE_SMOKE`. `npm run demo` checks whether the Solana sender needs provisioning, then executes create → EVM proposal → Solana acceptance → Solana update → EVM read → EVM unlink against the configured contract. The script uses `submitRomeTxV1` on the Solana lane, requires a successful Rome receipt and records the Rome hash and Solana signature when returned. It stops on atomic composition failure. The composer still receives the signed authorization, which it can use within the signed fee limits. Evidence and failures are saved in deployments/dual-lane-evidence.json. A passing run covers SDK key signers. Browser MetaMask/Phantom testing is a separate step. The inherited Vault demo in examples/starter covers a different contract.

Then repeat the browser script in ARENA_SUBMISSION.md with actual MetaMask and Phantom. Verify fresh synthetic provisioning and inspect failed/denied signatures. Map each actual EVM hash with `rome tx hadrian <hash>` / `rome_solanaTxForEvmTx`. Legacy Solana SDK responses have no Rome hash; retain the actual Solana explorer evidence and mark unmapped fields TODO.

## Vercel production demo

Framework: Next.js. Root: repository root. Install: `npm ci`. Build: `npm run build`. Standard Node.js runtime compatible with Next 15 (local verification used Node 24). Set only `NEXT_PUBLIC_IDENTITY_ADDRESS` to the actual deployment; Hadrian infrastructure is generated from the pinned registry. Never put ROME_EVM_KEY, ROME_SOLANA_KEY or ALLOW_TESTNET_SPEND into Vercel. No application backend/private key is required. Public address configuration is generated at build time; rebuild after changing it. Publication requires separate explicit user approval.

| Deployment field | Value |
|---|---|
| Chain | Rome Hadrian (registry) |
| Chain ID | 200010 (registry-resolved) |
| Contract address | `0xa0327391255c62be291b84caed99e4b82e69dfeb` |
| Deploy hash / explorer | [0x2566717e…42de68a](https://via-hadrian.testnet.romeprotocol.xyz/tx/0x2566717e6dad7f81f2e1eb46d98a5b45af00792c53cddb057f4d50a4042de68a) |
| Deployment UTC timestamp | 2026-11-07 03:43:05 UTC |
| Actual gas fee | 11.99551750331449977 USDC testnet |
| Git commit | TODO — workspace was not a Git repository at initialization |
| Live frontend URL | [romeid-green.vercel.app](https://romeid-green.vercel.app/) |
| Frontend source revision | [`f79ec32`](https://github.com/nhattung99/romeid/commit/f79ec32) |
| Real lane evidence | [Verified browser walkthrough](ARENA_SUBMISSION.md) |
