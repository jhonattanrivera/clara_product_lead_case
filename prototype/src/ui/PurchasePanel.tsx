// Sidebar tool: send a purchase through the card authorization flow (same path the merchant checkout uses).
import { useState } from 'react'
import { useBus } from '../bus'
import { COMPANY, FX, LIVE_EMPLOYEE_ID, MERCHANTS } from '../config'
import { ledger } from '../core/ledger'
import { cardCharge, merchantDefault, payWithCard, toggleFreeze } from '../core/services'
import { state } from '../core/state'
import { parseAmount, usd } from '../format'
import { Banner, Button, Field, inputClass } from './Primitives'

const pct = (v: number) => `${(v * 100).toFixed(2)}%`
const LIST = MERCHANTS.filter((m) => !m.hidden)

export function PurchasePanel() {
  useBus()
  const [merchant, setMerchant] = useState(LIST[0].id)
  const [amount, setAmount] = useState(String(merchantDefault(LIST[0].id) / 100))
  const b = ledger.employee(LIVE_EMPLOYEE_ID)
  const cents = parseAmount(amount)
  const charge = cardCharge(merchant, cents ?? 0)
  const last = state.lastPayment
  const indie = state.mode === 'indie'
  const markup = indie ? 0 : Math.max(0, charge.spreadPct - FX.platformFloorPct)
  const usable = !!state.card && state.card.status !== 'canceled'
  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500"><span>Send a purchase to the active card</span><span>Available <b>{usd(b.available)}</b></span></div>
      {!usable && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">The active user has no card yet.</p>}
      <div className="flex flex-wrap gap-1.5">
        {LIST.map((m) => (
          <button key={m.id} onClick={() => { setMerchant(m.id); setAmount(String(merchantDefault(m.id) / 100)) }} className={`press rounded-full border px-2.5 py-1 text-[11px] font-bold ${merchant === m.id ? 'border-ink bg-ink text-white' : 'border-slate-200 text-slate-600'}`}>{m.name.replace(/ \(.*\)/, '')}</button>
        ))}
      </div>
      <Field label={`Amount (${charge.currency})`}><input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      {charge.currency === 'USD'
        ? <p className="text-xs text-slate-500">Charged in USD, no conversion.</p>
        : (
          <dl className="space-y-1 rounded-lg bg-slate-50 p-2.5 text-xs">
            <div className="flex justify-between"><dt className="text-slate-500">Market rate</dt><dd className="font-semibold">1 USD = {charge.mid!.toFixed(2)} {charge.currency}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Spread</dt><dd className="font-semibold">{pct(charge.spreadPct)}{markup > 0 && <span className="font-normal text-slate-500"> ({pct(markup)} {COMPANY.name})</span>}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Charged to balance</dt><dd className="font-bold">{usd(charge.usdCents)}</dd></div>
          </dl>
        )}
      <Button busy={state.cardBusy === 'paying'} disabled={!cents || !usable} onClick={() => { if (cents) void payWithCard(merchant, cents) }}>{state.cardBusy === 'paying' ? 'Authorizing…' : 'Pay with the card'}</Button>
      {last && (
        <div>
          <Banner tone={last.ok ? 'success' : 'error'} title={last.ok ? 'Authorized' : 'Declined'}>{last.message}</Banner>
          {last.code === 'card_frozen' && state.card?.lockedBy !== 'company' && <Button variant="secondary" className="mt-2" onClick={() => void toggleFreeze()}>Unlock the card</Button>}
        </div>
      )}
    </div>
  )
}
