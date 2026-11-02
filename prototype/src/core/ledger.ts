// In-memory ledger. Every posting moves money from one account to another, so the books always
// balance. Employee money lives in four accounts:
//   pending   – received, still being checked. NOT spendable.
//   on_hold   – stopped for a compliance review. NOT spendable.
//   available – spendable and withdrawable.
//   held      – reserved by a card authorization until clearing.
// Accounts starting with "external:" or "platform:" may go negative (they mirror the outside world).
// A journal is one business event: all its lines apply together or not at all. An idempotency key
// makes a replay of the same event a no-op. Entries are append-only: a reversal is a new journal.
import { notify } from '../bus'

export type Cents = number

export const acct = {
  company: 'company:acme:funding',
  pending: (id: string) => `emp:${id}:pending`,
  onHold: (id: string) => `emp:${id}:on_hold`,
  available: (id: string) => `emp:${id}:available`,
  held: (id: string) => `emp:${id}:held`,
  receivable: (id: string) => `platform:receivable:${id}`, // the employee owes the program (clearing above the balance)
  revenue: {
    payoutFee: 'platform:revenue:payout_fee',
    withdrawalFee: 'platform:revenue:withdrawal_fee',
    fxSpread: 'platform:revenue:fx_spread',
    interchange: 'platform:revenue:interchange',
  },
  companyMarkup: 'company:acme:fx_markup', // the company's share of the FX spread it configured
  losses: 'platform:losses', // write-offs
  suspense: 'platform:suspense', // items waiting for ops (clearing without authorization, wrong network)
  networkRefunds: 'external:network_refunds',
  issuerSettlement: 'platform:issuer_settlement', // cleared, waiting for the daily settlement
  networkSettlement: 'external:network_settlement',
  networkInterchange: 'external:network_interchange',
  wireIn: 'external:wire_in',
  localIn: 'external:local_in',
  usInbound: 'external:us_inbound',
  partnerFees: 'external:partner_fees',
  payoutInTransit: 'external:payout_in_transit',
  bankOut: 'external:bank_out',
}

export interface Posting {
  from: string
  to: string
  amount: Cents
  memo: string
}
export interface LedgerEntry extends Posting {
  id: number
  journal: number
  key?: string
  ts: number
}

export class InsufficientFundsError extends Error {
  constructor(public account: string, public needed: Cents, public have: Cents) {
    super(`Insufficient funds in ${account}`)
  }
}

const entries: LedgerEntry[] = []
const balances = new Map<string, Cents>()
const journalByKey = new Map<string, number>()
let journalSeq = 0
const mayGoNegative = (a: string) => a.startsWith('external:') || a.startsWith('platform:')

export const ledger = {
  balance: (account: string): Cents => balances.get(account) ?? 0,

  /**
   * All-or-nothing: if any posting does not fit, nothing is applied and the error is thrown.
   * With a key, a second call with the same key posts nothing and returns the original journal.
   */
  postMany(postings: Posting[], key?: string): number | undefined {
    if (key && journalByKey.has(key)) return journalByKey.get(key)
    const valid = postings.filter((p) => p.amount > 0)
    const next = new Map(balances)
    const read = (a: string) => next.get(a) ?? 0
    for (const p of valid) {
      const have = read(p.from)
      if (!mayGoNegative(p.from) && have < p.amount) throw new InsufficientFundsError(p.from, p.amount, have)
      next.set(p.from, have - p.amount)
      next.set(p.to, read(p.to) + p.amount)
    }
    if (valid.length === 0) return undefined
    next.forEach((v, k) => balances.set(k, v))
    const journal = ++journalSeq
    for (const p of valid) entries.push({ ...p, id: entries.length + 1, journal, key, ts: Date.now() })
    if (key) journalByKey.set(key, journal)
    notify()
    return journal
  },

  post(from: string, to: string, amount: Cents, memo: string, key?: string) {
    return this.postMany([{ from, to, amount, memo }], key)
  },

  employee(id: string) {
    return {
      pending: this.balance(acct.pending(id)),
      onHold: this.balance(acct.onHold(id)),
      available: this.balance(acct.available(id)),
      held: this.balance(acct.held(id)),
      owed: -this.balance(acct.receivable(id)),
    }
  },

  revenueTotal() {
    return Object.values(acct.revenue).reduce((sum, a) => sum + this.balance(a), 0)
  },

  /** Sum of every account. It must always be zero: money only moves, it is never created. */
  total: (): Cents => [...balances.values()].reduce((a, b) => a + b, 0),

  /** What the platform holds for everyone: every account except the ones that mirror the outside world. */
  internalTotal: (): Cents => [...balances.entries()].reduce((sum, [k, v]) => (k.startsWith('external:') ? sum : sum + v), 0),

  entries: () => entries,
}
