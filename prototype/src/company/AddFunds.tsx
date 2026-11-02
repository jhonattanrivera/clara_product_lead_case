// The only way a company brings money in. It gives transfer instructions and records that a deposit is on the way.
// Nothing is credited here: the vault changes when the deposit is received.
import { useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useBus } from '../bus'
import { CURRENCIES, FEES, FX, type CurrencyCode } from '../config'
import { closeAddFunds, depositReference, requestDeposit } from '../core/services'
import { state } from '../core/state'
import { parseAmount, usd } from '../format'
import { fundingCurrencies } from '../ui/countries'
import { Flag } from '../ui/Flag'
import { Banner, Field, inputClass } from '../ui/Primitives'
import { Select } from '../ui/Select'
import { Btn, Panel } from './kit'

const DEFAULT_CENTS = 1000000
// Buying dollars costs more local currency than the market rate: the partner's conversion cost is passed through.
const rateFor = (c: CurrencyCode) => FX.mid[c] * (1 + FEES.onRampPct)
const usdText = (cents: number) => (cents / 100).toFixed(2)
/** Rounded up to the currency's decimals, so the estimate never falls short of what was asked for. */
const localText = (cents: number, c: CurrencyCode) => {
  const d = 10 ** CURRENCIES[c].decimals
  return (Math.ceil((cents / 100) * rateFor(c) * d - 1e-6) / d).toFixed(CURRENCIES[c].decimals)
}

export function AddFundsModal() {
  useBus()
  if (!state.addFunds) return null
  return <AddFunds key={state.addFunds.key} prefill={state.addFunds.prefillCents} />
}

function AddFunds({ prefill }: { prefill: number | null }) {
  const start = prefill ?? DEFAULT_CENTS
  const [tab, setTab] = useState<'usd' | 'local'>('usd')
  const [cur, setCur] = useState<CurrencyCode>('PEN')
  const [usdAmount, setUsdAmount] = useState(usdText(start))
  const [localAmount, setLocalAmount] = useState(localText(start, 'PEN'))
  const [error, setError] = useState('')
  const rate = rateFor(cur)
  const parsed = parseAmount(tab === 'usd' ? usdAmount : localAmount)
  const credit = parsed ? (tab === 'usd' ? parsed : Math.round(parsed / rate)) : 0
  const reference = depositReference()
  const row = (k: string, v: string) => <div className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0"><dt className="text-slate-500">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>

  const switchTab = (next: 'usd' | 'local') => {
    if (next === tab) return
    if (credit > 0) { if (next === 'usd') setUsdAmount(usdText(credit)); else setLocalAmount(localText(credit, cur)) }
    setTab(next)
  }
  const switchCurrency = (next: CurrencyCode) => {
    if (credit > 0) setLocalAmount(localText(credit, next))
    setCur(next)
  }
  const send = () => {
    const r = requestDeposit(tab === 'usd' ? { method: 'usd', usdCents: credit } : { method: 'local', usdCents: credit, currency: cur, localCents: parsed ?? 0 })
    if (!r.ok) setError(r.message)
  }
  const onBackdrop = (e: MouseEvent) => { if (e.target === e.currentTarget) closeAddFunds() }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAddFunds() }

  return (
    <div role="dialog" aria-modal="true" aria-label="Add funds" onClick={onBackdrop} onKeyDown={onKey} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:items-center">
      <div className="relative w-full max-w-xl">
        <button className="absolute right-5 top-5 z-10 text-sm font-bold text-brand-700" onClick={closeAddFunds}>Close</button>
        <Panel title="Add funds" hint="Send money from your bank. It is credited to your vault when we receive it. Nothing is credited from this screen.">
          {prefill !== null && <div className="mb-3"><Banner tone="info">Prefilled with what is missing: <b>{usd(prefill)}</b>. You can change it.</Banner></div>}
          <div className="mb-3 inline-flex rounded-lg border border-[#d0d5dd] p-0.5 text-sm font-bold">
            {([['usd', 'USD account (ACH / wire)'], ['local', 'Local transfer']] as const).map(([k, l]) => <button key={k} onClick={() => switchTab(k)} aria-pressed={tab === k} className={`rounded-md px-3.5 py-1.5 ${tab === k ? 'bg-ink text-white' : 'text-slate-600'}`}>{l}</button>)}
          </div>
          {tab === 'usd' ? (
            <div className="space-y-3">
              <Field label="Amount (USD)"><input autoFocus aria-label="Amount (USD)" className={inputClass} inputMode="decimal" value={usdAmount} onChange={(e) => { setUsdAmount(e.target.value); setError('') }} /></Field>
              <dl>{row('Beneficiary', state.company.name)}{row('Bank', 'Partner bank (US)')}{row('Routing number', '000000000')}{row('Account number', '4820 1177 3092')}{row('Reference (required)', reference)}</dl>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid items-end gap-3 sm:grid-cols-2">
                <Field label="Sending from"><Select value={cur} onChange={switchCurrency} options={fundingCurrencies()} /></Field>
                <Field label={`Amount (${cur})`}><input aria-label={`Amount (${cur})`} className={inputClass} inputMode="decimal" value={localAmount} onChange={(e) => { setLocalAmount(e.target.value); setError('') }} /></Field>
              </div>
              <dl className="rounded-lg bg-slate-50 px-3">{row('Rate', `1 USD = ${rate.toFixed(rate < 100 ? 3 : 2)} ${cur}`)}{row('Estimated to credit', usd(credit))}{row('Transfer to', `${CURRENCIES[cur].banks[0]}, account in the name of ${state.company.name}`)}{row('Reference (required)', reference)}</dl>
              <p className="flex items-center gap-1.5 text-xs text-slate-500"><Flag code={CURRENCIES[cur].code} />The estimate uses today's rate plus the {(FEES.onRampPct * 100).toFixed(2)}% funding conversion, and can change slightly when the transfer arrives.</p>
            </div>
          )}
          {error && <div className="mt-3"><Banner tone="error">{error}</Banner></div>}
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <span className="text-sm text-slate-500">{credit > 0 ? <>You will receive <b className="text-ink">{usd(credit)}</b> in the vault</> : 'Enter an amount'}</span>
            <Btn perm="fund" variant="lime" tall disabled={credit <= 0} onClick={send}>I sent the transfer</Btn>
          </div>
        </Panel>
      </div>
    </div>
  )
}
