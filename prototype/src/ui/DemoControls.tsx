// The presenter's panel. Everything that can go wrong can be switched on here, one case at a time.
import { useState } from 'react'
import { useBus } from '../bus'
import { LIVE_EMPLOYEE_ID } from '../config'
import { acct, ledger } from '../core/ledger'
import { sendUnknownEvent } from '../core/events'
import { MACHINES, current, type MachineName } from '../core/machines'
import { advanceClock, approveHold, approveManualReview, clearingWithoutAuth, expireLastAuth, incrementLastAuth, merchantDefault, partialReversalLastAuth, payWithCard, refundLast, rejectManualReview, releasePending, reverseLastAuth, runClearingNow, runPayroll, shortfall, runReconciliation, runSettlement, seedHistory, sendEarlyEvent, sendStaleEvent, setCustodyDown, skipToActive } from '../core/services'
import { payoutsOf, state } from '../core/state'
import { flags, setDecline, setFlag, type DeclineMode, type FlagKey } from '../mocks/demoControls'
import { usd } from '../format'
import { PurchasePanel } from './PurchasePanel'
import { MoneyPanel } from './MoneyPanel'
import { Select } from './Select'

interface Toggle { key: FlagKey; label: string; hint: string }
const GROUPS: { title: string; items: Toggle[] }[] = [
  { title: 'Identity (KYC / KYB)', items: [
    { key: 'kycUnreadable', label: 'KYC: unreadable ID photo', hint: 'Retryable. The person retakes the photo.' },
    { key: 'kycManualReview', label: 'KYC: goes to manual review', hint: 'Waits for a reviewer (PEP or list hit).' },
    { key: 'kycRejected', label: 'KYC: rejected', hint: 'Final. Queued money stays with the company.' },
    { key: 'cardholderNeedsInfo', label: 'Issuer asks for one more detail', hint: 'KYC passes, the card waits for the address.' },
    { key: 'cardholderDenied', label: 'Issuer denies the card', hint: 'KYC passes, the issuer says no. Two verdicts.' },
    { key: 'kybManualReview', label: 'Company KYB: manual review', hint: 'Approve it from Company or Compliance.' },
    { key: 'kybRejected', label: 'Company KYB: rejected', hint: 'Final for the application.' },
  ] },
  { title: 'Money in', items: [
    { key: 'paymentHold', label: 'Next payment goes into review', hint: 'Compliance approves or rejects it.' },
    { key: 'keepPending', label: 'Keep balance pending', hint: 'Not spendable until released. Stays on.' },
    { key: 'wrongNetwork', label: 'Next deposit on the wrong network', hint: 'Not credited. Appears under Exceptions.' },
    { key: 'custodyDrift', label: 'Custodian statement differs', hint: 'The next reconciliation finds a difference.' },
  ] },
  { title: 'Provider events', items: [
    { key: 'duplicateWebhook', label: 'Duplicate event', hint: 'Delivered twice. No second posting or hold.' },
    { key: 'badSignature', label: 'Invalid signature', hint: 'Refused with 401. The provider sends it again.' },
    { key: 'webhookFails', label: 'Processing keeps failing', hint: 'Retries, then dead letters. Requeue in Compliance.' },
  ] },
  { title: 'Card and withdrawals', items: [
    { key: 'authTimeout', label: 'Authorization timeout (stand-in)', hint: 'Platform does not answer. Issuer approves alone up to $25.' },
    { key: 'quoteShortTtl', label: 'FX quote expires in 5 s', hint: 'Next withdrawal quote is short-lived.' },
    { key: 'wrongBank', label: 'Withdrawal: wrong bank details', hint: 'The bank rejects it. Fix and retry.' },
  ] },
]

const shortName = (a: string) => a.replace(`emp:${LIVE_EMPLOYEE_ID}:`, '').replace('company:acme:funding', 'company').replace('platform:revenue:', 'revenue:').replace('platform:', '').replace('external:', 'ext:')

function Journal() {
  const groups = new Map<number, ReturnType<typeof ledger.entries>>()
  for (const e of ledger.entries().slice(-60)) groups.set(e.journal, [...(groups.get(e.journal) ?? []), e])
  const rows = [...groups.entries()].reverse()
  return (
    <div>
      <div className="mb-2 flex items-center justify-between rounded-lg bg-emerald-50 px-2.5 py-1.5 font-mono text-xs text-emerald-800"><span>sum of all accounts</span><span>{(ledger.total() / 100).toFixed(2)} ✓</span></div>
      <p className="mb-2 text-xs text-slate-500">Append-only. Each block is one event: its lines apply together or not at all.</p>
      <ol className="space-y-2">
        {rows.map(([id, lines]) => (
          <li key={id} className="row-in rounded-lg border border-slate-100 p-2 font-mono text-[11px] leading-snug">
            <div className="mb-1 flex justify-between font-sans text-[10px] font-bold uppercase tracking-wide text-slate-400"><span>Journal #{id}</span>{lines[0].key && <span className="max-w-[60%] truncate normal-case" title={lines[0].key}>key {lines[0].key}</span>}</div>
            {lines.map((e) => (
              <div key={e.id} className="mt-1">
                <div className="flex justify-between gap-2"><span className="break-all">{shortName(e.from)} → {shortName(e.to)}</span><b>{(e.amount / 100).toFixed(2)}</b></div>
                <div className="font-sans text-slate-500">{e.memo}</div>
              </div>
            ))}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** The subject each machine is showing right now. */
function subjectOf(m: MachineName) {
  if (m === 'kyc' || m === 'cardholder') return LIVE_EMPLOYEE_ID
  if (m === 'card') return state.card?.cardId ?? ''
  const last = state.transitions.find((t) => t.machine === m)
  return last?.subject ?? ''
}

function Core() {
  const names = Object.keys(MACHINES) as MachineName[]
  const me = ledger.employee(LIVE_EMPLOYEE_ID)
  return (
    <div className="space-y-4">
      {names.map((m) => {
        const subject = subjectOf(m)
        const now = subject ? current(m, subject) : MACHINES[m].initial
        return (
          <div key={m}>
            <div className="mb-1 flex items-baseline justify-between text-xs font-bold"><span>{MACHINES[m].label}</span><span className="max-w-[45%] truncate font-mono font-normal text-slate-400">{subject}</span></div>
            <div className="flex flex-wrap gap-1">
              {Object.keys(MACHINES[m].edges).filter((st) => st !== 'none').map((st) => (
                <span key={st} className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold transition-colors ${st === now ? 'bg-lime text-ink' : 'bg-slate-100 text-slate-500'}`}>{st.replace('_', ' ')}</span>
              ))}
            </div>
          </div>
        )
      })}
      <div>
        <div className="mb-1 text-xs font-bold">Balance</div>
        <p className="rounded-lg bg-slate-50 p-2 font-mono text-[10.5px] leading-relaxed text-slate-600">available = confirmed money − active holds − posted − fees − owed. It can be short: owed {(me.owed / 100).toFixed(2)}</p>
      </div>
      <div>
        <div className="mb-1 text-xs font-bold">Holds</div>
        {state.holds.length === 0 ? <p className="text-xs text-slate-400">None yet.</p> : (
          <ul className="space-y-1 font-mono text-[10.5px]">
            {state.holds.slice(0, 5).map((h) => <li key={h.authId} className="flex justify-between gap-2"><span>{h.authId}</span><span>{usd(h.amount)}</span><span className={h.status === 'active' ? 'font-bold text-brand-700' : 'text-slate-400'}>{h.status}</span></li>)}
          </ul>
        )}
      </div>
      <div>
        <div className="mb-1 text-xs font-bold">Latest transitions</div>
        {state.transitions.length === 0 ? <p className="text-xs text-slate-400">None yet.</p> : (
          <ul className="space-y-1.5 text-[10.5px] leading-snug">
            {state.transitions.slice(0, 10).map((t, i) => <li key={i} className="row-in"><b>{t.machine}</b> {t.from} → <b>{t.to}</b> <span className="text-slate-400">({t.source})</span>{t.note && <div className="text-slate-500">{t.note}</div>}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}

const Action = ({ children, ...rest }: { children: string; disabled?: boolean; onClick: () => void }) => (
  <button {...rest} className="press rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white">{children}</button>
)
const Row = ({ k, v }: { k: string; v: number }) => <div className="flex justify-between gap-2"><dt className="text-slate-500">{k}</dt><dd>{(v / 100).toFixed(2)}</dd></div>
const H = ({ children }: { children: string }) => <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">{children}</h3>

const TABS = { money: 'Money', purchase: 'Buy', scenarios: 'Failures', merchant: 'Events', core: 'Core', journal: 'Journal' } as const

export function DemoControls() {
  useBus()
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<keyof typeof TABS>('money')
  const me = ledger.employee(LIVE_EMPLOYEE_ID)
  const onHold = payoutsOf(LIVE_EMPLOYEE_ID).some((p) => p.status === 'on_hold')
  const toSettle = ledger.balance(acct.issuerSettlement)
  const hasCard = !!state.card
  const indie = state.mode === 'indie'
  if (!state.auth) return null
  return (
    <>
      <button onClick={() => setOpen(!open)} className="fixed bottom-4 right-4 z-30 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-lime shadow-lg lg:hidden">Demo panel</button>
      <aside className={`${open ? 'block' : 'hidden'} fixed inset-x-3 bottom-16 top-16 z-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-6rem)] lg:w-80 lg:shrink-0 lg:self-start lg:shadow-none`}>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Ledger ({indie ? 'Mateo' : 'Camila'}, USD)</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3 font-mono text-[11px]">
          <Row k="available" v={me.available} /><Row k="company" v={ledger.balance(acct.company)} />
          <Row k="pending" v={me.pending} /><Row k="revenue" v={ledger.revenueTotal()} />
          <Row k="on hold" v={me.onHold} /><Row k="to settle" v={toSettle} />
          <Row k="held" v={me.held} /><Row k="owed" v={me.owed} />
        </dl>
        <div className="mt-4 flex rounded-full bg-slate-100 p-1 text-[10.5px] font-bold">
          {(Object.keys(TABS) as (keyof typeof TABS)[]).map((x) => (
            <button key={x} onClick={() => setPanel(x)} className={`flex-1 rounded-full px-1 py-1.5 transition ${panel === x ? 'bg-white shadow-sm' : 'text-slate-500'}`}>{TABS[x]}</button>
          ))}
        </div>

        {panel === 'money' && <MoneyPanel />}
        {panel === 'purchase' && <PurchasePanel />}
        {panel === 'journal' && <div className="mt-3"><Journal /></div>}
        {panel === 'core' && <div className="mt-3"><Core /></div>}

        {panel === 'scenarios' && (
          <>
            <p className="mb-1 mt-3 text-xs text-slate-500">Each case fires once, then switches itself off.</p>
            {GROUPS.map((g) => (
              <div key={g.title}>
                <H>{g.title}</H>
                <div className="space-y-2.5">
                  {g.items.map((t) => (
                    <label key={t.key} className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={flags[t.key]} onChange={(e) => setFlag(t.key, e.target.checked)} className="mt-1 size-4 shrink-0 accent-ink" />
                      <span className="text-sm leading-snug"><span className="font-bold">{t.label}</span><span className="block text-xs text-slate-500">{t.hint}</span></span>
                    </label>
                  ))}
                  {g.title === 'Money in' && (
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={flags.custodyDown} onChange={(e) => void setCustodyDown(e.target.checked)} className="mt-1 size-4 shrink-0 accent-ink" />
                      <span className="text-sm leading-snug"><span className="font-bold">Custodian outage</span><span className="block text-xs text-slate-500">Deposits queue up. Untick to restore and credit them.</span></span>
                    </label>
                  )}
                  {g.title === 'Card and withdrawals' && (
                    <label className="block text-sm">
                      <span className="mb-1 block font-bold">Next card payment is declined for</span>
                      <Select<DeclineMode> size="sm" value={flags.cardDecline} onChange={setDecline} options={[{ value: 'none', label: 'Off' }, { value: 'insufficient', label: 'Insufficient funds' }, { value: 'mcc', label: 'Merchant category blocked' }, { value: 'cvv3ds', label: 'CVV or 3DS failed' }, { value: 'fraud', label: 'Suspected fraud' }]} />
                      <span className="block text-xs text-slate-500">Also natural: pending funds, locked card, limits, blocked country, toggles.</span>
                    </label>
                  )}
                </div>
              </div>
            ))}
            <H>Move things along</H>
            <div className="grid gap-2">
              {!indie && <Action disabled={shortfall() > 0} onClick={() => void runPayroll({ internal: true })}>{shortfall() > 0 ? `Run batch #${state.batches + 1} (short by ${usd(shortfall())}, use Add funds)` : `Run batch #${state.batches + 1}`}</Action>}
              <Action disabled={state.step !== 'kycReview'} onClick={approveManualReview}>Approve KYC manual review</Action>
              <Action disabled={state.step !== 'kycReview'} onClick={rejectManualReview}>Reject KYC manual review</Action>
              {!indie && <Action disabled={!onHold} onClick={() => approveHold()}>Approve held payment</Action>}
              <Action disabled={me.pending <= 0} onClick={releasePending}>Release pending funds now</Action>
              <Action onClick={() => void advanceClock(1)}>Advance the clock 1 day</Action>
              <Action onClick={() => void seedHistory()}>Load a month of history</Action>
              <Action disabled={state.step === 'active'} onClick={() => void skipToActive()}>Skip to active account</Action>
              <Action onClick={() => { window.location.href = window.location.pathname }}>Reset demo</Action>
            </div>
          </>
        )}

        {panel === 'merchant' && (
          <>
            <p className="mb-1 mt-3 text-xs text-slate-500">What a merchant, the network and the issuer can send. Needs an active card.</p>
            <H>Purchases</H>
            <div className="grid gap-2">
              <Action disabled={!hasCard} onClick={() => void payWithCard('coffee', merchantDefault('coffee'))}>Live purchase: coffee, local currency</Action>
              <Action disabled={!hasCard} onClick={() => void payWithCard('hotel', merchantDefault('hotel'))}>Hotel pre-authorization ($120)</Action>
              <Action disabled={!hasCard} onClick={() => void payWithCard('abroad', merchantDefault('abroad'))}>Purchase in a blocked country</Action>
            </div>
            <H>After authorization</H>
            <div className="grid gap-2">
              <Action disabled={!state.lastOpenAuth} onClick={() => incrementLastAuth()}>Incremental authorization (+$40)</Action>
              <Action disabled={!state.lastOpenAuth} onClick={() => partialReversalLastAuth()}>Partial reversal ($10)</Action>
              <Action disabled={!state.lastOpenAuth} onClick={reverseLastAuth}>Full reversal</Action>
              <Action disabled={!state.lastOpenAuth} onClick={expireLastAuth}>Authorization expires</Action>
              <Action disabled={me.held <= 0} onClick={runClearingNow}>Run clearing now (final amount)</Action>
              <Action disabled={!hasCard} onClick={() => refundLast()}>Refund the last purchase</Action>
              <Action disabled={toSettle <= 0} onClick={runSettlement}>Run daily settlement (+ chain proof)</Action>
              <Action onClick={runReconciliation}>Run daily reconciliation</Action>
            </div>
            <H>Edge cases</H>
            <div className="grid gap-2">
              <Action disabled={!hasCard} onClick={() => clearingWithoutAuth()}>Clearing without authorization</Action>
              <Action onClick={sendStaleEvent}>Late event after a final state</Action>
              <Action onClick={sendEarlyEvent}>Event before its authorization</Action>
              <Action onClick={sendUnknownEvent}>Unknown event type</Action>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
