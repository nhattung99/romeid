import 'dotenv/config';
import { mkdirSync,writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createPublicClient,createWalletClient,formatUnits,http,parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { compileIdentity } from './compile';
import { loadConfig } from '../lib/config';
if(process.env.ALLOW_TESTNET_SPEND!=='I_APPROVE_HADRIAN_DEPLOYMENT')throw new Error('Signing disabled. Obtain explicit user approval, then set ALLOW_TESTNET_SPEND=I_APPROVE_HADRIAN_DEPLOYMENT.');
if(!/^0x[0-9a-fA-F]{64}$/.test(process.env.ROME_EVM_KEY||''))throw new Error('Set ROME_EVM_KEY locally; never share it in chat.');
const cfg=loadConfig();
if(process.env.CHAIN_ID&&Number(process.env.CHAIN_ID)!==cfg.chainId)throw new Error('Hadrian only');
const client=createPublicClient({transport:http(cfg.proxyUrl)});
if(await client.getChainId()!==cfg.chainId)throw new Error('Registry/RPC chain mismatch');
const artifact=compileIdentity(),account=privateKeyToAccount(process.env.ROME_EVM_KEY as `0x${string}`);
const chain={id:cfg.chainId,name:'Rome Hadrian',nativeCurrency:{name:'USDC',symbol:'USDC',decimals:18},rpcUrls:{default:{http:[cfg.proxyUrl]}}} as const;
const wallet=createWalletClient({account,chain,transport:http(cfg.proxyUrl)});
const approvedLimit = process.env.ROME_DEPLOY_MAX_USDC;
if (!approvedLimit || !/^\d+(\.\d{1,18})?$/.test(approvedLimit) || parseUnits(approvedLimit,18) <= 0n) {
  throw new Error('Set ROME_DEPLOY_MAX_USDC to the explicitly approved deployment fee ceiling.');
}
const [gasPrice, gas, balance] = await Promise.all([
  client.getGasPrice(),
  client.estimateGas({ account: account.address, data: artifact.bytecode }),
  client.getBalance({ address: account.address }),
]);
const maxFeePerGas = gasPrice * 3n / 2n;
const feeCeiling = gas * maxFeePerGas;
const ceilingUSDC = formatUnits(feeCeiling,18);
if (feeCeiling > parseUnits(approvedLimit,18)) throw new Error(`Fee ceiling ${ceilingUSDC} USDC exceeds approved limit ${approvedLimit} USDC.`);
if (balance < feeCeiling) throw new Error(`Deployer needs ${ceilingUSDC} USDC to cover the transaction fee ceiling.`);
// Estimate includes Rome account creation. All app writes use the SDK.
const hash=await wallet.deployContract({abi:artifact.abi,bytecode:artifact.bytecode,gas,maxFeePerGas,maxPriorityFeePerGas:0n});
console.log('Submitted deployment:',hash);
const receipt=await client.waitForTransactionReceipt({hash,timeout:180_000});
if(receipt.status!=='success'||!receipt.contractAddress)throw new Error('Deployment reverted or returned no address');
let commit:string|null=null;try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{ /* No git commit exists yet. */ }
const record={chain:'Rome Hadrian',chainId:cfg.chainId,address:receipt.contractAddress,transactionHash:hash,explorer:`${cfg.explorerUrl.replace(/\/$/,'')}/tx/${hash}`,recordedAt:new Date().toISOString(),blockNumber:receipt.blockNumber.toString(),commit,compiler:artifact.compiler,status:receipt.status,testResults:'See docs/TEST_REPORT.md; rerun immediately before deployment'};
mkdirSync('deployments',{recursive:true});writeFileSync('deployments/hadrian.json',JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));
