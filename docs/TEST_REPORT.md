# RomeID verification report

Local verification date: 2026-11-05. Scope: local source, cryptography, local EVM bytecode and production UI. On 2026-11-07, the user deployed the contract and created Identity #1 on Hadrian using MetaMask. The creation receipt, owner, metadata and Solana settlement mapping were verified through Rome RPC. The Phantom acceptance signature was confirmed on Solana Devnet and Rome RPC returned the linked synthetic sender under Identity #1 with the offer consumed. A second Phantom transaction contained the expected profile update calldata and the owner's identity lookup returned Identity #1 with the new metadata and two linked wallets. The owner then unlinked Phantom. Rome RPC returned one remaining wallet and preserved the updated metadata. A read-only simulation of an update from the removed sender reverted with Unauthorized. See [Arena evidence](ARENA_SUBMISSION.md) for the transaction links.

## Commands and results

| Command | Result |
|---|---|
| `node --version` | v24.14.0 |
| `npm --version` | 11.9.0 |
| `git --version` | 2.53.0.windows.2 |
| `forge --version` | Not installed; solc-js used instead |
| `npm install` | Installed pinned direct dependencies; package-lock contains exact resolutions |
| `npm run compile` | PASS, solc 0.8.26, Paris, optimizer 200; deployment bytecode 8,115 bytes; artifact and TypeScript ABI generated |
| `npm run typecheck` | PASS; see typecheck-run.log |
| `npm run lint` | PASS; see lint-run.log |
| `npm test` | 18 local tests PASS; see test-run.log |
| `npm run build` | PASS, Next.js 15.5.29; see build-run.log |
| `npm audit --omit=dev --json` | Nonzero due remaining advisories, **not clean**; see npm-audit-production.json and SECURITY.md |
| `node --import tsx scripts/preflight.ts` | PASS, keyless RPC: chain ID 200010 and latest block 518893001 at 2026-11-05T09:28:45.065Z; see rpc-preflight.json |
| `npx next start --hostname 127.0.0.1 --port 3001` | Started production preview; HTTP GET /dashboard returned 200 |

Initial failures were fixed: Vite starter migrated to Next; unused import/empty-catch lint errors; Ganache lacks viem's wallet_sendTransaction method and uses a different revert error code, so the **test-only** transport adapter normalizes these; local deployment needs an explicit gas budget. Tests validate exact custom errors, not a catch-all rejection. Ganache's Node 24 uWS binary is absent; documented JavaScript fallback was used. These local adapter changes do not replace Rome SDK writes.

The final build emitted a non-fatal notice that the Next-specific ESLint plugin is not configured. The explicit TypeScript/ESLint check and production build passed. Final local test log: 18 passed, 0 failed, 0 skipped. Current audit reports 41 advisory entries (1 low, 12 moderate, 24 high, 4 critical), including development-only Ganache bundled paths even under omit=dev. No clean-audit or public-release readiness claim is made.

## Local test coverage

15 contract tests execute compiled Solidity on an in-memory EVM: identity creation/events and duplicate claims; EVM key spoofing/canonical key rules; Solana sender derivation and spoof rejection; both-party link consent; consumed/replaced/cancelled nonces; expiry/deadlines; unauthorized link acceptance/proposals; globally unique wallet claims; linked updates/outsider denial/URI bounds; unlink/index consistency/owner protection; transfer consent, old-link revocation and stale epoch; cancellation/expiry/unlinked successors; guardian consent, delay, owner cancellation, recovery execution and former-owner revocation; unlinking guardian/successor cleanup; nonexistent IDs and invalid zero keys.

3 cryptographic tests use real signatures: EIP-191 valid/invalid/expired; cross-domain/chain/contract/identity/wallet/action/nonce/context substitution; Ed25519 valid/tampered/wrong signer. No mocked test is described as on-chain integration.

## Browser inspection

Actual production preview inspected through the in-app browser: dashboard, create identity, link wallets and landing navigation. Verified disabled writes without a contract/wallet and explicit undeployed/legacy-lane notices. Desktop screenshots saved at screenshots/dashboard-desktop.jpg and screenshots/link-wallets-desktop.jpg. Mobile linking inspected at viewport 390 × 844; DOM document scroll width was 375 (no page-wide horizontal overflow); screenshot link-wallets-mobile.jpg. Wallet navigation uses its own horizontal scroll strip on mobile. Viewport override was reset. No wallet extension connection/signature or on-chain UI success was tested.

An initial localhost preview timed out; explicit IPv4 loopback on port 3001 worked. These screenshots are local UI evidence only.

## Hadrian integration matrix

| Scenario | Status |
|---|---|
| MetaMask creates identity on Hadrian | PASS — Identity #1, successful receipt and state verified |
| Phantom accepts link | PASS — legacy lane signature, synthetic wallet link and consumed offer verified. Fresh provisioning was not tested separately. |
| Phantom performs authorized update | PASS — Solana instruction calldata and resulting Rome metadata verified |
| MetaMask reads the same updated identity | PASS — owner lookup and dashboard screenshot show Identity #1, two wallets and new metadata |
| Both-lane unlink consistency | PASS — MetaMask unlink receipt, owner and metadata preserved, removed sender identity lookup returns zero. Its simulated update reverted with `Unauthorized`. |
| Actual rejected signatures, failed transaction / retry | TODO |
| Rome receipt ↔ Solana settlement mapping | PASS for EVM create, propose and unlink. Phantom legacy response supplies a Solana signature only. |
| Transfer/recovery with maximum wallet count on Rome | TODO |
| Vercel deployed app browser smoke | TODO — publication approval |

The browser walkthrough completed on Hadrian. The separate gated v1 harness in scripts/dual-lane.ts has not been run. Verified transaction links and screenshots are in ARENA_SUBMISSION.md.
