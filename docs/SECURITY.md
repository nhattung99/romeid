# Security model and limitations

## Authority

RomeIdentityManager is non-upgradeable, has no administrator key, server attestor, external calls or asset custody. Reentrancy has no entry opportunity because no function calls untrusted code, transfers value or invokes CPI. Do not add external calls without an explicit guard: Rome does not provide Ethereum's historical 2300-gas stipend protection.

The owner is a contract role. An EVM wallet's transaction sender is its EVM address. A Solana wallet's sender is `address(uint160(uint256(keccak256(rawPublicKey))))`, independently checked in Solidity and derived in the client with the official SDK. These are distinct concepts. Keys include a kind discriminator and canonical 32-byte encoding. Both sender and wallet-key indexes enforce global uniqueness. As with Ethereum addresses, synthetic addresses rely on 160-bit collision resistance.

Creation proves control by requiring the authenticated sender to match the supplied key. Linking requires the current owner to propose a specific key, followed by the target wallet accepting from that derived sender. A typed address string, local signature result or compromised frontend/server cannot manufacture contract authorization. Solana's Ed25519 verification is done by the runtime for the signed transaction; no custom Ed25519 Solidity precompile is assumed.

Offers carry unique monotonically increasing nonces, expiry (maximum one day), identity and ownership epoch. Their storage lives in a specific deployment/chain. Transaction signatures bind chain, calldata and transaction nonce. Replacement, cancellation, consumption and epoch changes invalidate old offers. The contract trusts Rome runtime authentication and consensus. This is not a claim of independence from Rome's infrastructure.

## Signature UX

EIP-191 personal_sign and Ed25519 signMessage challenges include origin, Hadrian chain ID, contract, identity, wallet identifier, action, random nonce, five-minute expiry and binding context. The client checks the exact message, signer and expiry. Nothing consumes these signatures on a server or contract; they are local possession evidence, not an authentication session or replayable linking credential. They are never persisted. Contract transactions, not these local proofs, authorize linking. No off-chain-only verifier is described as trustless. A future server login needs server-issued single-use nonces, secure sessions and CSRF protection.

## Permission boundaries

- Owner: propose/cancel links, unlink others, transfer, configure/cancel recovery.
- Linked editor: update public metadata and unlink itself. Linking a wallet therefore grants profile editing permission.
- Guardian: must first be linked and explicitly accept its role. May schedule ownership recovery to itself after two days. Owner can cancel before execution or revoke/unlink the guardian. At/after the deadline, competing transactions are ordered by the chain; cancellation has no guaranteed priority.
- Transfer: linked successor must accept within the deadline. All previous wallets are revoked, including the previous owner. Guardian/recovery settings reset and pending link offers become stale by epoch.
- Recovery: only the accepted guardian can schedule/execute. Execution retains only the guardian's linked wallet, revokes compromised wallets, clears settings and increments epoch.

Maximum 16 linked wallets bounds cleanup cost. This is not gas/CU evidence on Rome: transfer/recovery at that maximum still require Hadrian resource testing. An owner can disable recovery; losing all controlling keys with no guardian is unrecoverable. The application cannot override that. Use independent guardian custody and monitor recovery events. This simple guardian design is not social recovery with a threshold.

## Frontend and privacy

Account/network changes clear cached identity and proof state; every write rechecks the active account. EVM network switching is explicit through wallet APIs. Phantom is directed to Devnet; its injected API does not reliably expose a cluster getter, so final connection/fee rejection may occur at submission. No blind auto-retry of writes. UI renders metadata as text, never HTML and never automatically fetches arbitrary URIs. Wallet links and historical events are public, even after unlinking. Do not publish PII, secrets, keys or sensitive metadata.

## Known release blockers

1. The Hadrian deployment and the Identity #1 MetaMask/Phantom walkthrough are verified. Fresh-wallet provisioning and compute or transaction size limits for other operations still need separate verification.
2. Current official guidance recommends v1, which Phantom does not yet sign on devnet. The requested legacy SDK integration is implemented but experimental. Do not silently switch wallet or transaction route. If legacy cannot carry the calls, obtain a product decision about Solflare/v1 compatibility.
3. Legacy SDK returns Solana signature only. UI checks confirmed Solana status and polls expected Rome state; that observation is not an indexed EVM receipt or invented Rome hash. EVM submissions retain actual hashes/status and request settlement mapping where available.
4. Dependency audit still reports advisories, including inherited Solana SDK dependencies and bundled development-only Ganache packages. Exact machine-readable result: npm-audit-production.json (npm's omit=dev output includes Ganache bundled nodes; inspect paths). Next.js/viem compatible patches were applied. A clean audit is not claimed; review and isolate these before public release. Do not deploy Ganache or expose its RPC.
5. Contract has not had an independent audit. Recovery UI, failed-transaction handling and wallet event races still need real browser-wallet and Hadrian testing. Read-only code-presence validation does not certify a configured contract's source/bytecode provenance.

No private keys, seeds or wallet secrets are in application source. `.env*` is ignored except the placeholder example. Scripts refuse deployment/smoke signing without explicit acknowledgement values. These are accidental-execution guards, not substitutes for the user's approval.
