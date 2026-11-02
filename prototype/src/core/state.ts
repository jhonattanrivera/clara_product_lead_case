// App state: a plain mutable object. Services mutate it with update(), the UI reads it.
import { notify } from '../bus'
import { CARD_DEFAULTS, COMPANY, CURRENCIES, DEMO_DATE, EMPLOYEES, FX, LIVE_EMPLOYEE_ID, payRule, type CurrencyCode, type PayType, type Role } from '../config'
import type { FxQuote } from '../mocks/stablecoin'
import type { BankDetails } from '../mocks/bank'
import type { Cents } from './ledger'

export type Step = 'signup' | 'invite' | 'consent' | 'kyc' | 'kycReview' | 'kycRejected' | 'accountCreated' | 'active'
export type Tab = 'home' | 'card' | 'activity' | 'move' | 'add'
export type CompanyPage = 'overview' | 'people' | 'payments' | 'compliance' | 'pricing' | 'revenue' | 'treasury' | 'company'
export type KybStatus = 'init' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'retry'
export type TeamRole = 'admin' | 'finance' | 'approver' | 'holder'
export interface TeamMember { id: string; name: string; email: string; role: TeamRole; status: 'active' | 'invited'; kyc: 'approved' | 'pending' | 'in_review' | 'rejected' }
export type DocType = 'DNI' | 'CE' | 'RUT' | 'CUIL'
export interface Invitee {
  id: string; name: string; email: string; country: string; currency: CurrencyCode; type: PayType; amountUsd: number
  // Compliance onboarding record: who asked for this person to be added, and who approved it.
  docType?: DocType; docNumber?: string; jobTitle?: string; costCenter?: string; limitUsd?: number
  approval?: 'pending_approval' | 'approved' | 'rejected'; submittedBy?: string; submittedAt?: number; decidedBy?: string; decidedAt?: number
}
export interface Schedule { id: string; label: string; runOn: number; status: 'scheduled' | 'done' | 'failed'; note: string; monthly?: boolean }
export interface AuditItem { ts: number; actor: string; action: string }
export interface EventItem { id: string; ts: number; source: string; type: string; key: string; result: 'processed' | 'duplicate ignored' | 'stale ignored' | 'queued' | 'exception' | 'rejected' | 'postponed' | 'retrying' | 'dead' | 'skipped' | 'declined'; detail: string }
export interface TransitionItem { ts: number; machine: string; subject: string; from: string; to: string; source: string; note: string }
export interface Hold { authId: string; amount: Cents; status: 'active' | 'posted' | 'released' | 'expired'; createdAt: number; expiresOn: number }
/** A deposit started in Add funds: the company says it sent the transfer, the money has not arrived yet. */
export interface PendingDeposit { id: string; method: 'usd' | 'local'; usdCents: Cents; currency?: CurrencyCode; localCents?: Cents; reference: string; at: number }
export interface Funding { id: string; requestId: string; kind: 'company' | 'user'; amount: Cents; via: string; activityId?: string }
export interface ReconRow { label: string; ledger: Cents; other: Cents; otherLabel: string }
export type CardStatus = 'not_activated' | 'active' | 'locked' | 'canceled'
export interface ExceptionItem { id: string; ts: number; kind: string; amount: Cents; detail: string; status: 'open' | 'resolved'; resolution?: string }
export interface ChainTx { id: string; label: string; usdc: number; mode: 'testnet' | 'mock'; hash: string; url: string | null; status: 'sending' | 'confirmed' | 'failed'; ts: number }
export type EmployeeStatus = 'pending_approval' | 'rejected' | 'invited' | 'kyc_pending' | 'ready' | 'queued' | 'pending' | 'paid' | 'on_hold' | 'failed' | 'blocked'
export type PayoutStatus = 'queued_kyc' | 'on_hold' | 'pending' | 'available' | 'returned'

export interface Payout {
  id: string
  batch: number
  employeeId: string
  type: string
  amount: Cents
  fee: Cents
  status: PayoutStatus
  events: { ts: number; label: string }[]
}

export interface ActivityItem {
  id: string
  kind: 'deposit' | 'card' | 'withdrawal'
  title: string
  subtitle: string
  amount: number // cents, signed (+ in, - out)
  status: 'pending' | 'on_hold' | 'completed' | 'authorized' | 'cleared' | 'declined' | 'reversed' | 'expired' | 'processing' | 'failed'
  note?: string
  fx?: CardFx // card purchases: how the store price became dollars
  ts: number
}

/** What the person needs to understand a card purchase: store price, market rate, spread and who set it, applied rate. */
export interface CardFx {
  price: Cents // what the store charged, in cents of its currency
  currency: 'USD' | CurrencyCode
  mid: number | null // market rate, local per USD. Null for USD purchases
  rate: number | null // rate applied after the spread
  spreadPct: number
  spreadBy: string | null // company that set the spread. Null: the platform's own (independent users)
  authorized: Cents // dollars reserved when the store asked for authorization
}

export interface WithdrawDraft {
  phase: 'amount' | 'quoting' | 'quote' | 'processing' | 'success'
  currency: CurrencyCode
  amountUsd: string
  quote: FxQuote | null
  bank: BankDetails
  error: string | null
  receipt: { reference: string; localAmount: number; currency: CurrencyCode } | null
}

const live = EMPLOYEES.find((e) => e.id === LIVE_EMPLOYEE_ID)!

export const state = {
  // Who is signed in. null shows the login page.
  auth: null as null | { email: string; name: string; role: Role },
  mode: 'org' as 'org' | 'indie', // org = employee invited by a company; indie = signed up alone
  clock: DEMO_DATE.getTime(), // the demo clock (company schedules run against it)
  company: {
    name: COMPANY.name,
    kyb: 'approved' as KybStatus,
    kybNote: 'Verified',
    spreadPct: FX.spreadPct,
    team: [
      { id: 't1', name: 'Valentina Ortiz', email: 'admin@acme.co', role: 'admin', status: 'active', kyc: 'approved' },
      { id: 't2', name: 'Andrés Mejía', email: 'finance@acme.co', role: 'finance', status: 'active', kyc: 'approved' },
      { id: 't3', name: 'Paula Reyes', email: 'approver@acme.co', role: 'approver', status: 'active', kyc: 'approved' },
    ] as TeamMember[],
    ubos: [
      { name: 'Valentina Ortiz', share: 60, kyc: 'approved' as TeamMember['kyc'] },
      { name: 'Ricardo Salas', share: 40, kyc: 'approved' as TeamMember['kyc'] },
    ],
    limits: { perPaymentUsd: 5000, dailyUsd: 20000 }, // inherited by every card holder
    seeded: true, // false for a company created in the demo: it starts with no payees
  },
  // Status of every state machine, by subject id. See core/machines.ts.
  fsm: { kyc: {}, cardholder: {}, card: {}, transaction: {}, funding: {} } as Record<'kyc' | 'cardholder' | 'card' | 'transaction' | 'funding', Record<string, string>>,
  transitions: [] as TransitionItem[],
  holds: [] as Hold[],
  fundings: [] as Funding[],
  pendingDeposits: [] as PendingDeposit[],
  addFunds: null as null | { key: number; prefillCents: number | null }, // the Add funds window, when open
  recon: null as null | { ts: number; rows: ReconRow[]; ok: boolean },
  invitees: [] as Invitee[],
  schedules: [] as Schedule[],
  audit: [
    { ts: Date.now() - 3 * 3600_000, actor: 'Valentina Ortiz', action: 'Submitted the onboarding of Camila Torres (contractor, PE) for approval' },
    { ts: Date.now() - 2 * 3600_000, actor: 'Paula Reyes', action: 'Approved the onboarding of Camila Torres. Invitation sent to camila@acme.co' },
  ] as AuditItem[],
  events: [] as EventItem[],
  exceptions: [] as ExceptionItem[],
  custodyQueue: [] as { fundingId: string; at: number }[],
  cardCtl: { perTxnUsd: CARD_DEFAULTS.perTxnUsd, dailyUsd: CARD_DEFAULTS.dailyUsd, international: true, online: true },
  spentToday: 0 as Cents,
  wallet: '' as '' | 'apple',
  walletBusy: '' as '' | 'apple',
  lastOpenAuth: '' as string,
  chain: { live: false, address: '', balance: 0, checked: false, txs: [] as ChainTx[] },
  signup: { email: '', password: '', country: 'PE' as string, error: '' },
  step: 'invite' as Step,
  companyPage: 'overview' as CompanyPage,
  tab: 'home' as Tab,
  activityDetail: null as string | null, // the movement open in Movimientos
  inviteChannel: 'email' as 'email' | 'link',
  consent: { terms: false, kyc: false, optIn: false },
  kyc: { idPhoto: false, selfie: false, status: 'none' as 'none' | 'submitting' | 'unreadable' | 'review' | 'approved', caseId: '' },
  accountId: '',
  card: null as null | { cardId: string; last4: string; expiry: string; frozen: boolean; status: CardStatus; lockedBy: 'holder' | 'company' | null },
  cardBusy: '' as '' | 'freezing' | 'paying' | 'revealing' | 'issuing',
  revealed: null as null | { pan: string; cvv: string },
  lastPayment: null as null | { ok: boolean; message: string; code: string; activityId?: string },
  activity: [] as ActivityItem[],
  freeWithdrawals: 0, // one free withdrawal per payment received
  withdraw: {
    phase: 'amount', currency: live.currency, amountUsd: '', quote: null,
    bank: { bank: '', account: '', holder: live.name }, error: null, receipt: null,
  } as WithdrawDraft,
  // Admin / payment batches
  batches: 0,
  payouts: [] as Payout[],
  others: {
    diego: { status: 'ready' as EmployeeStatus, note: 'KYC approved' },
    ana: { status: 'kyc_pending' as EmployeeStatus, note: 'Waiting for ID photo' },
    luis: { status: 'failed' as EmployeeStatus, note: 'KYC rejected: expired ID. Not paid, funds stay with the company' },
    mariana: { status: 'invited' as EmployeeStatus, note: 'Has not opened the invite' },
    sofia: { status: 'ready' as EmployeeStatus, note: 'KYC approved' },
  } as Record<string, { status: EmployeeStatus; note: string }>,
  toast: null as null | { text: string; tone: 'info' | 'success' | 'error'; audience: 'employee' | 'company' },
  demoOpen: true,
  checkoutOpen: false, // "View as: Checkout (merchant)" shows the store payment page instead of an app
  companyStartingCents: Math.round(COMPANY.startingFundingUsd * 100),
}

export function update(fn: (s: typeof state) => void) {
  fn(state)
  notify()
}

let toastTimer: ReturnType<typeof setTimeout> | undefined
export function toast(text: string, tone: 'info' | 'success' | 'error' = 'info', audience: 'employee' | 'company' = 'employee') {
  update((s) => { s.toast = { text, tone, audience } })
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => update((s) => { s.toast = null }), 4000)
}

export function addActivity(item: Omit<ActivityItem, 'ts'>) {
  update((s) => { s.activity.unshift({ ...item, ts: Date.now() }) })
}
export function patchActivity(id: string, patch: Partial<ActivityItem>) {
  update((s) => {
    const it = s.activity.find((a) => a.id === id)
    if (it) Object.assign(it, patch)
  })
}

export const spreadPct = () => state.company.spreadPct
export const allPeople = () => (state.company.seeded ? [...EMPLOYEES, ...state.invitees] : state.invitees) as typeof EMPLOYEES
export const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
export const addDays = (ts: number, d: number) => { const x = new Date(ts); x.setDate(x.getDate() + d); return x.getTime() }

/** Company audit log. Every sensitive action is recorded with who did it. */
export function audit(action: string, actor?: string) {
  update((s) => { s.audit.unshift({ ts: Date.now(), actor: actor ?? s.auth?.name ?? 'System', action }) })
}

export const payoutsOf = (employeeId: string) => state.payouts.filter((p) => p.employeeId === employeeId)

/** What the company sees for each person. It always mirrors what that person sees in the app. */
export const employeeStatus = (id: string): { status: EmployeeStatus; note: string } => {
  const e = allPeople().find((x) => x.id === id)
  if (!e) return { status: 'invited', note: 'Not in this company' }
  if (payRule(e.country, e.type) === 'blocked') return { status: 'blocked', note: `${e.type} in USD is not enabled in ${CURRENCIES[e.currency].country} (local rule). Not paid here` }
  const last = payoutsOf(id).at(-1)
  if (last?.status === 'on_hold') return { status: 'on_hold', note: 'Payment on hold for review' }
  if (last?.status === 'pending') return { status: 'pending', note: 'Delivered. Still pending for the employee' }
  if (last?.status === 'available') return { status: 'paid', note: 'Available to the employee' }
  if (last?.status === 'queued_kyc') return { status: 'queued', note: 'Payment queued until KYC is approved' }
  if (last?.status === 'returned') return { status: 'failed', note: 'Not delivered. Funds stayed with the company' }
  if (id === LIVE_EMPLOYEE_ID && state.step === 'kycRejected') return { status: 'failed', note: 'KYC rejected. Not paid, funds stay with the company' }
  if (id !== LIVE_EMPLOYEE_ID) return state.others[id] ?? { status: 'invited', note: 'Invite sent by email' }
  if (state.step === 'active' || state.step === 'accountCreated') return { status: 'ready', note: 'KYC approved, account open' }
  if (state.step === 'kyc' || state.step === 'kycReview') return { status: 'kyc_pending', note: state.step === 'kycReview' ? 'In manual review' : 'Verifying identity' }
  return { status: 'invited', note: state.step === 'invite' ? 'Invite sent' : 'Opted in, starting KYC' }
}
