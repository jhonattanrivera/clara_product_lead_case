// MOCK card issuer + processor. It owns the card data (PAN, CVV: the PCI scope) and asks our core
// for a real-time approval through a webhook. Our core never stores the PAN.
import { wait } from './latency'
import { STANDIN } from '../config'
import type { Cents } from '../core/ledger'
import { consume } from './demoControls'

export interface IssuedCard { cardId: string; last4: string; expiry: string }
export interface AuthRequest { cardId: string; authId: string; amount: Cents; merchant: string; mcc: number; country?: string; channel?: 'in_person' | 'online' }
export interface AuthDecision { approved: boolean; reason?: string; standIn?: boolean }

export type CardholderVerdict = 'approved' | 'needs_info' | 'denied'
const cards = new Map<string, { frozen: boolean; canceled: boolean; pan: string; cvv: string }>()
let webhook: (req: AuthRequest) => AuthDecision = () => ({ approved: false, reason: 'no_webhook' })
const auths = new Map<string, AuthRequest>()
let n = 0

let standInHook: (req: AuthRequest) => void = () => {}
/** Called when the issuer decided alone (stand-in) so the core can reconcile the hold afterwards. */
export const setStandInHook = (fn: typeof standInHook) => { standInHook = fn }

/** The core registers its decision function here ("webhook: is there available balance?"). */
export const setAuthWebhook = (fn: typeof webhook) => { webhook = fn }

/** The issuer runs its own checks on the cardholder. It can say no even when KYC said yes. */
export async function reviewCardholder(): Promise<CardholderVerdict> {
  await wait(700)
  if (consume('cardholderDenied')) return 'denied'
  if (consume('cardholderNeedsInfo')) return 'needs_info'
  return 'approved'
}

export async function issueCard(): Promise<IssuedCard> {
  await wait(1200)
  const cardId = `card_${++n}`
  cards.set(cardId, { frozen: false, canceled: false, pan: '4242 4242 4242 4242', cvv: '123' })
  return { cardId, last4: '4242', expiry: '09/30' }
}

export function cancelCard(cardId: string) {
  const c = cards.get(cardId)
  if (c) c.canceled = true
}

export async function setFrozen(cardId: string, frozen: boolean) {
  await wait(400)
  const c = cards.get(cardId)
  if (c) c.frozen = frozen
}

/** What the issuer SDK shows inside the app. Never passes through our servers. */
export async function revealDetails(cardId: string) {
  await wait(500)
  const c = cards.get(cardId)!
  return { pan: c.pan, cvv: c.cvv }
}

/** Network sends an authorization; the issuer asks our core, then answers in milliseconds. */
export async function authorize(req: Omit<AuthRequest, 'authId'>): Promise<AuthDecision & { authId: string }> {
  await wait(1000)
  const authId = `auth_${++n}`
  const card = cards.get(req.cardId)
  if (!card) return { authId, approved: false, reason: 'no_card' }
  if (card.canceled) return { authId, approved: false, reason: 'card_canceled' }
  if (card.frozen) return { authId, approved: false, reason: 'card_frozen' }
  const full = { ...req, authId }
  if (consume('authTimeout')) {
    // The platform did not answer in time. The issuer applies the stand-in policy by itself.
    await wait(2500)
    const ok = req.amount <= STANDIN.maxUsd * 100
    if (!ok) return { authId, approved: false, reason: 'timeout_declined', standIn: true }
    auths.set(authId, full)
    standInHook(full)
    return { authId, approved: true, standIn: true }
  }
  const copies = consume('duplicateWebhook') ? 2 : 1 // the same request can reach the core twice
  let decision: AuthDecision = { approved: false, reason: 'no_webhook' }
  for (let i = 0; i < copies; i++) decision = webhook(full)
  if (decision.approved) auths.set(authId, full)
  return { authId, ...decision }
}

/** Clearing file: the merchant's final amount arrives later (can differ from the authorization). */
export async function clear(authId: string, finalAmount: Cents) {
  await wait(200)
  const a = auths.get(authId)
  auths.delete(authId)
  return a ? { authId, authorized: a.amount, finalAmount } : null
}

export const isKnownAuth = (authId: string) => auths.has(authId)
export const authAmount = (authId: string) => auths.get(authId)?.amount

/** Incremental authorization (+) or partial reversal (-): the open authorization changes amount. */
export function adjust(authId: string, delta: Cents) {
  const a = auths.get(authId)
  if (a) a.amount += delta
}
export const closeAuth = (authId: string) => { auths.delete(authId) }
