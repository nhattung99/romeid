import { PublicKey, type Transaction } from '@solana/web3.js';
import { syntheticAddress } from '@rome-protocol/sdk';
import { getAddress, padHex, toHex, type Address, type Hex } from 'viem';
export interface EvmProvider {
  isMetaMask?: boolean; providers?: EvmProvider[];
  request(args:{method:string;params?: any[]}): Promise<any>;
  on?(event:string, listener:(...args:any[])=>void):void;
  removeListener?(event:string, listener:(...args:any[])=>void):void;
}
export interface PhantomProvider {
  isPhantom?:boolean; publicKey: PublicKey | null;
  connect():Promise<{publicKey:PublicKey}>; disconnect():Promise<void>;
  signMessage(message:Uint8Array,display?:string):Promise<{signature:Uint8Array;publicKey:PublicKey}>;
  signTransaction(transaction:Transaction):Promise<Transaction>;
  on?(event:string,listener:(...args:any[])=>void):void;
  removeListener?(event:string,listener:(...args:any[])=>void):void;
}
declare global { interface Window { ethereum?:EvmProvider; phantom?:{solana?:PhantomProvider}; } }
export function metamask() {
  const root=window.ethereum;
  const p=root?.providers?.find(p=>p.isMetaMask) || (root?.isMetaMask ? root : undefined);
  if(!p) throw new Error('Install and unlock MetaMask, then retry.'); return p;
}
export function phantom() {
  const p=window.phantom?.solana;
  if(!p?.isPhantom) throw new Error('Install and unlock Phantom, then retry.'); return p;
}
export type WalletKey={kind:0|1;key:Hex;sender:Address;display:string};
export function evmKey(address:string):WalletKey { const sender=getAddress(address);return {kind:0,key:padHex(sender,{size:32}),sender,display:sender}; }
export function solanaKey(address:string):WalletKey { const pubkey=new PublicKey(address);return {kind:1,key:toHex(pubkey.toBytes()),sender:getAddress(syntheticAddress(pubkey)),display:pubkey.toBase58()}; }
