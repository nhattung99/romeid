import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createPublicClient, formatUnits, getAddress, http, parseUnits, toHex, type Hash } from 'viem';
import { loadConfig } from '../lib/config';
import { compileIdentity } from './compile';

const [address, limit] = process.argv.slice(2);
if (!address || !limit || !/^\d+(\.\d{1,18})?$/.test(limit)) {
  throw new Error('Usage: tsx scripts/deploy-with-wallet.ts <approved EVM address> <approved maximum USDC>');
}
const deployer = getAddress(address);
const cap = parseUnits(limit, 18);
const cfg = loadConfig();
const client = createPublicClient({ transport: http(cfg.proxyUrl, { timeout: 20_000 }) });
const { bytecode, compiler } = compileIdentity();
if (existsSync('deployments/hadrian.json') || existsSync('deployments/hadrian-pending.json')) {
  throw new Error('A deployment or pending transaction already exists. Check deployments/ before retrying.');
}
if (await client.getChainId() !== cfg.chainId) throw new Error('Hadrian RPC chain mismatch');
const [gas, price, balance, nonce] = await Promise.all([
  client.estimateGas({ account: deployer, data: bytecode }),
  client.getGasPrice(),
  client.getBalance({ address: deployer }),
  client.getTransactionCount({ address: deployer, blockTag: 'pending' }),
]);
const paddedPrice = price * 3n / 2n;
const maxFeePerGas = paddedPrice * gas > cap ? cap / gas : paddedPrice;
const ceiling = gas * maxFeePerGas;
if (maxFeePerGas < price || balance < ceiling) throw new Error('Gas quote or balance cannot fit the approved ceiling');

const port = 3002;
const origin = `http://127.0.0.1:${port}`;
const token = randomUUID();
const tx = { from: deployer, data: bytecode, gas: toHex(gas), maxFeePerGas: toHex(maxFeePerGas), maxPriorityFeePerGas: '0x0', nonce: toHex(nonce), value: '0x0' };
const network = {
  chainId: toHex(cfg.chainId), chainName: 'Rome Hadrian', rpcUrls: [cfg.proxyUrl],
  blockExplorerUrls: [cfg.explorerUrl], nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
};
let submittedHash: Hash | undefined;

const server = createServer(async (req, res) => {
  if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403).end(); return; }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET' && req.url === `/${token}`) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Deploy RomeID · Hadrian</title>
<style>body{font:16px system-ui;max-width:680px;margin:72px auto;padding:0 20px;color:#152c47}code{overflow-wrap:anywhere}button{font:inherit;padding:12px 18px;cursor:pointer}#status{white-space:pre-wrap;overflow-wrap:anywhere}</style>
<h1>Deploy RomeID lên Hadrian</h1><p>Ví deploy <code>${deployer}</code></p><p>Mạng Rome Hadrian (${cfg.chainId}). Số USDC gửi kèm: 0.</p>
<p>Gas ${gas.toString()}. Phí tối đa của giao dịch: <strong>${formatUnits(ceiling, 18)} USDC testnet</strong>.</p>
<p>Kiểm tra đúng tài khoản, mạng và tổng phí tối đa trong MetaMask trước khi xác nhận. Giữ trang này mở trong lúc chờ biên nhận.</p>
<button id="connect">1. Kết nối MetaMask</button>
<button id="deploy" disabled>2. Xác nhận deploy</button><p id="status" role="status"></p>
<script>
const tx = ${JSON.stringify(tx)};
const network = ${JSON.stringify(network)};
const connect = document.getElementById('connect');
const button = document.getElementById('deploy');
const status = document.getElementById('status');
let provider;
const permissionHelp = 'MetaMask chưa cấp quyền cho trang này. Trong Chrome có MetaMask, mở MetaMask → Permissions, cho phép trang 127.0.0.1:3002 dùng ví deploy và mạng Hadrian, rồi kết nối lại.';
const hasDeployer = accounts => accounts.some(account => account.toLowerCase() === tx.from.toLowerCase());
connect.addEventListener('click', async () => {
  connect.disabled = button.disabled = true;
  try {
    provider = window.ethereum?.providers?.find(item => item.isMetaMask) ?? window.ethereum;
    if (!provider?.isMetaMask) throw new Error('Mở trang trong Chrome có MetaMask.');
    const accounts = await provider.request({method:'eth_requestAccounts'});
    if (!hasDeployer(accounts)) throw new Error('MetaMask chưa cho trang truy cập đúng ví deploy. Chọn tài khoản được ghi ở trên trong Permissions.');
    if (await provider.request({method:'eth_chainId'}) !== network.chainId) {
      try { await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:network.chainId}]}); }
      catch (error) {
        if (error.code !== 4902) throw error;
        await provider.request({method:'wallet_addEthereumChain',params:[network]});
      }
    }
    if (await provider.request({method:'eth_chainId'}) !== network.chainId) throw new Error('Hãy chuyển MetaMask sang Rome Hadrian.');
    status.textContent = 'Đã kết nối đúng ví trên Hadrian. Bạn có thể mở yêu cầu xác nhận deploy.';
    button.disabled = false;
  } catch (error) {
    status.textContent = 'Kết nối: ' + (error.code === 4100 ? permissionHelp : error.message);
  } finally {
    connect.disabled = false;
  }
});
button.addEventListener('click', async () => {
  connect.disabled = button.disabled = true;
  let requested = false;
  try {
    if (!hasDeployer(await provider.request({method:'eth_accounts'})) || await provider.request({method:'eth_chainId'}) !== network.chainId) throw new Error('Tài khoản hoặc mạng đã thay đổi. Hãy kết nối lại.');
    requested = true;
    const hash = await provider.request({method:'eth_sendTransaction',params:[tx]});
    status.textContent = 'Đã gửi. Đang xác minh biên nhận: ' + hash;
    const response = await fetch(location.pathname + '/receipt/' + hash, {method:'POST'});
    const result = await response.text();
    status.textContent = result + '\\nMã giao dịch: ' + hash;
  } catch (error) {
    status.textContent = 'Deploy: ' + (error.code === 4100 ? permissionHelp : error.message || 'Kiểm tra lịch sử trong MetaMask trước khi thử lại.');
    if (!requested || error.code === 4001 || error.code === 4100) connect.disabled = false;
  }
});
</script></html>`);
    return;
  }
  const match = req.url?.match(new RegExp(`^/${token}/receipt/(0x[a-fA-F0-9]{64})$`));
  if (req.method !== 'POST' || req.headers.origin !== origin || !match) { res.writeHead(404).end(); return; }
  if (submittedHash) { res.writeHead(409).end('A transaction is already being checked.'); return; }
  submittedHash = match[1] as Hash;
  mkdirSync('deployments', { recursive: true });
  writeFileSync('deployments/hadrian-pending.json', JSON.stringify({ hash: submittedHash, deployer, chainId: cfg.chainId }, null, 2));
  console.log('Submitted deployment:', submittedHash);
  try {
    const receipt = await client.waitForTransactionReceipt({ hash: submittedHash, timeout: 180_000 });
    const mined = await client.getTransaction({ hash: receipt.transactionHash });
    if (mined.from.toLowerCase() !== deployer.toLowerCase() || mined.to !== null || mined.input.toLowerCase() !== bytecode.toLowerCase() || mined.value !== 0n || mined.nonce !== nonce) {
      throw new Error('The mined transaction does not match the prepared deployment');
    }
    if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('Deployment reverted');
    const paid = receipt.gasUsed * receipt.effectiveGasPrice;
    let commit: string | null = null;
    try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { /* Local workspace can exist without a Git commit. */ }
    const record = {
      chain: 'Rome Hadrian', chainId: cfg.chainId, deployer, address: receipt.contractAddress,
      transactionHash: receipt.transactionHash, explorer: `${cfg.explorerUrl.replace(/\/$/, '')}/tx/${receipt.transactionHash}`,
      compiler, commit, status: receipt.status, blockNumber: receipt.blockNumber.toString(),
      recordedAt: new Date().toISOString(), feeUSDC: formatUnits(paid, 18), approvedFeeUSDC: limit,
      testResults: 'See docs/TEST_REPORT.md',
    };
    writeFileSync('deployments/hadrian.json', JSON.stringify(record, null, 2));
    console.log(JSON.stringify(record, null, 2));
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(`Contract đã deploy: ${record.address}. Phí thực tế: ${record.feeUSDC} USDC testnet.${paid > cap ? ' Phí vượt trần đã duyệt. Kiểm tra cài đặt phí của ví.' : ''}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    res.writeHead(422, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Chưa xác minh thành công. Giữ mã giao dịch để kiểm tra trước khi gửi lại.');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Open in Chrome with MetaMask: ${origin}/${token}\nFee ceiling: ${formatUnits(ceiling, 18)} USDC testnet`));
