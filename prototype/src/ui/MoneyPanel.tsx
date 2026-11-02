// Side panel tools: confirm a deposit started in Add funds, and pay one person. Both use the real platform paths.
import { useState } from 'react'
import { useBus } from '../bus'
import { CURRENCIES } from '../config'
import { inviteesFinishOnboarding } from '../core/onboarding'
import { advanceClock, companyBalance, depositLabel, markDepositReceived, payEmployee } from '../core/services'
import { allPeople, employeeStatus, fmtDate, state } from '../core/state'
import { parseAmount, usd } from '../format'
import { Banner, Button, Field, inputClass } from './Primitives'
import { Select } from './Select'
import { Flag } from './Flag'

type Result = { ok: boolean; message: string } | null

const Title = ({ children, sub }: { children: string; sub: string }) => <div className="mb-2"><h3 className="text-sm font-bold">{children}</h3><p className="text-xs text-slate-500">{sub}</p></div>

export function MoneyPanel() {
  useBus()
  const people = allPeople()
  const [depBusy, setDepBusy] = useState('')
  const [depRes, setDepRes] = useState<Result>(null)
  const [emp, setEmp] = useState(people[0]?.id ?? '')
  const [amt, setAmt] = useState('300')
  const [cur, setCur] = useState<string>('USD')
  const [payRes, setPayRes] = useState<Result>(null)
  const [moved, setMoved] = useState('')
  const person = people.find((p) => p.id === emp) ?? people[0]
  const indie = state.mode === 'indie'
  if (indie) return <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">These tools work on the company account. Switch to a company view to use them.</p>
  return (
    <div className="mt-3 space-y-5">
      <section className="rounded-xl border border-slate-200 p-3">
        <Title sub="Confirms a deposit started in Add funds. It is the only way money reaches the vault.">Depósito recibido</Title>
        {state.pendingDeposits.length === 0
          ? <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">Nothing on the way. Open Add funds in the company view and confirm the transfer first.</p>
          : (
            <ul className="space-y-2">
              {state.pendingDeposits.map((d) => (
                <li key={d.id} className="rounded-lg bg-slate-50 p-2.5">
                  <div className="flex items-baseline justify-between gap-2"><b className="text-sm tabular-nums">{usd(d.usdCents)}</b><span className="text-[11px] text-slate-500">{d.reference}</span></div>
                  <div className="mb-2 text-xs text-slate-500">{depositLabel(d)}</div>
                  <Button busy={depBusy === d.id} disabled={!!depBusy} onClick={async () => { setDepBusy(d.id); setDepRes(await markDepositReceived(d.id)); setDepBusy('') }}>Depósito recibido</Button>
                </li>
              ))}
            </ul>
          )}
        <p className="mt-2 text-xs text-slate-500">Vault balance <b>{usd(companyBalance())}</b></p>
        {depRes && <div className="mt-2"><Banner tone={depRes.ok ? 'success' : 'error'}>{depRes.message}</Banner></div>}
      </section>

      <section className="rounded-xl border border-slate-200 p-3">
        <Title sub="Goes through approval rules, the ledger and FX, then reaches their app.">Pagar a empleado</Title>
        <div className="space-y-2">
          <Field label="Employee">
            <Select ariaLabel="Employee" value={person?.id ?? ''} onChange={(v) => { setEmp(v); setCur('USD') }} options={people.map((p) => ({ value: p.id, label: p.name, icon: <Flag code={p.country} />, hint: employeeStatus(p.id).note }))} />
          </Field>
          <div className="grid grid-cols-[1fr_7.5rem] items-end gap-2">
            <Field label="Amount"><input aria-label="Payment amount" className={inputClass} inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} /></Field>
            <Field label="Currency"><Select ariaLabel="Currency" value={cur} onChange={setCur} options={[{ value: 'USD', label: 'USD', icon: <Flag code="US" /> }, ...(person ? [{ value: person.currency as string, label: person.currency as string, icon: <Flag code={person.country} /> }] : [])]} /></Field>
          </div>
          {person && cur !== 'USD' && <p className="text-xs text-slate-500">Entered in {CURRENCIES[person.currency].country} currency. It is converted to USD at the current rate with the spread.</p>}
          <Button disabled={!person || !parseAmount(amt)} onClick={() => { const c = parseAmount(amt); if (c && person) setPayRes(payEmployee(person.id, c / 100, cur as 'USD')) }}>Pagar a empleado</Button>
          {payRes && <Banner tone={payRes.ok ? 'success' : 'error'}>{payRes.message}</Banner>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 p-3">
        <Title sub={`Clock: ${fmtDate(state.clock)}. Invited people finish their side on their own phones.`}>Time and invitations</Title>
        <div className="grid gap-2">
          <button className="press rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium hover:bg-slate-50" onClick={() => void advanceClock(1)}>Advance the clock 1 day</button>
          <button className="press rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium hover:bg-slate-50" onClick={() => { const n = inviteesFinishOnboarding(); setMoved(n ? `${n} invited ${n > 1 ? 'people' : 'person'} verified identity and accepted terms.` : 'Nobody is waiting on an invitation.') }}>Invited people finish verification</button>
          {moved && <p className="text-xs text-slate-600">{moved}</p>}
        </div>
      </section>
    </div>
  )
}
