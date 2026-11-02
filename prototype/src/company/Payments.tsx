import { useEffect, useState } from 'react'
import { useBus } from '../bus'
import { COMPANY, FX, LIVE_EMPLOYEE_ID, NOT_ENABLED, PAY_RULES, PAY_TYPES, type PayRule } from '../config'
import { can } from '../core/auth'
import { payoutFee } from '../core/pricing'
import { advanceClock, canReceive, committedFunds, companyBalance, depositsOnTheWay, openAddFunds, payableEmployees, reconciliationCsv, runPayroll, runSchedule, schedulePayroll, setPersonAmount, shortfall } from '../core/services'
import { addDays, allPeople, employeeStatus, fmtDate, spreadPct, state, type EmployeeStatus } from '../core/state'
import { local, parseAmount, toCents, usd } from '../format'
import { Badge, Banner, inputSmClass } from '../ui/Primitives'
import { CountryCell } from '../ui/countries'
import { Flag } from '../ui/Flag'
import { Btn, Panel, Th } from './kit'

const STATUS: Record<EmployeeStatus, { label: string; dot: string; pill: string }> = {
  ready: { label: 'Ready to pay', dot: 'bg-sky-500', pill: 'bg-sky-50 text-sky-800' },
  paid: { label: 'Available', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-800' },
  pending: { label: 'Sent, pending', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-800' },
  queued: { label: 'Reserved', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-800' },
  on_hold: { label: 'On hold', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-800' },
  kyc_pending: { label: 'KYC pending', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-800' },
  pending_approval: { label: 'Pending approval', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-800' },
  invited: { label: 'Invited', dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-700' },
  failed: { label: 'Failed', dot: 'bg-rose-500', pill: 'bg-rose-50 text-rose-700' },
  rejected: { label: 'Rejected', dot: 'bg-rose-500', pill: 'bg-rose-50 text-rose-700' },
  blocked: { label: 'Blocked by rule', dot: 'bg-rose-500', pill: 'bg-rose-50 text-rose-700' },
}
const AVATARS = ['bg-brand-50 text-brand-700', 'bg-sky-100 text-sky-800', 'bg-lime/30 text-ink', 'bg-slate-100 text-slate-700']
const initials = (name: string) => { const w = name.trim().split(/\s+/); return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase() }
const avatarOf = (id: string) => AVATARS[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATARS.length]
const typeTone = 'rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600'

/** Amount for one person. It accepts the formats people type (1,200.50) and only commits a valid number. */
function AmountInput({ id, name, value, disabled }: { id: string; name: string; value: number; disabled: boolean }) {
  const shown = value.toFixed(2)
  const [text, setText] = useState(shown)
  useEffect(() => setText(shown), [shown])
  const commit = () => {
    if (!text.trim()) { setPersonAmount(id, 0); setText((0).toFixed(2)); return }
    const cents = parseAmount(text)
    if (cents === null && Number(text) !== 0) { setText(shown); return }
    setPersonAmount(id, (cents ?? 0) / 100)
    setText(((cents ?? 0) / 100).toFixed(2))
  }
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
      <input aria-label={`Amount for ${name}`} inputMode="decimal" disabled={disabled} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} className={`${inputSmClass} pl-6 text-right font-semibold tabular-nums disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`} />
    </div>
  )
}

function PersonRow({ person: e, inBatch }: { person: ReturnType<typeof allPeople>[number]; inBatch: boolean }) {
  const st = employeeStatus(e.id)
  const look = STATUS[st.status]
  const payable = canReceive(e)
  const reservedUntilVerified = inBatch && ['invited', 'kyc_pending'].includes(st.status)
  const localValue = e.amountUsd * FX.mid[e.currency] * (1 - spreadPct())
  return (
    <li data-person={e.id} className={`grid grid-cols-[minmax(0,1fr)_7.5rem] gap-x-4 py-3.5 ${payable ? '' : 'opacity-60'}`}>
      <div className="flex min-w-0 gap-3">
        <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold ${avatarOf(e.id)}`}>{initials(e.name)}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 font-bold">{e.name}{e.id === LIVE_EMPLOYEE_ID && <span className="text-xs font-medium text-brand-700">In the phone</span>}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500"><CountryCell code={e.country} /><span className={typeTone}>{e.type}</span></div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${look.pill}`}><span className={`size-1.5 rounded-full ${look.dot}`} />{look.label}</span>
            <span className="text-xs text-slate-500">{reservedUntilVerified ? 'Reserved until they finish verification' : st.note}</span>
          </div>
        </div>
      </div>
      <div>
        <AmountInput id={e.id} name={e.name} value={e.amountUsd} disabled={!payable || state.auth?.role === 'approver'} />
        <div className="mt-1 text-right text-xs tabular-nums text-slate-400">{payable && e.amountUsd > 0 ? `≈ ${local(localValue, e.currency)}` : payable ? 'Not in this batch' : 'Not payable'}</div>
      </div>
    </li>
  )
}
const ruleTone: Record<PayRule, 'green' | 'amber' | 'red'> = { allowed: 'green', opt_in: 'amber', blocked: 'red' }
const ruleText: Record<PayRule, string> = { allowed: 'Allowed', opt_in: 'Opt-in', blocked: 'Blocked' }

function downloadCsv() {
  const url = URL.createObjectURL(new Blob([reconciliationCsv()], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url; a.download = `${COMPANY.name.toLowerCase().replace(/\s+/g, '-')}-payments.csv`; a.click()
  URL.revokeObjectURL(url)
}

export function Payments() {
  useBus()
  const [busy, setBusy] = useState('')
  const iso = (ts: number) => new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  const [date, setDate] = useState(iso(addDays(state.clock, 3)))
  const [monthly, setMonthly] = useState(false)
  const people = allPeople()
  const payable = payableEmployees()
  const total = payable.reduce((s, e) => s + toCents(e.amountUsd), 0)
  const fees = payable.reduce((s, e) => s + payoutFee(toCents(e.amountUsd)), 0)
  const short = shortfall()
  const toAdd = Math.max(0, short - depositsOnTheWay())
  const balance = companyBalance()
  const committed = committedFunds()
  const next = state.batches + 1
  const act = async (k: string, fn: () => Promise<unknown> | unknown) => { setBusy(k); await fn(); setBusy('') }
  return (
    <div className="space-y-5">
      <Panel title="Assign balances" hint={`Batch #${next}. Set what each person receives, then send it.`}>
        <div className="grid gap-3 sm:grid-cols-[1.15fr_1fr]">
          <div className="hero-clara flex flex-col justify-between gap-4 rounded-xl p-5 text-white">
            <div>
              <div className="text-sm text-sky-200">Total to send</div>
              <div className="mt-0.5 text-[34px] font-bold leading-tight tracking-tight tabular-nums">{usd(total + fees)}</div>
              <div className="mt-0.5 text-xs text-sky-200 tabular-nums">{usd(total)} to {payable.length} {payable.length === 1 ? 'person' : 'people'} + {usd(fees)} in fees</div>
            </div>
            <Btn perm="pay" variant="lime" tall disabled={!!busy || short > 0 || payable.length === 0} onClick={() => void act('run', () => runPayroll())}>{busy === 'run' ? 'Sending…' : payable.length === 0 ? 'Nobody to pay yet' : `Send to ${payable.length} ${payable.length === 1 ? 'person' : 'people'}`}</Btn>
          </div>
          <dl className="flex flex-col justify-center divide-y divide-slate-100 rounded-xl border border-[#e4e7ec] px-4 text-sm">
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-[#667085]">People ready</dt><dd className="font-bold tabular-nums">{payable.length} of {people.length}</dd></div>
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-[#667085]">Vault balance</dt><dd className="font-bold tabular-nums">{usd(balance)}</dd></div>
            {committed > 0 && <div className="flex items-center justify-between gap-3 py-3"><dt className="text-[#667085]">Reserved for people in KYC</dt><dd className="font-bold tabular-nums">{usd(committed)}</dd></div>}
            {short > 0
              ? <div className="flex items-center justify-between gap-3 py-3"><dt className="font-semibold text-rose-700">Missing</dt><dd className="font-bold text-rose-700 tabular-nums">{usd(short)}</dd></div>
              : <div className="flex items-center justify-between gap-3 py-3"><dt className="text-[#667085]">Left after sending</dt><dd className="font-bold tabular-nums">{usd(balance - committed - total - fees)}</dd></div>}
          </dl>
        </div>
        {short > 0 && <div className="mt-3"><Banner tone="warn">This batch is missing <b>{usd(short)}</b> in the vault.{depositsOnTheWay() > 0 && ` ${usd(depositsOnTheWay())} is on the way.`} {toAdd === 0 ? 'You can send it when the deposit arrives.' : can('fund') ? <button className="font-bold underline" onClick={() => openAddFunds(toAdd)}>Add {usd(toAdd)} in funds</button> : 'Ask an admin or finance user to add funds.'}</Banner></div>}

        <div className="mt-5 flex items-center justify-between border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wide text-[#667085]"><span>Person</span><span>Assign (USD)</span></div>
        <ul className="divide-y divide-slate-100">
          {people.map((e) => <PersonRow key={e.id} person={e} inBatch={payable.some((p) => p.id === e.id)} />)}
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold">Schedule for</span>
            <div className="w-40"><input type="date" aria-label="Schedule date" value={date} min={iso(addDays(state.clock, 1))} onChange={(e) => setDate(e.target.value)} className={inputSmClass} /></div>
            <label className="flex items-center gap-1.5 text-slate-600"><input type="checkbox" checked={monthly} onChange={(e) => setMonthly(e.target.checked)} className="size-4 accent-ink" />Repeat monthly</label>
            <Btn perm="schedule" disabled={payable.length === 0 || !date} onClick={() => schedulePayroll(new Date(`${date}T09:00:00`).getTime(), monthly)}>Schedule</Btn>
          </div>
          <Btn variant="light" disabled={state.payouts.length === 0} onClick={downloadCsv}>Export reconciliation CSV</Btn>
        </div>
      </Panel>

      <Panel title="Scheduled payments" hint={`Today is ${fmtDate(state.clock)}. Batches run at 09:00 on their date.`}
        action={<div className="flex gap-2"><Btn variant="light" onClick={() => void advanceClock(1)}>Advance 1 day</Btn><Btn variant="light" onClick={() => void advanceClock(3)}>Advance 3 days</Btn></div>}>
        {state.schedules.length === 0 ? <p className="text-sm text-slate-400">No schedules yet.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {state.schedules.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div><div className="font-semibold">{s.label}, {fmtDate(s.runOn)}</div><div className="text-xs text-slate-500">{s.note}</div></div>
                <div className="flex items-center gap-2"><Badge tone={s.status === 'done' ? 'green' : s.status === 'failed' ? 'red' : 'blue'}>{s.status}</Badge>{s.status === 'failed' && toAdd > 0 && can('fund') && <Btn variant="light" onClick={() => openAddFunds(toAdd)}>Add funds</Btn>}{s.status === 'failed' && <Btn variant="light" onClick={() => void runSchedule(s.id)}>Retry</Btn>}</div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-400">Tip: schedule while the balance is low, advance the clock, watch it fail, add funds, retry.</p>
      </Panel>

      <Panel title="What can be paid in digital dollars" hint="Rules by country and payment type. Salary stays blocked until counsel clears it. Assumption, not legal advice.">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr><Th>Country</Th>{PAY_TYPES.map((t) => <Th key={t}>{t}</Th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {Object.entries(PAY_RULES).map(([code, rules]) => (
              <tr key={code}><td className="py-2.5 pr-3 font-semibold"><CountryCell code={code} /></td>{PAY_TYPES.map((t) => <td key={t} className="pr-2"><Badge tone={ruleTone[rules[t]]}>{ruleText[rules[t]]}</Badge></td>)}</tr>
            ))}
            {NOT_ENABLED.map((c) => (
              <tr key={c.code} className="text-slate-400"><td className="py-2.5 pr-3 font-semibold"><span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Flag code={c.code} className="opacity-40 grayscale" />{c.name}</span></td><td colSpan={PAY_TYPES.length} className="text-xs">Not enabled: {c.reason}</td></tr>
            ))}
          </tbody>
        </table></div>
      </Panel>
    </div>
  )
}
