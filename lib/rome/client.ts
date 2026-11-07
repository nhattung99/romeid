import { Buffer } from 'buffer';
import { Connection, PublicKey } from '@solana/web3.js';
import { submitRomeTx, submitRomeTxSolanaLane } from '@rome-protocol/sdk';
import { createPublicClient, http, encodeFunctionData, isAddressEqual, zeroAddress, type Address, type Hex } from 'viem';
import config from './config.generated.json';
import { identityAbi } from './abi';
import type { EvmProvider, PhantomProvider } from '../wallets/providers';

// SDK legacy transaction builders use Buffer in browser runtimes, as in the scaffold.
if(typeof globalThis.Buffer==='undefined') globalThis.Buffer=Buffer;
export {config};
export const client=createPublicClient({transport:http(config.proxyUrl,{timeout:20_000,retryCount:1})});
export function contractAddress(): Address {
  if(!config.identityAddress) throw new Error('Identity contract is not deployed/configured. Follow docs/DEPLOYMENT.md.');
  return config.identityAddress as Address;
}
export async function checkDeployment() {
  if(await client.getChainId() !== config.chainId) throw new Error('RPC chain does not match Hadrian registry configuration.');
  const code=await client.getCode({address:contractAddress()});
  if(!code || code==='0x') throw new Error('No contract code at the configured identity address.');
}
export const identityOf=(sender:Address)=>client.readContract({address:contractAddress(),abi:identityAbi,functionName:'identityOf',args:[sender]});
export const readIdentity=(id:bigint)=>client.readContract({address:contractAddress(),abi:identityAbi,functionName:'getIdentity',args:[id]});
export type IdentityResult=Awaited<ReturnType<typeof readIdentity>>;
export const readOffer=(id:bigint,kind:number,key:Hex)=>client.readContract({address:contractAddress(),abi:identityAbi,functionName:'walletId',args:[kind,key]}).then(wid=>client.readContract({address:contractAddress(),abi:identityAbi,functionName:'linkOffers',args:[id,wid]}));
export type Operation='createIdentity'|'proposeLink'|'acceptLink'|'cancelLink'|'unlinkWallet'|'updateProfile'|'proposeTransfer'|'cancelTransfer'|'acceptTransfer'|'proposeGuardian'|'acceptGuardian'|'scheduleRecovery'|'cancelRecovery'|'executeRecovery';
export interface TxEvidence {lane:'evm'|'solana';romeHash?:Hex;solanaSignatures:string[];status:string;at:string;}
export async function ensureEvmNetwork(provider:EvmProvider) {
  const chainId=toChainHex();
  if(Number(await provider.request({method:'eth_chainId'}))!==config.chainId) {
    try {await provider.request({method:'wallet_switchEthereumChain',params:[{chainId}]});}
    catch(e) {if((e as {code?:number}).code!==4902) throw e;
      await provider.request({method:'wallet_addEthereumChain',params:[{chainId,chainName:config.name,nativeCurrency:{name:'USDC',symbol:'USDC',decimals:18},rpcUrls:[config.proxyUrl],blockExplorerUrls:[config.explorerUrl]}]});
      await provider.request({method:'wallet_switchEthereumChain',params:[{chainId}]});
    }
  }
  if(Number(await provider.request({method:'eth_chainId'}))!==config.chainId) throw new Error('Switch MetaMask to Rome Hadrian.');
}
const toChainHex=()=>`0x${config.chainId.toString(16)}`;
export async function settlement(hash:Hex):Promise<string[]> {
  try { const result:unknown=await client.request({method:'rome_solanaTxForEvmTx' as any,params:[hash] as any});
    // Only expose actual returned transaction signature strings; preserve absence as unknown.
    const values=Array.isArray(result)?result: typeof result==='string'?[result]:[];
    return values.filter((v):v is string=>typeof v==='string' && /^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(v));
  } catch {return [];}
}
export async function writeEvm(provider:EvmProvider,from:Address,op:Operation,args:readonly unknown[],onSubmitted:(e:TxEvidence)=>void) {
  await ensureEvmNetwork(provider); await checkDeployment();
  const accounts=await provider.request({method:'eth_accounts'}) as Address[];
  if(!accounts[0] || !isAddressEqual(accounts[0],from)) throw new Error('MetaMask account changed. Reconnect.');
  const data=encodeFunctionData({abi:identityAbi,functionName:op,args:args as any});
  // Simulation is read-only and prevents SDK fallback gas from concealing obvious reverts.
  await client.call({account:from,to:contractAddress(),data});
  const hash=await submitRomeTx(provider,{from,to:contractAddress(),data});
  const evidence:TxEvidence={lane:'evm',romeHash:hash,solanaSignatures:[],status:'pending',at:new Date().toISOString()};onSubmitted(evidence);
  const receipt=await client.waitForTransactionReceipt({hash,timeout:120_000});
  evidence.status=receipt.status;evidence.solanaSignatures=await settlement(hash);onSubmitted({...evidence});
  if(receipt.status!=='success') throw new Error('Rome transaction reverted. Inspect the receipt before retrying.');
  return evidence;
}
export async function writeSolana(provider:PhantomProvider,expected:PublicKey,op:Operation,args:readonly unknown[],onSubmitted:(e:TxEvidence)=>void) {
  await checkDeployment();
  if(!provider.publicKey?.equals(expected)) throw new Error('Phantom account changed. Reconnect.');
  const data=encodeFunctionData({abi:identityAbi,functionName:op,args:args as any});
  // Legacy path is intentionally used for Phantom. No raw Solana/EVM transaction substitute.
  const r=await submitRomeTxSolanaLane({connection:new Connection(config.solanaRpc,'confirmed'),proxyUrl:config.proxyUrl,programId:config.programId,chainId:config.chainId,payer:expected,signTransaction:tx=>provider.signTransaction(tx)},{to:contractAddress(),data});
  const evidence:TxEvidence={lane:'solana',solanaSignatures:[r.signature],status:'Solana confirmed; re-reading Rome state',at:new Date().toISOString()};
  onSubmitted(evidence);
  await waitForExpectedState(op,args,r.from);
  evidence.status='Expected Rome state observed; legacy Rome receipt/hash unavailable';onSubmitted({...evidence});return evidence;
}
/** A state observation is separate evidence from a receipt; never invent a legacy Rome hash. */
async function waitForExpectedState(op:Operation,args:readonly unknown[],actor:Address) {
  const id=op==='createIdentity'?0n:args[0] as bigint;
  const same=(a:string,b:unknown)=>a.toLowerCase()===String(b).toLowerCase();
  async function matches(){
    if(op==='createIdentity')return await identityOf(actor)!==0n;
    if(op==='acceptLink')return await identityOf(actor)===id;
    if(op==='unlinkWallet')return await identityOf(args[1] as Address)===0n;
    if(op==='proposeLink'||op==='cancelLink'){
      const offer=await readOffer(id,args[1] as number,args[2] as Hex);
      return op==='cancelLink'?offer[0]===0n:offer[0]!==0n&&offer[1]===args[3];
    }
    const [p]=await readIdentity(id);
    switch(op){
      case 'updateProfile':return p.metadataURI===args[1];
      case 'proposeTransfer':return same(p.successor,args[1])&&p.transferDeadline===args[2];
      case 'cancelTransfer':return p.successor===zeroAddress;
      case 'acceptTransfer':case 'executeRecovery':return same(p.owner,actor);
      case 'proposeGuardian':return same(p.guardianOffer,args[1])&&(args[1]!==zeroAddress||p.guardian===zeroAddress);
      case 'acceptGuardian':return same(p.guardian,actor);
      case 'scheduleRecovery':return p.recoveryAt!==0n;
      case 'cancelRecovery':return p.recoveryAt===0n;
      default:return false;
    }
  }
  for(let i=0;i<15;i++){if(await matches())return;await new Promise(r=>setTimeout(r,2000));}
  throw new Error('Solana confirmed but the expected Rome state was not observed. Inspect settlement evidence before resubmitting.');
}
export function romeTxUrl(hash:string) {return `${config.explorerUrl.replace(/\/$/,'')}/tx/${encodeURIComponent(hash)}`;}
export function solanaTxUrl(signature:string) {return `${config.solanaExplorer.replace(/\/$/,'')}/tx/${encodeURIComponent(signature)}?cluster=${encodeURIComponent(config.solanaCluster)}`;}
