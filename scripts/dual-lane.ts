// REAL Hadrian smoke harness, gated. Never run as part of npm test/build.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { writeFileSync,mkdirSync } from 'node:fs';
import { Connection,Keypair } from '@solana/web3.js';
import { buildCreatePdaCall, isSyntheticProvisioned, submitRomeTx, submitRomeTxV1, syntheticAddress } from '@rome-protocol/sdk';
import { createPublicClient,http,encodeFunctionData,padHex,toHex,type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { identityAbi } from '../lib/rome/abi';
import { loadConfig } from '../lib/config';
import { eip1193FromAccount } from '../lib/eip1193Node';
if(process.env.ALLOW_TESTNET_SPEND!=='I_APPROVE_HADRIAN_DUAL_LANE_SMOKE')throw new Error('Signing disabled. Obtain explicit approval before setting ALLOW_TESTNET_SPEND=I_APPROVE_HADRIAN_DUAL_LANE_SMOKE.');
if(!process.env.NEXT_PUBLIC_IDENTITY_ADDRESS||!process.env.ROME_EVM_KEY||!process.env.ROME_SOLANA_KEY)throw new Error('Missing contract address / local keys. Never send secrets in chat.');
const cfg=loadConfig();
if(process.env.CHAIN_ID&&Number(process.env.CHAIN_ID)!==cfg.chainId)throw new Error('Hadrian only');
const address=process.env.NEXT_PUBLIC_IDENTITY_ADDRESS as Address;
const evm=privateKeyToAccount(process.env.ROME_EVM_KEY as `0x${string}`);
const sol=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.ROME_SOLANA_KEY)));
const sender=syntheticAddress(sol.publicKey),pub=createPublicClient({transport:http(cfg.proxyUrl)});
assert.equal(await pub.getChainId(),cfg.chainId);
const read=(functionName:any,args:readonly unknown[]=[])=>pub.readContract({address,abi:identityAbi,functionName,args:args as any}) as Promise<any>;
assert.equal(await read('identityOf',[evm.address]),0n,'Use a fresh EVM wallet');assert.equal(await read('identityOf',[sender]),0n,'Use a fresh Solana wallet');
const evidence:unknown[]=[];
const solanaLane = {
  connection: new Connection(cfg.solanaRpc, 'confirmed'),
  proxyUrl: cfg.proxyUrl,
  programId: cfg.programId,
  chainId: cfg.chainId,
  signer: sol,
};
async function solWrite(step: string, call: Parameters<typeof submitRomeTxV1>[1]) {
  const result = await submitRomeTxV1(solanaLane, { ...call, relayOnRefusal: false });
  evidence.push({ lane: 'solana', step, hash: result.hash, signature: result.signature, from: result.from, status: result.receipt?.status ?? null });
  assert.equal(result.receipt?.status, '0x1', `${step}: successful Rome receipt required`);
}
async function evmWrite(functionName:any,args:readonly unknown[]) {
 const data=encodeFunctionData({abi:identityAbi,functionName,args:args as any});
 const hash=await submitRomeTx(eip1193FromAccount(evm,cfg.proxyUrl,cfg.chainId),{from:evm.address,to:address,data});
 const receipt=await pub.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');
 let settlement:unknown=null;try{settlement=await pub.request({method:'rome_solanaTxForEvmTx' as any,params:[hash] as any});}catch{ /* Mapping may be unavailable. */ }
 evidence.push({lane:'evm',functionName,hash,status:receipt.status,settlement});
}
const save=()=>{mkdirSync('deployments',{recursive:true});writeFileSync('deployments/dual-lane-evidence.json',JSON.stringify({chainId:cfg.chainId,address,evm:evm.address,solana:sol.publicKey.toBase58(),synthetic:sender,recordedAt:new Date().toISOString(),evidence},null,2));};
try {
 if (!(await isSyntheticProvisioned(solanaLane.connection, cfg.programId, sender))) {
   await solWrite('create_pda', buildCreatePdaCall(sender));
 }
 await evmWrite('createIdentity',[0,padHex(evm.address,{size:32}),'ipfs://romeid-smoke-initial']);
 const id=await read('identityOf',[evm.address]);
 await evmWrite('proposeLink',[id,1,toHex(sol.publicKey.toBytes()),BigInt(Math.floor(Date.now()/1000)+3600)]);
 const wid=await read('walletId',[1,toHex(sol.publicKey.toBytes())]);const offer=await read('linkOffers',[id,wid]);
 await solWrite('acceptLink', { to: address, data: encodeFunctionData({ abi: identityAbi, functionName: 'acceptLink', args: [id, 1, toHex(sol.publicKey.toBytes()), offer[0]] }) });
 // Poll actual reads: Solana confirmation can precede Rome indexing.
 async function until(check:()=>Promise<boolean>){for(let n=0;n<30;n++){if(await check())return;await new Promise(r=>setTimeout(r,2000));}throw new Error('Rome indexed state did not match expected operation');}
 await until(async()=>await read('identityOf',[sender])===id);
 await solWrite('updateProfile', { to: address, data: encodeFunctionData({ abi: identityAbi, functionName: 'updateProfile', args: [id, 'ipfs://romeid-smoke-solana-updated'] }) });
 await until(async()=>(await read('getIdentity',[id]))[0].metadataURI==='ipfs://romeid-smoke-solana-updated');
 evidence.push({assertion:'Solana update visible through EVM read',id:id.toString()});
 await evmWrite('unlinkWallet',[id,sender]);assert.equal(await read('identityOf',[sender]),0n);
 evidence.push({assertion:'EVM unlink visible in shared sender lookup',passed:true});save();console.log('Dual-lane identity smoke passed. Evidence saved. This tests SDK key signers, not browser MetaMask/Phantom UI.');
} catch(e){evidence.push({failure:e instanceof Error?e.message:String(e)});save();throw e;}
