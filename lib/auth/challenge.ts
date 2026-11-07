import { ed25519 } from '@noble/curves/ed25519';
import { PublicKey } from '@solana/web3.js';
import { verifyMessage, type Address } from 'viem';
export interface Challenge {
  domain: string; chainId: number; contract: string; identityId: string;
  wallet: string; action: string; nonce: string; expiresAt: number; binding: string;
}
export function challengeText(c: Challenge): string {
  return ['RomeID ownership challenge',`Domain: ${c.domain}`,`Environment: Rome Hadrian / ${c.chainId}`,`Contract: ${c.contract}`,`Identity: ${c.identityId}`,`Wallet: ${c.wallet}`,`Action: ${c.action}`,`Nonce: ${c.nonce}`,`Expires: ${c.expiresAt}`,`Binding: ${c.binding}`,'This message does not link wallets or authorize an on-chain write.'].join('\n');
}
/** Local UX possession proof only. Never a server login, link credential or relayed authorization. */
export function validContext(c: Challenge, expected: Challenge, now = Date.now()): boolean {
  return challengeText(c) === challengeText(expected) && c.expiresAt > now && c.expiresAt <= now + 5*60_000 && /^[0-9a-f]{64}$/.test(c.nonce);
}
export async function verifyEvmChallenge(c:Challenge, expected:Challenge, address:Address, signature:`0x${string}`, now=Date.now()) {
  if(!validContext(c,expected,now) || c.wallet.toLowerCase() !== `evm:${address}`.toLowerCase()) return false;
  try { return await verifyMessage({address,message:challengeText(c),signature}); } catch { return false; }
}
export function verifySolanaChallenge(c:Challenge, expected:Challenge, publicKey:Uint8Array, signature:Uint8Array, now=Date.now()) {
  if(!validContext(c,expected,now)) return false;
  try { if(c.wallet !== `solana:${new PublicKey(publicKey).toBase58()}`) return false; } catch { return false; }
  try { return ed25519.verify(signature,new TextEncoder().encode(challengeText(c)),publicKey); } catch { return false; }
}
