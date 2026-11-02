// The "platform core": orchestrates the mocked partners and the ledger, and updates app state.
// Rule of thumb: UI calls services; services call mocks + ledger; nothing else touches the ledger.
import { COMPANY, EMPLOYEES, FEES, FX, HOLD_DAYS, LIVE_EMPLOYEE_ID, MERCHANTS, BLOCKED_MCCS, BLOCKED_COUNTRIES, TIMING, payRule, CURRENCIES, type CurrencyCode, PAY_TYPES, type PayType } from '../config'
import { COPY } from '../copy'
import { local, parseAmount, toCents, usd } from '../format'
import { acct, ledger, InsufficientFundsError, type Cents } from './ledger'
import { payoutFee } from './pricing'
import { addActivity, addDays, allPeople, audit, patchActivity, payoutsOf, spreadPct as currentSpread, state, toast, update, type CardStatus, type CardFx, type Funding, type Invitee, type Payout, type PendingDeposit, type PayoutStatus, type TeamRole } from './state'
import { can, guard } from './auth'
import { classifyDecline } from './declines'
import { deliver, logEvent, raiseException, resolveException } from './events'
import { current, reopen, transition } from './machines'
import { anchor } from './chain'
import * as kycProvider from '../mocks/kyc'
import * as stablecoin from '../mocks/stablecoin'
import * as issuer from '../mocks/issuer'
import * as bank from '../mocks/bank'
import { consume, consumeDecline, flags, setFlag } from '../mocks/demoControls'
import { later, setFast, wait } from '../mocks/latency'

const ME = LIVE_EMPLOYEE_ID
type Employee = (typeof EMPLOYEES)[number]
let uid = 0
const nextId = (p: string) => `${p}_${++uid}`

// ── Bootstrap ───────────────────────────────────────────────────────────────
// Company starts with a funding balance (posted through the ledger like everything else).
ledger.post(acct.wireIn, acct.company, state.companyStartingCents, 'Opening funding balance')

// ── Onboarding ──────────────────────────────────────────────────────────────
export const acceptInvite = () => update((s) => { s.step = 'consent' })

export const giveConsent = () => update((s) => { s.step = 'kyc' })

export async function submitKyc() {
  update((s) => { s.kyc.status = 'submitting' })
  transition('kyc', ME, 'pending', 'api', 'Documents sent to the identity provider')
  const res = await kycProvider.submitKyc({ idPhoto: state.kyc.idPhoto, selfie: state.kyc.selfie })
  update((s) => { s.kyc.caseId = res.caseId })
  deliver('identity', `applicant.${res.status}`, `kyc:${res.caseId}:${res.status}`, () => applyKyc(res.status), `Verdict: ${res.status.replace('_', ' ')}`)
}

let opening: Promise<void> = Promise.resolve() // the account opening that follows an approval

/** The identity provider's answer, normalized to our own states. */
function applyKyc(status: kycProvider.KycStatus) {
  if (status === 'unreadable') {
    // Retryable: keep the selfie and consent; only the ID photo must be retaken.
    transition('kyc', ME, 'retry', 'webhook', 'Rejected, can retry: unreadable document')
    update((s) => { s.kyc.status = 'unreadable'; s.kyc.idPhoto = false })
  } else if (status === 'rejected') {
    // Final. No money ever left the company: queued payments are cancelled and the balance is free again.
    transition('kyc', ME, 'rejected', 'webhook', 'Final rejection')
    update((s) => { s.kyc.status = 'none'; s.step = 'kycRejected' })
    payoutsOf(ME).filter((p) => p.status === 'queued_kyc').forEach((p) => setPayout(p, 'returned', 'KYC rejected: not delivered, funds stay with the company'))
  } else if (status === 'manual_review') {
    transition('kyc', ME, 'in_review', 'webhook', 'Waiting for an analyst')
    update((s) => { s.kyc.status = 'review'; s.step = 'kycReview' })
    pollReview()
  } else {
    transition('kyc', ME, 'approved', 'webhook', 'Verdict positive')
    opening = kycApproved()
  }
}

function pollReview() {
  const tick = () => {
    if (state.step !== 'kycReview') return
    const verdict = kycProvider.getCaseStatus(state.kyc.caseId)
    if (verdict === 'approved') deliver('identity', 'applicant.approved', `kyc:${state.kyc.caseId}:approved`, () => applyKyc('approved'), 'Analyst approved')
    else if (verdict === 'rejected') deliver('identity', 'applicant.rejected', `kyc:${state.kyc.caseId}:rejected`, () => applyKyc('rejected'), 'Analyst rejected')
    else setTimeout(tick, 1000)
  }
  setTimeout(tick, 1000)
}

export const approveManualReview = () => {
  if (state.kyc.caseId) kycProvider.approveCase(state.kyc.caseId)
}
export const rejectManualReview = () => {
  if (state.kyc.caseId) kycProvider.rejectCase(state.kyc.caseId)
}

async function kycApproved() {
  await wait(600)
  update((s) => {
    s.kyc.status = 'approved'
    s.accountId = 'USD-' + Math.floor(10000000 + Math.random() * 89999999)
  })
  // Every account comes with a card, but the issuer decides on its own: two verdicts, kept apart.
  await reviewCardholder()
  update((s) => { s.step = 'accountCreated' })
  // If the company already ran a batch while the user was verifying, deliver the queued payments now.
  payoutsOf(ME).filter((p) => p.status === 'queued_kyc').forEach(deliverPayout)
}

async function reviewCardholder() {
  transition('cardholder', ME, 'pending', 'api', 'Application sent to the issuer')
  const verdict = await issuer.reviewCardholder()
  transition('cardholder', ME, verdict, 'webhook', `Issuer verdict: ${verdict.replace('_', ' ')}`)
  logEvent('issuer', 'cardholder.updated', `ch:${nextId('v')}`, 'processed', `Issuer verdict: ${verdict.replace('_', ' ')}. Kept apart from the KYC verdict`)
  if (verdict === 'approved') await issueNewCard()
}

/** The issuer asked for one more detail and the person sent it. */
export async function submitCardholderInfo() {
  update((s) => { s.cardBusy = 'issuing' })
  await reviewCardholder()
  update((s) => { s.cardBusy = '' })
}

async function issueNewCard() {
  const c = await issuer.issueCard()
  transition('card', c.cardId, 'not_activated', 'api', 'Issued')
  transition('card', c.cardId, 'active', 'system', 'Virtual cards activate at once')
  update((s) => { s.card = { ...c, frozen: false, status: 'active', lockedBy: null } })
}

export const startUsing = () => update((s) => { s.step = 'active'; s.tab = 'home' })

// ── Company funding and payment batches ─────────────────────────────────────
const employee = (id: string) => allPeople().find((e) => e.id === id)!
const liveVerified = () => state.step === 'active' || state.step === 'accountCreated'
const isVerified = (e: Employee) => (e.id === ME ? liveVerified() : state.others[e.id]?.status === 'ready')
export const canReceive = (e: Employee) =>
  payRule(e.country, e.type) !== 'blocked' && (e.id === ME ? state.step !== 'kycRejected' : !['failed', 'pending_approval', 'rejected'].includes(state.others[e.id]?.status ?? ''))

export const payableEmployees = () => allPeople().filter((e) => canReceive(e) && e.amountUsd > 0)
export const companyBalance = () => ledger.balance(acct.company)
/** Money already promised to people who are still finishing KYC. It has not left the company balance yet. */
export const committedFunds = () => state.payouts.filter((p) => p.status === 'queued_kyc').reduce((sum, p) => sum + p.amount + p.fee, 0)
export const batchTotal = () => payableEmployees().reduce((sum, e) => sum + toCents(e.amountUsd) + payoutFee(toCents(e.amountUsd)), 0)
export const shortfall = () => Math.max(0, batchTotal() + committedFunds() - companyBalance())

/** The company cannot move money until its KYB, its representatives and its admins are approved. */
export function operationalBlocker(): string | null {
  const c = state.company
  if (c.kyb !== 'approved') return `Company verification (KYB) is "${c.kyb.replace('_', ' ')}". The company cannot fund or pay until it is approved`
  if (c.ubos.some((u) => u.kyc !== 'approved')) return 'A representative or owner has not passed identity verification yet'
  if (c.team.some((m) => m.role === 'admin' && m.status === 'active' && m.kyc !== 'approved')) return 'An admin has not passed identity verification yet'
  return null
}
const blocked = () => { const b = operationalBlocker(); if (b) toast(b, 'error', 'company'); return !!b }

// ── Funding intents ─────────────────────────────────────────────────────────
// The platform owns the intent (what, how much). The ledger is credited only when the custodian confirms.
const queuedCredits = new Map<string, () => Promise<void>>()

function newFunding(kind: Funding['kind'], amount: Cents, via: string, requestId: string, activityId?: string): Funding {
  const f: Funding = { id: nextId('fund'), requestId, kind, amount, via, activityId }
  update((s) => { s.fundings.unshift(f) })
  transition('funding', f.id, 'requested', 'api', `${usd(amount)} via ${via}`)
  return f
}

/** Credits the company vault after confirmations. Reached from a received Add funds deposit, or when a scene is prepared. A repeated request id is a no-op. */
async function fundCompany(amount: Cents, internal = false, requestId: string = nextId('req'), via = 'on-ramp') {
  if (!internal && (!guard('fund') || blocked())) return
  if (state.fundings.some((f) => f.requestId === requestId)) return
  const f = newFunding('company', amount, via, requestId)
  if (flags.custodyDown) {
    transition('funding', f.id, 'queued', 'system', 'Custodian unavailable')
    queuedCredits.set(f.id, () => creditCompany(f))
    update((s) => { s.custodyQueue.push({ fundingId: f.id, at: Date.now() }) })
    logEvent('custodian', 'deposit.detected', f.id, 'queued', 'Custodian unavailable. Deposit is queued and will be credited when it is back')
    return toast('The custodian is unavailable. Your deposit is queued and will be credited when it is back. Nothing is lost', 'info', 'company')
  }
  if (consume('wrongNetwork')) {
    transition('funding', f.id, 'detected', 'webhook', 'Seen on an unsupported network')
    transition('funding', f.id, 'failed', 'system', 'Wrong network: not credited')
    raiseException('wrong_network_company', amount, `${usd(amount)} sent to the vault address on a network that address does not support. Not credited`)
    logEvent('custodian', 'deposit.detected', f.id, 'exception', 'Wrong network. Held outside the ledger until recovered')
    return toast('Deposit arrived on the wrong network. It was not credited. Review it under Compliance', 'error', 'company')
  }
  await creditCompany(f)
}

async function creditCompany(f: Funding) {
  const r = await stablecoin.onRamp(f.amount)
  transition('funding', f.id, 'detected', 'webhook', 'Seen by the custodian, waiting for confirmations')
  deliver('custodian', 'deposit.confirmed', `dep:${f.id}`, () => {
    ledger.postMany([
      { from: acct.wireIn, to: acct.company, amount: r.usdc, memo: 'Company funding (on-ramp)' },
      { from: acct.wireIn, to: acct.partnerFees, amount: r.fee, memo: 'On-ramp partner cost, passed through' },
    ], `dep:${f.id}`)
    transition('funding', f.id, 'confirmed', 'webhook', 'Custodian confirmed. Ledger credited')
    audit(`Deposit received: ${usd(r.usdc)} credited to the company vault`, 'Custodian')
    toast(`Deposit received: ${usd(r.usdc)} credited to the vault`, 'success', 'company')
    void anchor('funding', `Company funding ${usd(r.usdc)}`, r.usdc)
  }, `${usd(r.usdc)} credited after confirmations`)
}

/** Custodian outage on/off. When it comes back, queued deposits are credited, whoever restored it. */
export async function setCustodyDown(down: boolean) {
  setFlag('custodyDown', down)
  if (down) return
  const q = [...state.custodyQueue]
  update((s) => { s.custodyQueue = [] })
  for (const item of q) {
    const credit = queuedCredits.get(item.fundingId)
    queuedCredits.delete(item.fundingId)
    if (credit) await credit()
  }
}

export async function runPayroll(opts: { autoFund?: boolean; internal?: boolean } = {}) {
  if (!opts.internal && (!guard('pay') || blocked())) return
  if (shortfall() > 0) {
    if (!opts.autoFund) return
    await fundCompany(shortfall(), opts.internal)
  }
  const batch = state.batches + 1
  update((s) => { s.batches = batch })
  audit(`Sent payment batch #${batch}`)
  for (const e of payableEmployees()) {
    const amount = toCents(e.amountUsd)
    const p: Payout = {
      id: nextId('pay'), batch, employeeId: e.id, type: e.type, amount, fee: payoutFee(amount),
      status: 'queued_kyc', events: [{ ts: Date.now(), label: `Batch #${batch} sent by ${COMPANY.name}` }],
    }
    update((s) => { s.payouts.push(p) })
    if (isVerified(e)) deliverPayout(p)
    else setPayout(p, 'queued_kyc', 'Waiting for the employee to finish KYC')
  }
}

/** The company chases whoever is holding a payment up. */
export function nudgeEmployee(id: string) {
  const e = employee(id)
  const first = e.name.split(' ')[0]
  if (id === ME) {
    if (state.step !== 'kycRejected') return toast(`Reminder sent to ${first}`, 'info', 'company')
    reopen('kyc', ME, 'New application requested by the company')
    update((s) => { s.step = 'kyc'; s.kyc = { ...s.kyc, idPhoto: false, selfie: false, status: 'none' } })
    return toast(`New ID requested from ${first}`, 'info', 'company')
  }
  const current = state.others[id] ?? { status: 'invited' as const, note: 'Invite sent by email' }
  if (current.status === 'failed') {
    update((s) => { s.others[id] = { status: 'kyc_pending', note: 'New ID requested' } })
    toast(`New ID requested from ${first}. They join the next batch`, 'info', 'company')
  } else {
    update((s) => { s.others[id] = { ...current, note: current.status === 'invited' ? 'Invite re-sent' : 'Reminder sent' } })
    toast(`${current.status === 'invited' ? 'Invite re-sent' : 'Reminder sent'} to ${first}`, 'info', 'company')
  }
}

/** One row per payment, for the finance team's reconciliation. */
export function reconciliationCsv() {
  const header = ['batch', 'payment_id', 'employee', 'country', 'currency', 'type', 'amount_usd', 'fee_usd', 'status', 'last_update']
  const rows = state.payouts.map((p) => {
    const e = employee(p.employeeId)
    return [p.batch, p.id, e.name, e.country, e.currency, p.type, (p.amount / 100).toFixed(2), (p.fee / 100).toFixed(2), p.status, new Date(p.events.at(-1)!.ts).toISOString()]
  })
  return [header, ...rows].map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n')
}

function setPayout(p: Payout, status: PayoutStatus, label: string) {
  update(() => { p.status = status; p.events.push({ ts: Date.now(), label }) })
}

function deliverPayout(p: Payout) {
  const e = employee(p.employeeId)
  const isLive = e.id === ME
  const held = isLive && consume('paymentHold')
  ledger.postMany([
    { from: acct.company, to: acct.revenue.payoutFee, amount: p.fee, memo: `Payout fee, ${e.id}` },
    { from: acct.company, to: held ? acct.onHold(e.id) : acct.pending(e.id), amount: p.amount, memo: `${p.type} to ${e.id}` },
  ])
  setPayout(p, held ? 'on_hold' : 'pending', held ? 'On hold for review' : 'Delivered to the dollar account, pending')
  if (isLive) {
    addActivity({
      id: p.id, kind: 'deposit', title: `Pago de ${COMPANY.name}`, subtitle: COPY.payTypes[p.type] ?? p.type, amount: p.amount,
      status: held ? 'on_hold' : 'pending',
      note: held ? 'En revisión' : 'Pendiente: aún no se puede gastar',
    })
  }
  if (!held) scheduleRelease(p)
}

function scheduleRelease(p: Payout) {
  const isLive = p.employeeId === ME
  if (isLive && flags.keepPending) return // stays pending until the side panel releases it
  later(() => { if (!(isLive && flags.keepPending)) releasePayout(p) }, TIMING.pendingSeconds * 1000)
}

/** Pending -> available for one payment. If the employee owes the program, it is recovered first. */
function releasePayout(p: Payout) {
  if (p.status !== 'pending') return
  const id = p.employeeId
  const owed = Math.min(ledger.employee(id).owed, p.amount)
  ledger.postMany([
    { from: acct.pending(id), to: acct.available(id), amount: p.amount, memo: 'Pending to available' },
    { from: acct.available(id), to: acct.receivable(id), amount: owed, memo: 'Recovered card shortfall' },
  ], `release:${p.id}`)
  setPayout(p, 'available', 'Available to spend or withdraw')
  if (id !== ME) return
  update((s) => { s.freeWithdrawals++ })
  patchActivity(p.id, { status: 'completed', note: owed > 0 ? `Disponible. Se descontaron ${usd(owed)} de un cargo anterior de tarjeta` : 'Disponible' })
  toast('Tu dinero ya está disponible', 'success')
}

/** Demo control: the final checks finish now. */
export function releasePending() {
  setFlag('keepPending', false)
  payoutsOf(ME).filter((p) => p.status === 'pending').forEach(releasePayout)
  releaseUserDeposits()
}

/** The compliance review passes: the payment continues to the normal pending -> available path. */
export function approveHold(payoutId?: string) {
  if (!guard('approve')) return
  for (const p of state.payouts.filter((x) => x.status === 'on_hold' && (!payoutId || x.id === payoutId))) {
    ledger.post(acct.onHold(p.employeeId), acct.pending(p.employeeId), p.amount, 'Review passed: on hold to pending')
    setPayout(p, 'pending', 'Review passed, pending')
    if (p.employeeId === ME) patchActivity(p.id, { status: 'pending', note: 'Revisión aprobada. Pendiente' })
    audit(`Approved the held payment ${p.id}`)
    scheduleRelease(p)
  }
}
export const releaseHold = () => approveHold()

/** The review fails: the money goes back to the company. Nothing reached the employee. */
export function rejectHold(payoutId: string) {
  if (!guard('approve')) return
  const p = state.payouts.find((x) => x.id === payoutId && x.status === 'on_hold')
  if (!p) return
  ledger.post(acct.onHold(p.employeeId), acct.company, p.amount, `Review failed: returned to company ${p.id}`)
  setPayout(p, 'returned', 'Review failed: returned to the company')
  if (p.employeeId === ME) patchActivity(p.id, { status: 'failed', note: 'Este pago no se pudo completar. Le avisamos a tu empresa' })
  audit(`Rejected the held payment ${p.id}. Funds returned to the company`)
  toast('Payment rejected. The money returned to the company balance', 'info', 'company')
}

// ── Card ────────────────────────────────────────────────────────────────────
const setCardStatus = (to: CardStatus, source: 'api' | 'admin', note: string) => {
  const c = state.card
  if (c) transition('card', c.cardId, to, source, note)
}

/** Lock or unlock. The record says who locked it: a holder cannot undo a lock set by the company. */
export async function toggleFreeze(by: 'holder' | 'company' = 'holder') {
  const c = state.card
  if (!c || c.status === 'canceled') return
  if (by === 'company' && !guard('team')) return
  if (c.status === 'locked' && by === 'holder' && c.lockedBy === 'company') return toast(COPY.card.lockedByCompany, 'error')
  update((s) => { s.cardBusy = 'freezing' })
  const frozen = !c.frozen
  await issuer.setFrozen(c.cardId, frozen)
  setCardStatus(frozen ? 'locked' : 'active', by === 'company' ? 'admin' : 'api', `${frozen ? 'Locked' : 'Unlocked'} by the ${by}`)
  update((s) => { s.card!.frozen = frozen; s.card!.status = frozen ? 'locked' : 'active'; s.card!.lockedBy = frozen ? by : null; s.cardBusy = ''; if (frozen) s.revealed = null })
  if (by === 'company') {
    audit(`${frozen ? 'Locked' : 'Unlocked'} the card of ${employee(ME).name}`)
    toast(`Card ${frozen ? 'locked' : 'unlocked'}`, 'info', 'company')
  }
}

/** Final. Open holds stay until they clear; a replacement is a new card with a new number. */
export function cancelCard() {
  const c = state.card
  if (!c || c.status === 'canceled') return
  issuer.cancelCard(c.cardId)
  setCardStatus('canceled', 'api', 'Canceled by the holder')
  update((s) => { s.card!.status = 'canceled'; s.card!.frozen = true; s.card!.lockedBy = null; s.revealed = null; s.wallet = '' })
  toast(COPY.card.canceled, 'info')
}

export async function replaceCard() {
  update((s) => { s.cardBusy = 'issuing' })
  await issueNewCard()
  update((s) => { s.cardBusy = '' })
  toast(COPY.card.replaced, 'success')
}

export async function revealCard() {
  if (!state.card) return
  update((s) => { s.cardBusy = 'revealing' })
  const d = await issuer.revealDetails(state.card.cardId)
  const token = ++revealToken
  update((s) => { s.revealed = d; s.cardBusy = '' })
  setTimeout(() => { if (token === revealToken) update((s) => { s.revealed = null }) }, 15000)
}
let revealToken = 0
export const hideCard = () => { revealToken++; update((s) => { s.revealed = null }) }

const liveCurrency = (): CurrencyCode => state.withdraw.currency
const liveCountry = () => CURRENCIES[liveCurrency()].code

function declined(req: issuer.AuthRequest, reason: string) {
  logEvent('issuer', 'authorization.request', req.authId, 'declined', `${reason} (${classifyDecline(reason).category})`)
  return { approved: false, reason }
}

// The issuer calls this for every authorization: "does the cardholder have available funds, and do the rules allow it?"
// Everything here is synchronous and local on purpose: the real call has to answer in milliseconds.
issuer.setAuthWebhook((req) => {
  // Idempotent: the same authorization arriving twice gets the same answer and no second hold.
  if (state.holds.some((h) => h.authId === req.authId)) {
    logEvent('issuer', 'authorization.request', req.authId, 'duplicate ignored', 'A hold already exists for this authorization. No second hold')
    return { approved: true }
  }
  const forced = consumeDecline()
  const ctl = state.cardCtl
  if (forced === 'fraud') return declined(req, 'fraud_suspected')
  if (forced === 'cvv3ds') return declined(req, 'cvv_3ds_failed')
  if (forced === 'mcc' || BLOCKED_MCCS.includes(req.mcc)) return declined(req, 'mcc_blocked')
  const country = req.country ?? liveCountry()
  if (BLOCKED_COUNTRIES.includes(country)) return declined(req, 'country_blocked')
  if (!ctl.international && country !== liveCountry()) return declined(req, 'international_off')
  if (!ctl.online && req.channel === 'online') return declined(req, 'online_off')
  if (req.amount > ctl.perTxnUsd * 100) return declined(req, 'limit_per_payment')
  if (state.spentToday + req.amount > ctl.dailyUsd * 100) return declined(req, 'limit_daily')
  const bal = ledger.employee(ME)
  if (forced === 'insufficient') return declined(req, 'insufficient_funds')
  if (bal.available < req.amount) {
    // Distinguish "you have the money but it is not available yet" from "you do not have enough".
    return declined(req, bal.available + bal.pending >= req.amount ? 'funds_pending' : bal.available + bal.pending + bal.onHold >= req.amount ? 'funds_on_hold' : 'insufficient_funds')
  }
  ledger.post(acct.available(ME), acct.held(ME), req.amount, `Authorization hold ${req.authId}`, `hold:${req.authId}`)
  createHold(req.authId, req.amount)
  logEvent('issuer', 'authorization.request', req.authId, 'processed', `Approved ${usd(req.amount)}, hold placed`)
  return { approved: true }
})

function createHold(authId: string, amount: Cents) {
  update((s) => {
    s.holds.unshift({ authId, amount, status: 'active', createdAt: Date.now(), expiresOn: addDays(s.clock, HOLD_DAYS) })
    s.spentToday += amount
  })
}
const setHold = (authId: string, status: 'posted' | 'released' | 'expired') =>
  update((s) => { const h = s.holds.find((x) => x.authId === authId); if (h) h.status = status })

// Stand-in: the issuer approved alone because we did not answer. We create the hold afterwards.
issuer.setStandInHook((req) => {
  const fromAvail = Math.min(ledger.employee(ME).available, req.amount)
  ledger.postMany([
    { from: acct.available(ME), to: acct.held(ME), amount: fromAvail, memo: `Stand-in hold ${req.authId}` },
    { from: acct.receivable(ME), to: acct.held(ME), amount: req.amount - fromAvail, memo: `Stand-in: program fronts the hold ${req.authId}` },
  ], `hold:${req.authId}`)
  createHold(req.authId, req.amount)
  logEvent('issuer', 'authorization.stand_in', req.authId, 'processed', `No answer from the platform. Issuer approved ${usd(req.amount)} under the stand-in limit. Hold created afterwards`)
})

const scheduledClearings = new Map<string, { timer: ReturnType<typeof setTimeout>; finalAmount: Cents; spreadPct: number }>()

/** The amount a merchant asks for by default, in cents of the merchant's currency. */
export function merchantDefault(merchantId: string): Cents {
  const m = MERCHANTS.find((x) => x.id === merchantId)!
  return m.pricing === 'usd' ? toCents(m.defaultUsd) : Math.round(m.defaultUsd * FX.mid[liveCurrency()]) * 100
}

/** What a purchase costs on the USD card. A local merchant converts at a visible rate; a USD one does not. */
export function cardCharge(merchantId: string, amount: Cents) {
  const m = MERCHANTS.find((x) => x.id === merchantId)!
  if (m.pricing === 'usd') return { usdCents: amount, rate: null, mid: null, currency: 'USD' as const, spreadPct: 0 }
  const sp = spreadForUser()
  const mid = FX.mid[liveCurrency()]
  const rate = mid * (1 - sp)
  return { usdCents: Math.round(amount / rate), rate, mid, currency: liveCurrency(), spreadPct: sp }
}

/** amount is what the merchant charges, in cents of the merchant's currency. */
export async function payWithCard(merchantId: string, merchantAmount: Cents) {
  const m = MERCHANTS.find((x) => x.id === merchantId)!
  if (!state.card || merchantAmount <= 0) return
  const { usdCents: amount, rate, mid, currency, spreadPct } = cardCharge(merchantId, merchantAmount)
  const fx: CardFx = { price: merchantAmount, currency, mid, rate, spreadPct, spreadBy: state.mode === 'indie' ? null : state.company.name, authorized: amount }
  const subtitle = currency === 'USD' ? 'Compra en USD' : `${local(merchantAmount / 100, currency)} a ${rate!.toFixed(2)}`
  const name = m.name.replace(/ \(.*\)/, '')
  update((s) => { s.cardBusy = 'paying'; s.lastPayment = null })
  const res = await issuer.authorize({ cardId: state.card.cardId, amount, merchant: m.name, mcc: m.mcc, country: m.country, channel: m.channel })
  if (!res.approved) {
    transition('transaction', res.authId, 'declined', 'webhook', res.reason ?? 'unknown')
    const code = res.reason ?? 'unknown'
    const message = code === 'card_frozen' && state.card?.lockedBy === 'company' ? COPY.card.lockedByCompany : COPY.declines[code] ?? COPY.declines.unknown
    addActivity({ id: res.authId, kind: 'card', title: name, subtitle, amount: -amount, status: 'declined', note: message, fx })
    update((s) => { s.cardBusy = ''; s.lastPayment = { ok: false, message, code, activityId: res.authId } })
    toast(`${name}: rechazada`, 'error')
    return
  }
  transition('transaction', res.authId, 'pending', 'webhook', `Authorized ${usd(amount)}${res.standIn ? ' (stand-in)' : ''}`)
  addActivity({ id: res.authId, kind: 'card', title: name, subtitle, amount: -amount, status: 'authorized', fx, note: res.standIn ? 'Aprobada por el emisor mientras no respondíamos. Se concilia después' : 'Autorizada. Se contabiliza al liquidarse' })
  update((s) => { s.lastOpenAuth = res.authId })
  toast(`${name}: ${usd(amount)} aprobado`, 'success')
  update((s) => { s.cardBusy = ''; s.lastPayment = { ok: true, code: 'approved', activityId: res.authId, message: `Aprobaste ${usd(amount)} en ${name}${currency === 'USD' ? '' : ` (${local(merchantAmount / 100, currency)})`}. Queda como autorizada hasta que el comercio la liquide.${res.standIn ? ' No alcanzamos a responder a tiempo, así que el emisor la aprobó bajo su límite de emergencia.' : ''}` } })
  const finalAmount = Math.round(amount * m.clearRatio)
  const authId = res.authId
  scheduledClearings.set(authId, { finalAmount, spreadPct, timer: later(() => void runClearing(authId, finalAmount, spreadPct), TIMING.clearingSeconds * 1000) })
}

async function runClearing(authId: string, finalAmount: Cents, spreadPct: number) {
  scheduledClearings.delete(authId)
  const c = await issuer.clear(authId, finalAmount)
  if (!c) return
  deliver('issuer', 'transaction.completed', `clr:${authId}`, () => postClearing(authId, c.authorized, c.finalAmount, spreadPct), `Final amount ${usd(c.finalAmount)}`)
}

function postClearing(authId: string, authorized: Cents, finalAmount: Cents, spreadPct: number) {
  // The final amount settles to the issuer. It comes from the hold first, then the available balance.
  // If that is not enough, the program covers the rest and recovers it from the next payment.
  const fromHeld = Math.min(finalAmount, authorized)
  const over = finalAmount - fromHeld
  const fromAvailable = Math.min(over, ledger.employee(ME).available)
  const shortfallAmount = over - fromAvailable
  ledger.postMany([
    { from: acct.held(ME), to: acct.issuerSettlement, amount: fromHeld, memo: `Clearing ${authId}` },
    { from: acct.held(ME), to: acct.available(ME), amount: authorized - fromHeld, memo: `Release unused hold ${authId}` },
    { from: acct.available(ME), to: acct.issuerSettlement, amount: fromAvailable, memo: `Clearing above authorization ${authId}` },
    { from: acct.receivable(ME), to: acct.issuerSettlement, amount: shortfallAmount, memo: `Program covers shortfall ${authId}` },
    // Our FX markup never goes to the network, so it comes out of what we still have to settle.
    ...spreadPostings(acct.issuerSettlement, Math.round(finalAmount * spreadPct), `Card FX spread ${authId}`, spreadPct),
    { from: acct.networkInterchange, to: acct.revenue.interchange, amount: Math.round(finalAmount * FEES.interchangeNetPct), memo: `Interchange, assumed net ${authId}` },
  ], `clr:${authId}`)
  setHold(authId, 'posted')
  transition('transaction', authId, 'completed', 'webhook', `Cleared for ${usd(finalAmount)}`)
  const note = finalAmount < authorized ? `Liquidada por ${usd(finalAmount)}. Se liberó el resto de la reserva`
    : shortfallAmount > 0 ? `Liquidada por ${usd(finalAmount)}, más que lo autorizado. ${usd(shortfallAmount)} se descuentan de tu próximo pago`
    : over > 0 ? `Liquidada por ${usd(finalAmount)}: ${usd(over)} más que lo autorizado, tomados de tu saldo`
    : undefined
  patchActivity(authId, { status: 'cleared', amount: -finalAmount, note })
}

/** Demo control: the clearing file arrives now. */
export function runClearingNow() {
  scheduledClearings.forEach(({ timer, finalAmount, spreadPct }, id) => {
    clearTimeout(timer)
    void runClearing(id, finalAmount, spreadPct)
  })
}

/** Demo control: the daily settlement. What cleared is paid out, so the amount waiting goes to zero. */
export function runSettlement() {
  const toSettle = ledger.balance(acct.issuerSettlement)
  if (toSettle <= 0) return
  ledger.post(acct.issuerSettlement, acct.networkSettlement, toSettle, 'Daily settlement: USDC off-ramped to USD, sponsor pays network, network pays acquirer')
  toast(`Daily settlement: ${usd(toSettle)} paid to the card network`, 'info', 'company')
  void anchor('settlement', `Daily settlement ${usd(toSettle)}`, toSettle)
}

// ── FX quote and withdrawal ─────────────────────────────────────────────────
export async function requestQuote() {
  const w = state.withdraw
  const cents = parseAmount(w.amountUsd)
  const available = ledger.employee(ME).available
  if (!cents) return update((s) => { s.withdraw.error = 'Escribe un monto válido.' })
  if (cents > available) return update((s) => { s.withdraw.error = `Puedes retirar hasta ${usd(available)}. No incluye saldo pendiente.` })
  // Bank details come first, so the quote countdown never runs while someone is typing an account number.
  if (!w.bank.bank) return update((s) => { s.withdraw.error = 'Elige un banco.' })
  const formatError = bank.validateFormat(w.currency, w.bank)
  if (formatError) return update((s) => { s.withdraw.error = formatError })
  update((s) => { s.withdraw.phase = 'quoting'; s.withdraw.error = null })
  const q = await stablecoin.getQuote(cents, w.currency, state.freeWithdrawals > 0, spreadForUser())
  update((s) => { s.withdraw.quote = q; s.withdraw.phase = 'quote' })
}

export async function confirmWithdrawal() {
  const w = state.withdraw
  const q = w.quote!
  if (ledger.employee(ME).available < q.usd) return update((s) => { s.withdraw.error = COPY.withdraw.balanceChanged })
  update((s) => { s.withdraw.phase = 'processing'; s.withdraw.error = null })
  try {
    await stablecoin.redeemQuote(q.id) // fails if the quote expired
  } catch {
    return update((s) => { s.withdraw.phase = 'quote'; s.withdraw.error = COPY.withdraw.quoteExpired })
  }
  const id = nextId('wd')
  const net = q.usd - q.fee - q.spreadUsd
  try {
    // One atomic debit: a partial failure can never leave money in limbo.
    ledger.postMany([
      { from: acct.available(ME), to: acct.payoutInTransit, amount: net, memo: 'Withdrawal debit' },
      ...spreadPostings(acct.available(ME), q.spreadUsd, 'FX spread', q.spreadPct),
      { from: acct.available(ME), to: acct.revenue.withdrawalFee, amount: q.fee, memo: 'Withdrawal fee' },
    ])
  } catch (e) {
    stablecoin.releaseQuote(q.id)
    const msg = e instanceof InsufficientFundsError ? COPY.withdraw.balanceChanged : 'No pudimos iniciar el retiro.'
    return update((s) => { s.withdraw.phase = 'quote'; s.withdraw.error = msg })
  }
  addActivity({ id, kind: 'withdrawal', title: `Retiro a ${w.bank.bank}`, subtitle: `Transferencia en ${q.currency}`, amount: -q.usd, status: 'processing', note: 'Enviando a tu banco' })
  const r = await bank.payout(w.currency, w.bank)
  if (r.ok) {
    ledger.post(acct.payoutInTransit, acct.bankOut, net, 'Payout settled')
    patchActivity(id, { status: 'completed', note: `Ref. ${r.reference}` })
    update((s) => {
      s.withdraw.phase = 'success'
      if (q.fee === 0 && s.freeWithdrawals > 0) s.freeWithdrawals--
      s.withdraw.receipt = { reference: r.reference, localAmount: q.localAmount, currency: q.currency }
    })
  } else {
    // Reverse everything: the money goes back to the available balance. New details need a new quote.
    ledger.postMany([
      { from: acct.payoutInTransit, to: acct.available(ME), amount: net, memo: 'Payout failed: reversal' },
      ...spreadPostings(acct.available(ME), q.spreadUsd, 'Payout failed: spread reversal', q.spreadPct, true),
      { from: acct.revenue.withdrawalFee, to: acct.available(ME), amount: q.fee, memo: 'Payout failed: fee reversal' },
    ])
    patchActivity(id, { status: 'failed', note: 'Tu banco rechazó los datos de la cuenta. El dinero volvió a tu saldo' })
    update((s) => { s.withdraw.phase = 'amount'; s.withdraw.quote = null; s.withdraw.error = COPY.withdraw.bankRejected })
  }
}

export const backToWithdrawForm = () =>
  update((s) => { Object.assign(s.withdraw, { phase: 'amount', quote: null, error: null }) })

export const resetWithdrawal = () =>
  update((s) => { Object.assign(s.withdraw, { phase: 'amount', amountUsd: '', quote: null, error: null, receipt: null }) })

// ── Demo helper: jump straight to an active account ─────────────────────────
export async function skipToActive(withCardPayment = true) {
  if (state.step === 'accountCreated') return startUsing()
  setFast(true)
  try {
    flags.kycUnreadable = false
    flags.kycManualReview = false
    flags.kycRejected = false
    update((s) => { s.consent = { terms: true, kyc: true, optIn: true }; s.kyc.idPhoto = true; s.kyc.selfie = true })
    await submitKyc()
    await opening
    startUsing()
    if (state.mode === 'indie') {
      if (state.activity.length === 0) await receiveFromUs(120000, 'Cliente en EE. UU.')
    } else if (payoutsOf(ME).length === 0) await runPayroll({ autoFund: true, internal: true })
    await wait(50)
    releasePending()
    if (withCardPayment) {
      await payWithCard('coffee', merchantDefault('coffee'))
      await wait(50)
      await payWithCard('store', merchantDefault('store'))
      await wait(50)
    }
  } finally {
    setFast(false)
    update((s) => { s.toast = null }) // a jump ahead should not leave messages from the skipped steps
  }
}

// ── FX spread split ─────────────────────────────────────────────────────────
/** The spread this person pays: the one their company set, or the standard one if they have no company. */
export const spreadForUser = () => (state.mode === 'indie' ? FX.spreadPct : currentSpread())

/** Splits a spread at the rate it was quoted. The platform keeps its floor, the company keeps the rest. An independent has no company. */
export function spreadPostings(from: string, total: Cents, memo: string, pct: number, reverse = false) {
  const platform = state.mode === 'indie' || pct <= FX.platformFloorPct ? total : Math.round((total * FX.platformFloorPct) / pct)
  const company = total - platform
  const mk = (to: string, amount: Cents, m: string) => reverse ? { from: to, to: from, amount, memo: m } : { from, to, amount, memo: m }
  return [mk(acct.revenue.fxSpread, platform, `${memo} (platform)`), mk(acct.companyMarkup, company, `${memo} (company markup)`)]
}

export function setSpread(pct: number) {
  if (!guard('pricing')) return
  const v = Math.min(FX.maxPct, Math.max(FX.platformFloorPct, pct))
  update((s) => { s.company.spreadPct = v })
  audit(`Set the FX spread to ${(v * 100).toFixed(2)}%`)
}

export function setCompanyLimits(perPaymentUsd: number, dailyUsd: number) {
  if (!guard('pricing')) return
  update((s) => { s.company.limits = { perPaymentUsd, dailyUsd }; s.cardCtl.perTxnUsd = Math.min(s.cardCtl.perTxnUsd, perPaymentUsd); s.cardCtl.dailyUsd = Math.min(s.cardCtl.dailyUsd, dailyUsd) })
  audit(`Set the card limits inherited by holders: ${usd(perPaymentUsd * 100)} per payment, ${usd(dailyUsd * 100)} per day`)
}

// ── Card controls ───────────────────────────────────────────────────────────
export function setCardLimits(p: Partial<typeof state.cardCtl>) {
  update((s) => {
    Object.assign(s.cardCtl, p)
    s.cardCtl.perTxnUsd = Math.min(s.cardCtl.perTxnUsd, state.mode === 'indie' ? 5000 : s.company.limits.perPaymentUsd)
    s.cardCtl.dailyUsd = Math.min(s.cardCtl.dailyUsd, state.mode === 'indie' ? 10000 : s.company.limits.dailyUsd)
  })
}

export function addToWallet() {
  update((s) => { s.walletBusy = 'apple' })
  setTimeout(() => { update((s) => { s.wallet = 'apple'; s.walletBusy = '' }); toast('Tarjeta agregada a Apple Wallet', 'success') }, 2800)
}
export const removeFromWallet = () => update((s) => { s.wallet = '' })

// ── Merchant-side events: incremental auth, partial reversal, refund, orphan clearing ──
export function incrementLastAuth(extra: Cents = toCents(40)) {
  const id = state.lastOpenAuth
  const sched = scheduledClearings.get(id)
  if (!id || !sched || !issuer.isKnownAuth(id)) return toast('Sin autorización abierta. Haz una compra primero (el hotel es buena opción)', 'info')
  if (ledger.employee(ME).available < extra) {
    patchActivity(id, { note: `Se rechazó un aumento de ${usd(extra)}: saldo insuficiente. Se mantiene la reserva original` })
    logEvent('issuer', 'authorization.incremental', id, 'declined', `Declined +${usd(extra)}`)
    return toast('Aumento de autorización rechazado', 'error')
  }
  ledger.post(acct.available(ME), acct.held(ME), extra, `Incremental authorization ${id}`)
  issuer.adjust(id, extra)
  sched.finalAmount += extra
  const total = issuer.authAmount(id)!
  update((s) => { const h = s.holds.find((x) => x.authId === id); if (h) h.amount = total; s.spentToday += extra })
  patchActivity(id, { amount: -total, note: `El comercio aumentó la autorización en ${usd(extra)}. Reserva actual: ${usd(total)}` })
  logEvent('issuer', 'authorization.incremental', id, 'processed', `+${usd(extra)}, hold ${usd(total)}`)
  toast(`Reserva aumentada en ${usd(extra)}`, 'info')
}

export function partialReversalLastAuth(part: Cents = toCents(10)) {
  const id = state.lastOpenAuth
  const sched = scheduledClearings.get(id)
  const cur = issuer.authAmount(id)
  if (!id || !sched || !cur || part >= cur) return toast('Sin autorización abierta para reversar', 'info')
  ledger.post(acct.held(ME), acct.available(ME), part, `Partial reversal ${id}`)
  issuer.adjust(id, -part)
  sched.finalAmount = Math.min(sched.finalAmount, cur - part)
  update((s) => { const h = s.holds.find((x) => x.authId === id); if (h) h.amount = cur - part; s.spentToday = Math.max(0, s.spentToday - part) })
  patchActivity(id, { amount: -(cur - part), note: `Reverso parcial de ${usd(part)}, ya disponible. Reserva actual: ${usd(cur - part)}` })
  logEvent('issuer', 'authorization.reversal', id, 'processed', `-${usd(part)}`)
  toast(`${usd(part)} volvieron a tu saldo`, 'info')
}

/** Ends an open authorization without clearing: the merchant reversed it, or it expired. */
function closeAuthorization(id: string, to: 'reversed' | 'expired') {
  const sched = scheduledClearings.get(id)
  const hold = state.holds.find((h) => h.authId === id && h.status === 'active')
  if (!hold) return
  if (sched) { clearTimeout(sched.timer); scheduledClearings.delete(id) }
  issuer.closeAuth(id)
  ledger.post(acct.held(ME), acct.available(ME), hold.amount, `${to === 'reversed' ? 'Full reversal' : 'Authorization expired'} ${id}`, `close:${id}`)
  setHold(id, to === 'reversed' ? 'released' : 'expired')
  transition('transaction', id, to, 'webhook', to === 'reversed' ? 'Merchant reversed before clearing' : 'Never cleared')
  update((s) => { s.spentToday = Math.max(0, s.spentToday - hold.amount); if (s.lastOpenAuth === id) s.lastOpenAuth = '' })
  patchActivity(id, { status: to, note: to === 'reversed' ? 'El comercio la reversó. La reserva volvió a tu saldo' : 'El comercio nunca la liquidó. La reserva volvió a tu saldo' })
  logEvent('issuer', to === 'reversed' ? 'authorization.reversal' : 'authorization.expired', id, 'processed', `${usd(hold.amount)} released`)
}
export function reverseLastAuth() {
  if (!state.lastOpenAuth) return toast('Sin autorización abierta para reversar', 'info')
  closeAuthorization(state.lastOpenAuth, 'reversed')
}
export function expireLastAuth() {
  if (!state.lastOpenAuth) return toast('Sin autorización abierta', 'info')
  closeAuthorization(state.lastOpenAuth, 'expired')
}

const refunded = new Set<string>()
export function refundLast() {
  const item = state.activity.find((a) => a.kind === 'card' && a.status === 'cleared' && !refunded.has(a.id))
  if (!item) return toast('Aún no hay compras liquidadas para reembolsar', 'info')
  refunded.add(item.id)
  const amt = Math.abs(item.amount)
  ledger.post(acct.networkRefunds, acct.available(ME), amt, `Merchant refund ${item.id}`, `refund:${item.id}`)
  addActivity({ id: `rf_${item.id}`, kind: 'card', title: `Reembolso: ${item.title}`, subtitle: 'Devuelto por el comercio', amount: amt, status: 'completed', note: 'Volvió a tu saldo disponible' })
  logEvent('issuer', 'refund.received', item.id, 'processed', `+${usd(amt)}`)
  toast(`Recibiste un reembolso de ${usd(amt)}`, 'success')
}

/** The network clears a charge we never authorized. The program pays the network and parks it in suspense. */
export function clearingWithoutAuth(amount: Cents = toCents(18)) {
  const id = `auth_orphan_${++uid}`
  ledger.post(acct.suspense, acct.issuerSettlement, amount, `Clearing without authorization ${id}`, `clr:${id}`)
  raiseException('clearing_without_auth', amount, `The network cleared ${usd(amount)} for ${id}. There was no authorization. Parked in suspense`)
  logEvent('issuer', 'clearing.received', id, 'exception', 'No matching authorization. Posted to suspense, not to the cardholder')
  toast('Clearing without authorization: sent to Compliance as an exception', 'error', 'company')
}

export function resolveSuspense(exId: string, how: 'charge' | 'writeoff' | 'recover') {
  if (!guard('approve')) return
  const x = state.exceptions.find((e) => e.id === exId)
  if (!x || x.status === 'resolved') return
  if (x.kind === 'reconciliation_break') {
    resolveException(exId, 'Investigated and explained')
  } else if (x.kind === 'clearing_without_auth') {
    if (how === 'charge') {
      const fromAvail = Math.min(ledger.employee(ME).available, x.amount)
      ledger.postMany([
        { from: acct.available(ME), to: acct.suspense, amount: fromAvail, memo: `Matched to the cardholder ${exId}` },
        { from: acct.receivable(ME), to: acct.suspense, amount: x.amount - fromAvail, memo: `Matched, shortfall recovered later ${exId}` },
      ], `resolve:${exId}`)
      addActivity({ id: `m_${exId}`, kind: 'card', title: 'Cargo de tarjeta (asociado después)', subtitle: 'Revisado por nuestro equipo', amount: -x.amount, status: 'cleared', note: 'El cargo llegó sin autorización y nuestro equipo lo asoció a tu tarjeta' })
      resolveException(exId, 'Charged to the cardholder')
    } else {
      ledger.post(acct.losses, acct.suspense, x.amount, `Write-off ${exId}`, `resolve:${exId}`)
      resolveException(exId, 'Written off as an operating loss')
    }
  } else if (how === 'writeoff') {
    // A wrong-network deposit was never credited, so there is nothing to post.
    resolveException(exId, 'Could not be recovered. Nothing was credited')
    if (x.kind.endsWith('user')) toast('No fue posible recuperar tu depósito en la red equivocada', 'error')
  } else {
    // Wrong network: the custodian recovers the funds manually, minus a recovery fee.
    const fee = Math.min(500, x.amount)
    const user = x.kind.endsWith('user')
    const recovered = x.amount - fee
    ledger.postMany([
      { from: acct.wireIn, to: user ? acct.pending(ME) : acct.company, amount: recovered, memo: `Recovered deposit ${exId}` },
      { from: acct.wireIn, to: acct.partnerFees, amount: fee, memo: `Recovery fee ${exId}` },
    ], `resolve:${exId}`)
    resolveException(exId, `Recovered by the custodian, ${usd(fee)} recovery fee`)
    if (user) {
      const id = `rec_${exId}`
      addActivity({ id, kind: 'deposit', title: 'Depósito recuperado', subtitle: 'Caso de soporte', amount: recovered, status: 'pending', note: 'Recuperado de la red equivocada' })
      pendingDeposits.push({ id, amount: recovered })
      releaseUserDeposits()
    }
  }
  audit(`Resolved exception ${exId}`)
}

// ── Reconciliation ──────────────────────────────────────────────────────────
/** Compares the ledger with what the outside world reports. A difference becomes an exception, never a silent fix. */
export function runReconciliation() {
  const drift = consume('custodyDrift') ? toCents(25) : 0
  const funds = ledger.internalTotal()
  const activeHolds = state.holds.filter((h) => h.status === 'active').reduce((sum, h) => sum + h.amount, 0)
  const toSettle = ledger.balance(acct.issuerSettlement)
  const rows = [
    { label: 'Funds held for customers and the platform', ledger: funds, other: funds - drift, otherLabel: 'Custodian statement' },
    { label: 'Open card authorizations', ledger: ledger.employee(ME).held, other: activeHolds, otherLabel: 'Active holds' },
    { label: 'Cleared, not settled yet', ledger: toSettle, other: toSettle, otherLabel: 'Issuer settlement report' },
    { label: 'Sum of all accounts', ledger: ledger.total(), other: 0, otherLabel: 'Must be zero' },
  ]
  const ok = rows.every((r) => r.ledger === r.other)
  update((s) => { s.recon = { ts: Date.now(), rows, ok } })
  if (drift) raiseException('reconciliation_break', drift, `The custodian statement is ${usd(drift)} below the ledger. Nothing was adjusted automatically`)
  audit(ok ? 'Daily reconciliation: everything matches' : 'Daily reconciliation: difference found')
  toast(ok ? 'Reconciliation: everything matches' : 'Reconciliation found a difference. See Compliance', ok ? 'success' : 'error', 'company')
}

// ── Out-of-order and early provider events ──────────────────────────────────
/** An old "pending" event arrives after a final state. The machine refuses the move. */
export function sendStaleEvent() {
  const done = Object.entries(state.fsm.transaction).find(([, st]) => st !== 'pending')?.[0]
  if (done) {
    const moved = transition('transaction', done, 'pending', 'webhook', 'Late event')
    logEvent('issuer', 'transaction.updated', `stale_${nextId('s')}`, moved ? 'processed' : 'stale ignored', `Transaction ${done} is already "${current('transaction', done)}". A late "pending" cannot move it back`)
  } else if (current('kyc', ME) === 'approved') {
    const moved = transition('kyc', ME, 'pending', 'webhook', 'Late event')
    logEvent('identity', 'applicant.pending', `stale_${nextId('s')}`, moved ? 'processed' : 'stale ignored', 'Applicant is already "approved". A late "pending" cannot move it back')
  } else {
    toast('Finish KYC or make a purchase first, so there is a final state to protect', 'info', 'company')
  }
}

/** A clearing event arrives before its authorization is known. It waits and retries instead of failing. */
export function sendEarlyEvent() {
  let known = false
  const key = `early_${nextId('e')}`
  deliver('issuer', 'transaction.completed', key, () => {}, 'Processed once its authorization arrived', { ready: () => known })
  later(() => { known = true; logEvent('issuer', 'transaction.created', key, 'processed', 'The authorization it was waiting for arrived') }, 1200)
}

// ── Independent user: add money ─────────────────────────────────────────────
const pendingDeposits: { id: string; amount: Cents }[] = []

/** Every way an independent adds money ends the same way: a funding intent, then a custodian confirmation. */
async function startUserDeposit(o: { via: string; title: string; subtitle: string; amount: Cents; postings: () => { from: string; to: string; amount: Cents; memo: string }[]; wrongNetworkPossible?: boolean }) {
  const id = nextId('dep')
  const f = newFunding('user', o.amount, o.via, nextId('req'), id)
  if (flags.custodyDown) {
    transition('funding', f.id, 'queued', 'system', 'Custodian unavailable')
    queuedCredits.set(f.id, () => creditUser(f, o, id))
    update((s) => { s.custodyQueue.push({ fundingId: f.id, at: Date.now() }) })
    addActivity({ id, kind: 'deposit', title: o.title, subtitle: 'Esperando a nuestro aliado de custodia', amount: o.amount, status: 'processing', note: 'Lo detectamos, pero la acreditación está demorada. Llegará sola' })
    logEvent('custodian', 'deposit.detected', f.id, 'queued', 'Custodian unavailable. Queued')
    return toast('Detectamos tu recarga. Una falla de un aliado la demora. Tu dinero está seguro', 'info')
  }
  if (o.wrongNetworkPossible && consume('wrongNetwork')) {
    transition('funding', f.id, 'detected', 'webhook', 'Seen on an unsupported network')
    transition('funding', f.id, 'failed', 'system', 'Wrong network: not credited')
    raiseException('wrong_network_user', o.amount, `${usd(o.amount)} sent on a network not supported for this address. Not credited`)
    addActivity({ id, kind: 'deposit', title: o.title, subtitle: 'Red equivocada', amount: o.amount, status: 'failed', note: 'Llegó por una red que esta dirección no admite. No se acreditó. Nuestro equipo puede intentar recuperarlo' })
    return toast('Recarga por la red equivocada. No se acreditó', 'error')
  }
  addActivity({ id, kind: 'deposit', title: o.title, subtitle: o.subtitle, amount: o.amount, status: 'pending', note: 'Pendiente: aún no se puede gastar' })
  await creditUser(f, o, id)
}

async function creditUser(f: Funding, o: { title: string; subtitle: string; amount: Cents; postings: () => { from: string; to: string; amount: Cents; memo: string }[] }, activityId: string) {
  await wait(900)
  transition('funding', f.id, 'detected', 'webhook', 'Seen by the custodian, waiting for confirmations')
  patchActivity(activityId, { subtitle: o.subtitle, status: 'pending', note: 'Pendiente: aún no se puede gastar' })
  deliver('custodian', 'deposit.confirmed', `udep:${f.id}`, () => {
    ledger.postMany(o.postings(), `udep:${f.id}`)
    transition('funding', f.id, 'confirmed', 'webhook', 'Custodian confirmed. Ledger credited as pending')
    pendingDeposits.push({ id: activityId, amount: o.amount })
    if (!flags.keepPending) later(releaseUserDeposits, TIMING.pendingSeconds * 1000)
  }, `${usd(o.amount)} detected, waiting for final checks`)
}

/** A person pays in local currency. The rate is fixed when the money arrives, so this is an estimate. */
export function quoteTopUp(localCents: Cents) {
  const currency = liveCurrency()
  const mid = FX.mid[currency]
  const spreadPct = FX.spreadPct
  const rate = mid * (1 + spreadPct)
  const usdGross = Math.round(localCents / mid)
  const usdNet = Math.round(localCents / rate)
  return { currency, mid, rate, spreadPct, spreadUsd: usdGross - usdNet, usdNet, localCents }
}

export async function topUpLocal(localCents: Cents) {
  const q = quoteTopUp(localCents)
  await startUserDeposit({
    via: `local ${q.currency}`, title: `Recarga en ${q.currency}`, subtitle: `${local(localCents / 100, q.currency)} a ${q.rate.toFixed(2)}`, amount: q.usdNet,
    postings: () => [
      { from: acct.localIn, to: acct.pending(ME), amount: q.usdNet, memo: `Local top-up ${local(localCents / 100, q.currency)}` },
      { from: acct.localIn, to: acct.revenue.fxSpread, amount: q.spreadUsd, memo: 'FX spread on top-up (platform)' },
    ],
  })
}

/** A client in the US pays the person's own account details. It arrives as digital dollars. */
export async function receiveFromUs(amount: Cents, sender: string) {
  await startUserDeposit({
    via: 'US account', title: `Pago de ${sender}`, subtitle: 'Recibido en tus datos de EE. UU.', amount,
    postings: () => [{ from: acct.usInbound, to: acct.pending(ME), amount, memo: `Inbound US payment from ${sender}` }],
  })
}

export const DIGITAL_NETWORKS = ['Base', 'Solana', 'Ethereum'] as const
/** The person already has digital dollars elsewhere and sends them to their own deposit address. */
export async function depositDigital(network: string, amount: Cents) {
  await startUserDeposit({
    via: `${network} network`, title: `Dólares digitales desde red ${network}`, subtitle: 'Esperando confirmaciones', amount, wrongNetworkPossible: true,
    postings: () => [{ from: acct.wireIn, to: acct.pending(ME), amount, memo: `Digital deposit on ${network}` }],
  })
}

function releaseUserDeposits() {
  if (flags.keepPending) return
  while (pendingDeposits.length) {
    const d = pendingDeposits.shift()!
    ledger.post(acct.pending(ME), acct.available(ME), d.amount, 'Deposit confirmed: pending to available', `release:${d.id}`)
    patchActivity(d.id, { status: 'completed', note: 'Confirmado. Disponible' })
    update((s) => { s.freeWithdrawals++ })
    toast('Tu recarga ya está disponible', 'success')
  }
}

// ── Independent signup ──────────────────────────────────────────────────────
export function signUpIndependent(email: string, password: string, country: string): string | null {
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Escribe un correo válido.'
  if (password.length < 8) return 'Usa al menos 8 caracteres.'
  const currency = (Object.keys(CURRENCIES) as CurrencyCode[]).find((c) => CURRENCIES[c].code === country) ?? liveCurrency()
  update((s) => { s.signup = { email, password, country, error: '' }; s.withdraw.currency = currency; s.step = 'consent' })
  return null
}

// ── Company: KYB, team, invitations, schedules ──────────────────────────────
export function signUpCompany(f: { name: string; email: string; person: string; country: string; ubos: { name: string; share: number }[] }) {
  const open = ledger.balance(acct.company)
  if (open > 0) ledger.post(acct.company, acct.wireIn, open, 'New company workspace starts empty')
  update((s) => {
    s.auth = { email: f.email, name: f.person, role: 'admin' }
    s.audit = [] // a new company does not inherit another company's history
    s.pendingDeposits = []
    s.addFunds = null
    s.company = { ...s.company, name: f.name, kyb: 'init', kybNote: 'Not submitted', seeded: false,
      team: [{ id: nextId('t'), name: f.person, email: f.email, role: 'admin', status: 'active', kyc: 'pending' }],
      ubos: f.ubos.map((u) => ({ ...u, kyc: 'pending' as const })) }
    s.companyPage = 'company'
  })
  audit(`Created the company account ${f.name}`, f.person)
}

export async function submitKyb() {
  update((s) => { s.company.kyb = 'pending'; s.company.kybNote = 'Documents received' })
  audit('Submitted company verification (KYB)')
  await wait(1400)
  update((s) => { s.company.kyb = 'in_review'; s.company.kybNote = 'Checking registry, owners and representatives' })
  await wait(1800)
  if (consume('kybRejected')) {
    update((s) => { s.company.kyb = 'rejected'; s.company.kybNote = 'The registry document could not be matched. This decision is final for this application' })
    return
  }
  if (consume('kybManualReview')) {
    update((s) => { s.company.kybNote = 'In the manual review queue (ownership structure needs a person to check it)' })
    return
  }
  completeKyb()
}
function completeKyb() {
  deliver('identity', 'applicant.approved', `kyb:${nextId('c')}`, () => {
    update((s) => { s.company.kyb = 'approved'; s.company.kybNote = 'Verified'; s.company.ubos.forEach((u) => (u.kyc = 'approved')); s.company.team.forEach((m) => { if (m.status === 'active') m.kyc = 'approved' }) })
  }, 'Company approved')
  toast('Company verified. You can now fund and pay', 'success', 'company')
}
/** What a compliance reviewer would do. */
export function resolveKybReview(approve: boolean) {
  if (!guard('approve') || state.company.kyb !== 'in_review') return
  if (approve) completeKyb()
  else update((s) => { s.company.kyb = 'retry'; s.company.kybNote = 'We could not read the registry extract. Upload a clearer copy and submit again' })
}
export const retryKyb = () => update((s) => { s.company.kyb = 'init'; s.company.kybNote = 'Ready to resubmit' })

export function inviteTeamMember(email: string, role: TeamRole) {
  if (!guard('team')) return
  if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Enter a valid email', 'error', 'company')
  update((s) => { s.company.team.push({ id: nextId('t'), name: email.split('@')[0], email, role, status: 'invited', kyc: 'pending' }) })
  audit(`Invited ${email} as ${role}`)
  toast(`Invitation sent to ${email}`, 'success', 'company')
}
export function acceptTeamInvite(id: string) {
  update((s) => { const m = s.company.team.find((x) => x.id === id); if (m) { m.status = 'active'; m.kyc = 'in_review' } })
  audit('A team member accepted the invitation')
}
export function approveTeamKyc(id: string) {
  if (!guard('approve')) return
  update((s) => { const m = s.company.team.find((x) => x.id === id); if (m) m.kyc = 'approved' })
}
export function setTeamRole(id: string, role: TeamRole) {
  if (!guard('team')) return
  update((s) => { const m = s.company.team.find((x) => x.id === id); if (m) m.role = role })
  audit(`Changed a team role to ${role}`)
}

export function setPersonAmount(id: string, usdAmount: number) {
  if (!guard('pay')) return
  const e = employee(id)
  update(() => { e.amountUsd = Math.max(0, Math.round(usdAmount * 100) / 100) })
}

export function schedulePayroll(runOn: number, monthly = false) {
  if (!guard('schedule') || blocked()) return
  if (runOn <= state.clock) return toast('Pick a date after today', 'error', 'company')
  const people = payableEmployees().length
  update((s) => { s.schedules.push({ id: nextId('sch'), label: `Batch for ${people} people, ${usd(batchTotal())} with fees`, runOn, status: 'scheduled', note: monthly ? 'Runs at 09:00, repeats monthly' : 'Runs at 09:00', monthly }) })
  audit(`Scheduled a payment batch for ${new Date(runOn).toDateString()}${monthly ? ', repeating monthly' : ''}`)
  toast('Batch scheduled', 'success', 'company')
}
export async function runSchedule(id: string) {
  const sch = state.schedules.find((x) => x.id === id)
  if (!sch || sch.status === 'done') return
  if (operationalBlocker()) { update(() => { sch.status = 'failed'; sch.note = 'The company is not verified' }); return }
  if (shortfall() > 0) {
    update(() => { sch.status = 'failed'; sch.note = `Not enough company balance: short by ${usd(shortfall())}. Add funds and retry` })
    return toast(`Scheduled batch failed: short by ${usd(shortfall())}`, 'error', 'company')
  }
  await runPayroll({ internal: true })
  update(() => { sch.status = 'done'; sch.note = 'Sent' })
  if (sch.monthly) {
    const next = new Date(sch.runOn)
    next.setMonth(next.getMonth() + 1)
    update((s) => { s.schedules.push({ ...sch, id: nextId('sch'), runOn: next.getTime(), status: 'scheduled', note: 'Runs at 09:00, repeats monthly' }) })
  }
}
export async function advanceClock(days: number) {
  update((s) => { s.clock = addDays(s.clock, days); s.spentToday = 0 })
  // An authorization that never cleared gives the money back when its hold expires.
  state.holds.filter((h) => h.status === 'active' && h.expiresOn <= state.clock).forEach((h) => closeAuthorization(h.authId, 'expired'))
  for (const sch of state.schedules.filter((x) => x.status === 'scheduled' && x.runOn <= state.clock)) await runSchedule(sch.id)
}

// ── Demo helper: preloaded history ──────────────────────────────────────────
export async function seedHistory() {
  if (state.activity.some((a) => a.id.startsWith('hist_'))) return
  await skipToActive(false)
  const day = 86400000
  const now = Date.now()
  const items: { id: string; kind: 'deposit' | 'card' | 'withdrawal'; title: string; subtitle: string; amount: number; days: number; note: string }[] = state.mode === 'indie' ? [
    { id: 'hist_1', kind: 'deposit', title: 'Pago de Cliente en EE. UU.', subtitle: 'Recibido en tus datos de EE. UU.', amount: 60000, days: 21, note: 'Confirmado. Disponible' },
    { id: 'hist_2', kind: 'card', title: 'Cloud Software', subtitle: 'Compra en USD', amount: -2900, days: 18, note: '' },
    { id: 'hist_3', kind: 'card', title: 'Corner Coffee', subtitle: 'Compra con tarjeta', amount: -480, days: 9, note: '' },
    { id: 'hist_4', kind: 'withdrawal', title: 'Retiro a Banco Andino', subtitle: 'Transferencia en moneda local', amount: -15000, days: 6, note: 'Ref. de ejemplo' },
    { id: 'hist_5', kind: 'deposit', title: 'Recarga en moneda local', subtitle: 'Transferencia local', amount: 25000, days: 3, note: 'Confirmado. Disponible' },
  ] : [
    { id: 'hist_1', kind: 'deposit', title: `Pago de ${COMPANY.name}`, subtitle: 'Pago de contratista', amount: 80000, days: 32, note: 'Disponible' },
    { id: 'hist_2', kind: 'card', title: 'Corner Coffee', subtitle: 'Compra con tarjeta', amount: -480, days: 28, note: '' },
    { id: 'hist_3', kind: 'card', title: 'City Fuel', subtitle: 'Compra con tarjeta', amount: -3200, days: 20, note: '' },
    { id: 'hist_4', kind: 'withdrawal', title: 'Retiro a Banco Andino', subtitle: 'Transferencia en moneda local', amount: -20000, days: 14, note: 'Ref. de ejemplo' },
    { id: 'hist_5', kind: 'deposit', title: `Pago de ${COMPANY.name}`, subtitle: 'Reembolso', amount: 12000, days: 2, note: 'Disponible' },
  ]
  for (const it of items) {
    if (it.amount > 0) ledger.post(acct.wireIn, acct.available(ME), it.amount, `History ${it.id}`)
    else ledger.post(acct.available(ME), it.kind === 'withdrawal' ? acct.bankOut : acct.networkSettlement, -it.amount, `History ${it.id}`)
  }
  update((s) => {
    for (const it of items) s.activity.push({ id: it.id, kind: it.kind, title: it.title, subtitle: it.subtitle, amount: it.amount, status: 'completed', note: it.note, ts: now - it.days * day })
    s.activity.sort((a, b) => b.ts - a.ts)
  })
  if (state.mode === 'org') {
    // Company side: two earlier batches and the revenue they produced.
    ledger.postMany([
      { from: acct.wireIn, to: acct.revenue.payoutFee, amount: 4200, memo: 'History: payout fees' },
      { from: acct.wireIn, to: acct.revenue.fxSpread, amount: 1150, memo: 'History: FX spread (platform)' },
      { from: acct.wireIn, to: acct.companyMarkup, amount: 960, memo: 'History: FX markup (company)' },
      { from: acct.wireIn, to: acct.revenue.interchange, amount: 1840, memo: 'History: interchange' },
      { from: acct.wireIn, to: acct.revenue.withdrawalFee, amount: 600, memo: 'History: withdrawal fees' },
    ])
  }
}

// ── Add funds: the one way money enters a company ───────────────────────────
let addFundsKey = 0
export const openAddFunds = (prefillCents: number | null = null) => update((s) => { s.addFunds = { key: ++addFundsKey, prefillCents } })
export const closeAddFunds = () => update((s) => { s.addFunds = null })
export const depositReference = () => `${state.company.name.replace(/[^a-z]/gi, '').slice(0, 4).toUpperCase()}-${state.company.name.length}K7Q`
export const depositsOnTheWay = () => state.pendingDeposits.reduce((sum, d) => sum + d.usdCents, 0)
export const depositLabel = (d: PendingDeposit) => (d.method === 'usd' ? 'USD account' : `Local transfer (${local((d.localCents ?? 0) / 100, d.currency!)})`)

/** The company says it sent the transfer. Only the deposit being received credits the vault. */
export function requestDeposit(d: Pick<PendingDeposit, 'method' | 'usdCents' | 'currency' | 'localCents'>): { ok: boolean; message: string } {
  if (!can('fund')) return { ok: false, message: `Your role (${state.auth?.role ?? 'none'}) cannot add funds` }
  const b = operationalBlocker()
  if (b) return { ok: false, message: b }
  if (!(d.usdCents > 0)) return { ok: false, message: 'Enter an amount above zero' }
  const dep: PendingDeposit = { ...d, id: nextId('dep'), reference: depositReference(), at: Date.now() }
  update((s) => { s.pendingDeposits.push(dep); s.addFunds = null })
  audit(`Started a deposit of ${usd(dep.usdCents)} by ${depositLabel(dep)}, reference ${dep.reference}`)
  toast(`We are waiting for your transfer of ${usd(dep.usdCents)}. It is credited when it arrives`, 'info', 'company')
  return { ok: true, message: '' }
}

/** A deposit started in Add funds reaches the company vault, the way a confirmed bank transfer would. */
export async function markDepositReceived(id: string): Promise<{ ok: boolean; message: string }> {
  const dep = state.pendingDeposits.find((d) => d.id === id)
  if (!dep) return { ok: false, message: 'That deposit is no longer on the way' }
  const before = companyBalance()
  update((s) => { s.pendingDeposits = s.pendingDeposits.filter((d) => d.id !== id) })
  await fundCompany(dep.usdCents, true, dep.id, depositLabel(dep))
  const gained = companyBalance() - before
  if (gained > 0) return { ok: true, message: `Deposit received: ${usd(gained)} credited to the ${state.company.name} vault. Balance ${usd(companyBalance())}` }
  return { ok: false, message: 'The deposit was detected but is not credited yet (custodian queue or exception). See Compliance' }
}

/** The person finished identity verification: what the company reserved for them is delivered now. */
export function deliverQueued(employeeId: string) {
  payoutsOf(employeeId).filter((p) => p.status === 'queued_kyc').forEach(deliverPayout)
}

/** One payment to one person, through the same path as a batch: fee, hold review, pending, release. */
export function payEmployee(id: string, amount: number, currency: 'USD' | CurrencyCode): { ok: boolean; message: string } {
  const e = allPeople().find((x) => x.id === id)
  if (!e) return { ok: false, message: 'Pick an employee' }
  const b = operationalBlocker()
  if (b) return { ok: false, message: b }
  const usdCents = currency === 'USD' ? toCents(amount) : Math.round((amount / (FX.mid[currency] * (1 - currentSpread()))) * 100)
  if (!(usdCents > 0)) return { ok: false, message: 'Enter an amount above zero' }
  if (!canReceive(e)) {
    const why = payRule(e.country, e.type) === 'blocked' ? `${e.type} in USD is not enabled in ${CURRENCIES[e.currency].country}` : 'This person cannot receive payments yet (approval or identity check pending)'
    return { ok: false, message: why }
  }
  const fee = payoutFee(usdCents)
  if (usdCents + fee + committedFunds() > companyBalance()) return { ok: false, message: `Not enough in the company vault for ${usd(usdCents + fee)}. Use Add funds first` }
  const batch = state.batches + 1
  update((s) => { s.batches = batch })
  audit(`Sent a payment of ${usd(usdCents)} to ${e.name}`)
  const p: Payout = { id: nextId('pay'), batch, employeeId: e.id, type: e.type, amount: usdCents, fee, status: 'queued_kyc', events: [{ ts: Date.now(), label: `Payment sent by ${COMPANY.name}` }] }
  update((s) => { s.payouts.push(p) })
  if (isVerified(e)) deliverPayout(p)
  else setPayout(p, 'queued_kyc', 'Waiting for the employee to finish KYC')
  const fx = currency === 'USD' ? '' : ` (${local(amount, currency)} at ${(FX.mid[currency] * (1 - currentSpread())).toFixed(2)})`
  const first = e.name.split(' ')[0]
  if (p.status === 'on_hold') return { ok: true, message: `${usd(usdCents)}${fx} to ${first} is on hold for review. An approver clears it in Compliance` }
  if (p.status === 'queued_kyc') return { ok: true, message: `${usd(usdCents)}${fx} is reserved for ${first}. It is delivered when ${first} finishes identity verification` }
  return { ok: true, message: `${usd(usdCents)}${fx} sent to ${first}, fee ${usd(fee)}. It shows as pending in their app and becomes available in ${TIMING.pendingSeconds} s` }
}

/** Full card number and CVV for a merchant checkout form. Same call the Card screen uses, without flipping the card. */
export async function cardDetails(): Promise<{ pan: string; cvv: string; expiry: string; holder: string } | null> {
  if (!state.card || state.card.status === 'canceled') return null
  const d = await issuer.revealDetails(state.card.cardId)
  return { ...d, expiry: state.card.expiry, holder: EMPLOYEES.find((e) => e.id === ME)!.name.toUpperCase() }
}
