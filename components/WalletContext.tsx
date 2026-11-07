'use client';
import { createContext,useContext,useState,useEffect,useCallback,useRef,type ReactNode } from 'react';
import { PublicKey } from '@solana/web3.js';
import { toHex,type Address } from 'viem';
import { config,identityOf,readIdentity,writeEvm,writeSolana,type Operation,type TxEvidence,type IdentityResult } from '../lib/rome/client';
import { metamask,phantom,evmKey,solanaKey,type WalletKey } from '../lib/wallets/providers';
import { challengeText,verifyEvmChallenge,verifySolanaChallenge,type Challenge } from '../lib/auth/challenge';

function useWalletState() {
  const [evm,setEvm]=useState<WalletKey|null>(null),[solana,setSolana]=useState<WalletKey|null>(null);
  const [lane,setLane]=useState<'evm'|'solana'>('evm');
  const active=lane==='evm'?evm:solana;
  const [id,setId]=useState(0n),[profile,setProfile]=useState<IdentityResult|null>(null);
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState('Connect a wallet to get started.'),[error,setError]=useState('');
  const [evidence,setEvidence]=useState<TxEvidence[]>([]),[proof,setProof]=useState<Challenge|null>(null);
  const lock=useRef(false),generation=useRef(0);
  const run=useCallback(async (task:()=>Promise<void>)=>{
    if(lock.current) return;lock.current=true;setBusy(true);setError('');
    try {await task();} catch(e){setError(e instanceof Error?e.message:String(e));setNotice('Action incomplete. Check the error and retry.');}
    finally {lock.current=false;setBusy(false);}
  },[]);
  const refresh=useCallback(async()=>{
    const ticket=generation.current;
    if(!active || !config.identityAddress){setId(0n);setProfile(null);return;}
    const found=await identityOf(active.sender);const result=found?await readIdentity(found):null;
    if(ticket===generation.current){setId(found);setProfile(result);}
  },[active]);
  useEffect(()=>{generation.current++;setId(0n);setProfile(null);setProof(null);if(active&&config.identityAddress) void run(refresh);},[active,refresh,run]);
  useEffect(()=>{
    const clearEvm=()=>{generation.current++;setEvm(null);setProof(null);setId(0n);setProfile(null);setNotice('MetaMask account/network changed. Reconnect to continue.');};
    const clearSol=()=>{generation.current++;setSolana(null);setProof(null);setId(0n);setProfile(null);setNotice('Phantom account changed. Reconnect to continue.');};
    let ep:ReturnType<typeof metamask>|undefined,sp:ReturnType<typeof phantom>|undefined;
    try{ep=metamask();ep.on?.('accountsChanged',clearEvm);ep.on?.('chainChanged',clearEvm);}catch{ /* Wallet extension is optional until connection. */ }
    try{sp=phantom();sp.on?.('accountChanged',clearSol);sp.on?.('disconnect',clearSol);}catch{ /* Wallet extension is optional until connection. */ }
    return ()=>{ep?.removeListener?.('accountsChanged',clearEvm);ep?.removeListener?.('chainChanged',clearEvm);sp?.removeListener?.('accountChanged',clearSol);sp?.removeListener?.('disconnect',clearSol);};
  },[]);
  const connect=(which:'evm'|'solana')=>run(async()=>{
    setProof(null);
    if(which==='evm'){const accounts=await metamask().request({method:'eth_requestAccounts'}) as Address[];if(!accounts[0])throw new Error('MetaMask returned no account');setEvm(evmKey(accounts[0]));}
    else {const {publicKey}=await phantom().connect();setSolana(solanaKey(publicKey.toBase58()));}
    setLane(which);setNotice(`${which==='evm'?'MetaMask':'Phantom'} connected. No message or transaction signed.`);
  });
  const record=(e:TxEvidence)=>setEvidence(old=>[e,...old.filter(x=>e.romeHash?x.romeHash!==e.romeHash:x.solanaSignatures[0]!==e.solanaSignatures[0])].slice(0,12));
  const write=async(op:Operation,args:readonly unknown[])=>{
    if(!active)throw new Error('Connect and select a wallet first.');
    setProof(null);setNotice(`Review ${op} in your wallet. This uses testnet fees.`);
    if(lane==='evm')await writeEvm(metamask(),active.sender,op,args,record);
    else await writeSolana(phantom(),new PublicKey(active.display),op,args,record);
    // A confirmed Solana tx is not proof that the indexed EVM view has caught up.
    await refresh();setNotice(lane==='evm'?'Rome receipt confirmed. On-chain data refreshed.':'Solana transaction confirmed. Rome state re-read; verify the expected change before retrying.');
  };
  const signChallenge=(context?:{identityId:string;action:string;binding:string})=>run(async()=>{
    if(!active)throw new Error('Connect a wallet first.');
    const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    const c:Challenge={domain:window.location.origin,chainId:config.chainId,contract:config.identityAddress||'undeployed',identityId:context?.identityId||id.toString(),wallet:`${lane}:${active.display}`,action:context?.action||'prove-possession',nonce,expiresAt:Date.now()+5*60_000,binding:context?.binding||`epoch:${profile?.[0].epoch||0n};sender:${active.sender}`};
    let ok=false;
    if(lane==='evm'){const sig=await metamask().request({method:'personal_sign',params:[toHex(challengeText(c)),active.sender]});ok=await verifyEvmChallenge(c,c,active.sender,sig);}
    else {const p=phantom();const sig=await p.signMessage(new TextEncoder().encode(challengeText(c)),'utf8');if(!sig.publicKey.equals(new PublicKey(active.display)))throw new Error('Phantom returned a different signing account');ok=verifySolanaChallenge(c,c,new PublicKey(active.display).toBytes(),sig.signature);}
    if(!ok)throw new Error('Signature verification failed or challenge expired.');
    setProof(c);setNotice('Ownership signature verified locally. Wallet linking still requires both on-chain authorizations.');
  });
  return {evm,solana,lane,setLane,active,id,profile,busy,notice,error,evidence,proof,connect,run,write,refresh,signChallenge,disconnect:()=>{generation.current++;setEvm(null);setSolana(null);setId(0n);setProfile(null);setProof(null);setNotice('Disconnected from RomeID.');}};
}
type State=ReturnType<typeof useWalletState>;
const Context=createContext<State|null>(null);
export function WalletProvider({children}:{children:ReactNode}){const state=useWalletState();return <Context.Provider value={state}>{children}</Context.Provider>;}
export function useWallet(){const ctx=useContext(Context);if(!ctx)throw new Error('WalletProvider missing');return ctx;}
