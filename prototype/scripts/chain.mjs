// Testnet helper: wallet, balance and a real USDC transfer on Arc Testnet.
// Usage: npm run chain:wallet | chain:balance | chain:send -- <to> <amountUsdc>
import { existsSync, readFileSync, appendFileSync } from 'node:fs'
import { createPublicClient, createWalletClient, defineChain, http, parseUnits, formatUnits, erc20Abi } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

export const arc = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [process.env.CHAIN_RPC_URL || 'https://rpc.testnet.arc.io'] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: 'https://explorer.testnet.arc.io' } },
})
export const USDC = process.env.CHAIN_USDC || '0x3600000000000000000000000000000000000000'
export const EXPLORER = 'https://explorer.testnet.arc.io'

export function loadEnv() {
  if (!existsSync('.env')) return
  for (const l of readFileSync('.env', 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

export function clients() {
  loadEnv()
  const pk = process.env.WALLET_PRIVATE_KEY
  if (!pk) return null
  const account = privateKeyToAccount(pk)
  const pub = createPublicClient({ chain: arc, transport: http() })
  const wallet = createWalletClient({ account, chain: arc, transport: http() })
  return { account, pub, wallet }
}

export async function usdcBalance(pub, address) {
  const raw = await pub.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [address] })
  return Number(formatUnits(raw, 6))
}

export async function sendUsdc(to, amount) {
  const c = clients()
  if (!c) throw new Error('No wallet: run npm run chain:wallet')
  const hash = await c.wallet.writeContract({ address: USDC, abi: erc20Abi, functionName: 'transfer', args: [to, parseUnits(String(amount), 6)] })
  await c.pub.waitForTransactionReceipt({ hash })
  return { hash, url: `${EXPLORER}/tx/${hash}` }
}

const cmd = process.argv[2]
if (process.argv[1].endsWith('chain.mjs') && cmd) {
  if (cmd === 'wallet') {
    loadEnv()
    if (process.env.WALLET_PRIVATE_KEY) console.log('Wallet already in .env:', privateKeyToAccount(process.env.WALLET_PRIVATE_KEY).address)
    else {
      const pk = generatePrivateKey()
      appendFileSync('.env', `WALLET_PRIVATE_KEY=${pk}\n`)
      console.log('New wallet saved to .env (never commit it):', privateKeyToAccount(pk).address)
    }
    console.log('Fund it with 20 test USDC: https://faucet.circle.com  (network: Arc Testnet, token: USDC)')
  } else if (cmd === 'balance') {
    const c = clients()
    if (!c) console.log('No wallet yet. Run: npm run chain:wallet')
    else console.log(c.account.address, (await usdcBalance(c.pub, c.account.address)) + ' USDC')
  } else if (cmd === 'send') {
    const r = await sendUsdc(process.argv[3], process.argv[4] || '0.01')
    console.log(r.url)
  }
}
