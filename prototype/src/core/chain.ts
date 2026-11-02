// On-chain proof. If the dev server has a funded testnet wallet it sends a small real USDC transfer
// and we show the explorer link. Otherwise it records a mock transaction so the demo still works.
import { CHAIN } from '../config'
import { state, update } from './state'

let n = 0
const randHex = (len: number) => Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('')

export async function refreshChain() {
  try {
    const r = await fetch('/api/chain/status')
    const j = await r.json()
    update((s) => { s.chain.live = !!j.live; s.chain.address = j.address ?? ''; s.chain.balance = j.balance ?? 0; s.chain.checked = true })
  } catch {
    update((s) => { s.chain.live = false; s.chain.checked = true })
  }
}

/** Records a proof transfer for a ledger event. usdCents is the demo amount; the on-chain amount is symbolic. */
export async function anchor(kind: 'funding' | 'settlement' | 'test', label: string, usdCents: number) {
  const usdc = Math.min(CHAIN.maxUsdcPerTx, Math.max(CHAIN.minUsdcPerTx, Math.round((usdCents / 100) * CHAIN.scale * 1e6) / 1e6))
  const id = `tx_${++n}`
  update((s) => { s.chain.txs.unshift({ id, label, usdc, mode: s.chain.live ? 'testnet' : 'mock', hash: '', url: null, status: 'sending', ts: Date.now() }) })
  const patch = (p: Partial<(typeof state.chain.txs)[number]>) => update((s) => { const t = s.chain.txs.find((x) => x.id === id); if (t) Object.assign(t, p) })
  if (state.chain.live) {
    try {
      const r = await fetch('/api/chain/transfer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, amount: usdc }) })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error)
      patch({ hash: j.hash, url: j.url, status: 'confirmed' })
      void refreshChain()
      return
    } catch {
      patch({ mode: 'mock' })
    }
  }
  await new Promise((r) => setTimeout(r, 900))
  patch({ hash: '0x' + randHex(64), url: null, status: 'confirmed' })
}
