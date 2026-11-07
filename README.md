# RomeID — Cross-VM Identity Manager

[Live Hadrian demo](https://romeid-green.vercel.app/) · [Arena submission evidence](docs/ARENA_SUBMISSION.md)

**One identity, two wallets, one shared on-chain state.**

Local Next.js MVP for Rome Hadrian. One Solidity contract owns profiles and wallet relationships. MetaMask writes use `submitRomeTx`; Phantom uses the documented legacy `submitRomeTxSolanaLane`. Infrastructure comes from `@rome-protocol/registry` at build time.

**Contract deployed on Hadrian.** Identity #1 completed the MetaMask and Phantom browser walkthrough using the legacy Solana lane. Arena submission is pending. Current Rome guidance recommends the v1 Solana lane and warns that Phantom cannot sign v1 on devnet. See [deployment](deployments/hadrian.json), [transaction evidence](docs/ARENA_SUBMISSION.md) and [security](docs/SECURITY.md).

## Run locally

Node 24.14.0 and npm 11.9.0 were used. No secrets or funded wallet are required for local UI/tests.

```text
npm ci
npm run compile
npm run dev
```

Open the URL printed by Next.js. With no `NEXT_PUBLIC_IDENTITY_ADDRESS`, the UI clearly shows an undeployed state and disables all contract writes. Wallet connection and contextual possession signatures are implemented but require actual browser extensions. Nothing fabricates profiles, statistics or transaction success.

```text
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

`npm test` executes Solidity bytecode on a local Ganache EVM and verifies actual EIP-191/Ed25519 cryptography. It is **not** an on-chain Rome integration test. Ganache's uWS native module falls back to JavaScript on Node 24. The test adapter normalizes Ganache RPC error codes and maps viem's wallet transaction method to its supported local equivalent; this adapter is never used for Rome app writes.

## Features and authorization

- Landing, dashboard, create, wallet linking, public explorer, settings and about routes; responsive light dashboard and copy/explorer helpers.
- Unique identity ID, public metadata URI, canonical EVM/Solana keys, global duplicate prevention and events.
- Owner proposes a nonce/expiry-bound wallet link. Target wallet accepts from its authenticated Rome sender. A Solana public key is never treated as an EVM address.
- Linked wallets may update the profile and remove themselves. Owner manages membership, guardian and ownership transfer.
- Two-step ownership transfer; accepted guardian with two-day recovery delay and owner cancellation. Ownership changes revoke all previous wallets and stale pending offers.
- Local contextual signatures include origin, chain, contract, identity, wallet, action, nonce, expiry and binding context. They do not replace on-chain wallet authorization or create a server login.
- SDK-native submission, EVM receipt checks, legacy Solana confirmation plus expected-state polling, retained real transaction evidence and explicit unmapped-hash state.

No backend signing key, server attestation, token custody or arbitrary off-chain identity authority. Contract functions make no external calls. This is not an audited production identity system.

## Layout

```text
app/                    Next.js App Router and Tailwind styles
components/             Wallet state, dashboard and seven product views
lib/rome/               Registry browser projection, ABI, SDK transactions/reads
lib/wallets/            MetaMask and Phantom adapters and canonical wallet keys
lib/auth/               Contextual EIP-191 and Ed25519 possession checks
contracts/              RomeIdentityManager.sol; inherited Vault.sol
scripts/                Compile, config, gated deployment / both-lane smoke
tests/                  Local EVM and cryptographic tests
docs/                   Plan, security, research, deployment, submission, evidence
examples/starter/       Original official Vite Vault scaffold (independent example)
```

The official scaffolder was executed locally. Its Vault implementation is preserved; root product frontend migrated from Vite to Next.js using Aerarium's documented structure as reference. Original root Vault helpers/scripts remain for traceability; they are not identity test evidence. The product scripts target RomeID. Pinned source revisions are in [RESEARCH.md](docs/RESEARCH.md).

## Deployment and evidence

Follow [DEPLOYMENT.md](docs/DEPLOYMENT.md). Deployment, funding, bridging, all real wallet signing, GitHub publication and Vercel publication require explicit user approval. Never share a seed phrase or private key in chat. `.env.example` contains placeholders; `.env*` secrets are ignored.

`npm run verify` is read-only contract/chain preflight. `npm run demo` is a gated **real Hadrian** SDK smoke harness, never part of local tests/build. It requires fresh funded keys and records actual evidence. It does not prove browser-extension compatibility. Hadrian gas is USDC; Solana settlement also requires SOL. There is no Rome faucet.

Vercel is prepared as a standard Next.js project: `npm ci`, `npm run build`, public identity address only. No private keys belong on Vercel. Review the remaining dependency advisories before public release; the project does not claim a clean audit.

See [TEST_REPORT.md](docs/TEST_REPORT.md), [ARENA_SUBMISSION.md](docs/ARENA_SUBMISSION.md) and the [Hadrian profile screenshot](docs/screenshots/hadrian-identity-1-after-phantom-update.png).
