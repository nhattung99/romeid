// Keyless, read-only public RPC diagnostics. No wallet APIs or transactions.
import { writeFileSync } from 'node:fs';
import { createPublicClient,http } from 'viem';
import { loadConfig } from '../lib/config';
const cfg=loadConfig(),client=createPublicClient({transport:http(cfg.proxyUrl,{timeout:15_000,retryCount:0})});
const report:{checkedAt:string;expectedChainId:number;chainId?:number;latestBlock?:string;error?:string}={checkedAt:new Date().toISOString(),expectedChainId:cfg.chainId};
try { report.chainId=await client.getChainId();if(report.chainId!==cfg.chainId)throw new Error('Registry / RPC chain mismatch');report.latestBlock=(await client.getBlockNumber()).toString(); }
catch(e){report.error=e instanceof Error?e.message:String(e);process.exitCode=1;}
writeFileSync('docs/rpc-preflight.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
