# RomeID implementation plan

Research date: 2026-11-05. Local implementation only; no signing, funding, public deployment or repository publication is authorized.

## Architecture

Next.js App Router + TypeScript + Tailwind, adapting the official create-rome-app scaffold. The original Vault and dual-lane helpers/scripts are retained in examples/starter and the root lib. Registry metadata is projected to browser JSON at build time. One non-upgradeable Solidity registry is the only identity source of truth. EVM calls use submitRomeTx. Phantom uses the documented legacy submitRomeTxSolanaLane path, explicitly experimental until Hadrian smoke tests pass. The current starter's preferred submitRomeTxV1 requires a compatible wallet (the current AGENTS.md warns Phantom cannot sign v1 on devnet).

Identity authorization uses sender-based, expiring two-transaction consent: an owner proposes a specific wallet key + expected sender; that wallet accepts through its own lane. Solana sender = SDK syntheticAddress(pubkey), not the raw pubkey or an assumed EVM wallet. The contract independently derives keccak256(pubkey)[12:]. No trusted backend attestor. Signed EIP-191/Ed25519 contextual challenges are local possession checks and UX evidence, never sufficient to mutate the contract. Runtime transaction authentication is authoritative.

Owner controls linking, unlinking, recovery settings and transfer. Linked wallets may update public profile metadata. Transfer requires a linked successor to accept; recovery uses a pre-accepted, independent linked guardian, a two-day delay, owner cancellation, and successor acceptance. Recovery/transfer revoke all prior linked wallets to prevent a compromised owner retaining access. Bounded wallet count prevents unbounded cleanup.

## Milestones and acceptance

1. Research: record versions, commits, APIs and inaccessible Arena criteria. Never infer reward eligibility.
2. Contract: compile; execute local EVM tests covering consent, replay, expiry, roles, transfer, guardian delay/cancel and revocation. No external calls or token custody.
3. Frontend: seven routes, explicit undeployed state, both wallet adapters, contextual signatures, contract reads/writes, pending/error/retry, copy and explorer evidence.
4. Local checks: typecheck, lint, unit/local-EVM tests and production build; save exact results.
5. Approval gate: user-controlled signing/funding/deployment on Hadrian; record real deployment receipt and repeat fresh-wallet dual-lane flow. Local EVM tests do not establish Rome parity.
6. Submission: actual repository/demo/address/receipts/screenshots only; TODO until available.

## Risks

- Arena ideas were recovered through direct HTTP: profile association requires proof of control of each separate EVM/Solana identity. Application server response still only shows Loading, so exact form/milestone requirements remain unknown.
- Cached web AGENTS.md differs from current git source. Prefer pinned git source and document changes.
- Legacy Phantom calls can exceed Solana transaction size/CU limits. Do not silently substitute a different write path or claim success. Solflare/v1 may be required in a later compatibility revision.
- Hadrian gas is USDC; Solana lane also needs SOL/rent. Funding and bridging require separate approval.
- Runtime Ed25519 authorization exists for Rome transaction execution, not a documented arbitrary Solidity signature-verification precompile. Avoid an invented verifier.
- Public wallet linkage is permanent historical information. Metadata is public; no PII or secrets.
- Recovery guardian is powerful after delay; owner monitoring and independent wallet custody are required.
- Windows cannot check out rome-evm's aux.rs path; inspect that repository through git object reads instead.

## Future agent identity

After dual-lane MVP evidence: typed agent identifiers, explicit capability scopes, per-action limits, short expirations, revocation epochs and separate agent keys. Never delegate unrestricted ownership or wallet signing.
