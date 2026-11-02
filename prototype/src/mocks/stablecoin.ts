// MOCK stablecoin partner: on-ramp (fiat -> USDC for company funding), custody, and
// off-ramp (USDC -> local currency) including the FX quote.
import { FEES, FX, TIMING, type CurrencyCode } from '../config'
import { wait } from './latency'
import { consume } from './demoControls'
import type { Cents } from '../core/ledger'

export async function onRamp(amount: Cents): Promise<{ txId: string; usdc: Cents; fee: Cents }> {
  await wait(1200)
  return { txId: `onramp_${Date.now()}`, usdc: amount, fee: Math.round(amount * FEES.onRampPct) }
}

export interface FxQuote {
  id: string
  currency: CurrencyCode
  usd: Cents // total debited from the available balance
  fee: Cents
  spreadUsd: Cents // part of the amount the platform keeps as FX spread
  mid: number
  rate: number // after spread
  spreadPct: number
  localAmount: number
  expiresAt: number
  ttlMs: number
}

const used = new Set<string>()
const issued = new Map<string, FxQuote>()
let n = 0

export async function getQuote(usd: Cents, currency: CurrencyCode, freeWithdrawal: boolean, sp: number): Promise<FxQuote> {
  await wait(700)
  const jitter = 1 + (Math.random() * 2 - 1) * FX.jitterPct
  const mid = FX.mid[currency] * jitter
  const rate = mid * (1 - sp)
  const fee = freeWithdrawal ? 0 : Math.round(FEES.withdrawalFeeUsd * 100)
  const spreadUsd = Math.round((usd - fee) * sp)
  const ttlMs = (consume('quoteShortTtl') ? TIMING.shortQuoteTtlSeconds : TIMING.quoteTtlSeconds) * 1000
  const q: FxQuote = {
    id: `quote_${++n}`, currency, usd, fee, spreadUsd, mid, rate, spreadPct: sp,
    localAmount: ((usd - fee) / 100) * rate, expiresAt: Date.now() + ttlMs, ttlMs,
  }
  issued.set(q.id, q)
  return q
}

export class QuoteExpiredError extends Error {}

/** The off-ramp checks the quote on ITS side too, so an expired quote can never be honored. */
export async function redeemQuote(id: string): Promise<FxQuote> {
  await wait(300)
  const q = issued.get(id)
  if (!q || used.has(id) || Date.now() > q.expiresAt) throw new QuoteExpiredError()
  used.add(id)
  return q
}

/** If the debit cannot start, the quote stays usable until it expires. */
export const releaseQuote = (id: string) => { used.delete(id) }
