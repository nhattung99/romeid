# Rome Arena submission draft

**Not submitted. No claims about rewards, grants, Laurels or airdrops.**

| Field | Draft |
|---|---|
| App name | RomeID |
| Full title | RomeID — Cross-VM Identity Manager |
| Category | EVM and Solana wallets |
| Idea | Identity Manager |
| Tagline | One identity, two wallets, one shared on-chain state. |
| Description | RomeID is a cross-VM identity manager built on Rome Protocol, allowing EVM and Solana users to link verified wallets to a shared on-chain profile and manage their identity from either wallet lane. |
| GitHub repository | TODO — no repository published |
| Live demo | TODO — no public deployment |
| Contract address | `0xa0327391255c62be291b84caed99e4b82e69dfeb` |
| Chain | Rome Hadrian, registry-resolved chain ID 200010 |
| Deployment hash | [0x2566717e…42de68a](https://via-hadrian.testnet.romeprotocol.xyz/tx/0x2566717e6dad7f81f2e1eb46d98a5b45af00792c53cddb057f4d50a4042de68a) |
| EVM create identity | [Identity #1 creation](https://via-hadrian.testnet.romeprotocol.xyz/tx/0xcaf5796e548abec9a2f4beab0466a1c679bc0749933d996331fd8dfa1d5b76f7) |
| EVM propose link | [Identity #1 proposal](https://via-hadrian.testnet.romeprotocol.xyz/tx/0x31540c58cb8b177389900a28c2c9b028046f413acc2071a67847b369f97d8fab), [Solana Devnet settlement](https://explorer.solana.com/tx/AupbxhVxRNfLjSrC7pQTpZCqU1muoHUDyD8J2gXw435XHjnjBRPDUNpmqpDUwD8Apxdhoq1ACKxcCARQnXzgx1X?cluster=devnet). Offer nonce 1, expiry 2026-11-07 05:04:36 UTC. |
| Solana accept link | [Phantom acceptance on Solana Devnet](https://explorer.solana.com/tx/375fAdmXga1tMoqx6Kyv5oNKs6wpS8Sa3aYZMjVXWgVawg7WcZxfnUT6unDSuhkD6D1Afw1f2JYxRwvwQSzb5DFG?cluster=devnet). Rome state verified two linked wallets and offer consumption for Identity #1. |
| Solana update profile | [Phantom metadata update](https://explorer.solana.com/tx/3uao1kVKbtq6v4DHRNtPhhSm9uMMChzhJEccPC6LuoGxDwkj9sXGdmBU1SFkXJWsQW4iBJVz4jE2jcuf94t4Bqc1?cluster=devnet). The Solana instruction contains the expected update calldata. Rome RPC returned Identity #1 with metadata `https://example.org/` and both wallets linked. |
| EVM unlink | [MetaMask unlinked Phantom](https://via-hadrian.testnet.romeprotocol.xyz/tx/0xadefc5f3bc45c8bd58fa7317b685f7b2c433b3ae4d5342c9eb68a501f6652805), [Solana settlement](https://explorer.solana.com/tx/x8944PQhNjHS7GWE4jqDNb2Z58zy2Lrd8UHhmxXgUwAh5Jpj4HsGtqAxHS83iRpBjkGgrimUtYMgfea5bKgyZet?cluster=devnet). Identity #1 retained its owner and updated metadata. A simulated update from the removed sender reverted with `Unauthorized`. |
| Rome ↔ Solana settlement mapping | [Solana Devnet settlement for EVM creation](https://explorer.solana.com/tx/2DZDtYzKXt5USNdr9LkVv92dyXWUa8viKc72y22GvwNSygcw3tjc1ks1h3hzdeMef3B1xMmKJ5UYUGsXE7ZNJanx?cluster=devnet) verified via Rome RPC. The legacy response for Phantom acceptance did not return a Rome hash. |
| Security review | Local tests; no independent audit |

## Official idea and evidence mapping

The [official idea page](https://arena.mainnet.romeprotocol.xyz/ideas) was retrieved successfully by direct HTTP on 2026-11-05. Its Identity Manager description calls for a profile associating wallets after each proves control, with EVM and Solana identity kept distinct until associated. The [registration page](https://arena.mainnet.romeprotocol.xyz/apps/new?idea=Identity+Manager) server response showed only Loading; authenticated form requirements were not verified. No explicit idea-specific milestone rubric was available in the retrieved content.

| Public idea / project criterion | Implemented evidence | Outstanding verification |
|---|---|---|
| Profile links wallets after proof of control | Hadrian MetaMask creation/proposal and Phantom acceptance verified | Fresh-wallet provisioning separately |
| EVM / Solana identities distinguished | kind-tagged keys; Solana hash-derived sender checked independently in Solidity and SDK | Fresh Phantom onboarding on Hadrian |
| Shared app identity | Phantom updated Identity #1, and the EVM owner lookup and dashboard showed the same metadata | Hosted browser walkthrough |
| Wallet signatures | Real EIP-191/Ed25519 unit tests and browser flows | Browser extensions and rejection/retry walkthrough |
| Milestone eligibility / additional rubric | TODO | Read actual authenticated Arena form; do not infer eligibility |

## Architecture explanation

Next.js UI → official SDK write paths → one RomeIdentityManager contract. Registry supplies all infrastructure configuration. EVM writes use submitRomeTx; Phantom legacy writes use submitRomeTxSolanaLane. Solana's authenticated runtime sender is derived from its public key. Owner proposes a wallet-specific, expiring nonce-bound offer; the target accepts from its own lane. No trusted attestation server or independent identity database. Linked wallets may edit profile metadata; only owner changes membership or recovery. Transfer/recovery revoke prior authorizations.

Limitations: current Rome v1 recommendation and Phantom devnet incompatibility; unverified legacy limits; no arbitrary Solidity Ed25519 verifier; local signature checks are not on-chain authorization; recovery depends on an independent guardian and monitoring; public link privacy; inherited dependency advisories. See SECURITY.md.

## Screenshots

- [Hadrian Identity #1 after the Phantom update](screenshots/hadrian-identity-1-after-phantom-update.png) shows the new metadata and both linked wallets before unlinking.

Earlier screenshots of the local MVP before deployment:

- screenshots/dashboard-desktop.jpg
- screenshots/link-wallets-desktop.jpg
- screenshots/link-wallets-mobile.jpg


## Short demo script (after deployment)

1. Show Hadrian chain/contract and source commit; open dashboard with fresh MetaMask.
2. Sign contextual ownership message; create identity with a public metadata URI. Show successful EVM receipt and identity ID.
3. Connect fresh Phantom on Devnet. Show its base58 public key separately from the derived Rome sender.
4. Switch to owner; propose Phantom's exact public key. Show nonce/expiry.
5. Switch to Phantom; read offer, verify contextual message, accept with a Solana-signed transaction. Show actual settlement signature and refreshed linked state.
6. From Phantom, update metadata. Switch to MetaMask and refresh; show same identity ID and changed metadata.
7. Unlink from owner and demonstrate revoked edit access. Explain guardian delay and ownership-change revocation.
8. Show evidence files and clearly state any unmapped hash, wallet incompatibility or unverified edge case. If the legacy lane fails, record the failure rather than completing a simulated demo.
