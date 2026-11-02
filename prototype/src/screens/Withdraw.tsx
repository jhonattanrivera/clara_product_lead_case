import { useEffect, useState } from 'react'
import { useBus } from '../bus'
import { COMPANY, CURRENCIES, FX, LIVE_EMPLOYEE_ID } from '../config'
import { COPY } from '../copy'
import { ledger } from '../core/ledger'
import { backToWithdrawForm, confirmWithdrawal, requestQuote, resetWithdrawal } from '../core/services'
import { state, update } from '../core/state'
import { local, usd } from '../format'
import { Banner, Button, DigitalNote, Field, Screen, inputClass } from '../ui/Primitives'
import { Select } from '../ui/Select'
import { CountryCell } from '../ui/countries'

function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}

const pct = (v: number) => `${(v * 100).toFixed(2)}%`
const rate = (v: number, c: string) => `1 USD = ${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${c}`

export function Withdraw() {
  useBus()
  const now = useNow()
  const w = state.withdraw
  const b = ledger.employee(LIVE_EMPLOYEE_ID)
  const q = w.quote
  const cur = CURRENCIES[w.currency]
  const setBank = (patch: Partial<typeof w.bank>) => update((s) => { Object.assign(s.withdraw.bank, patch) })

  if (w.phase === 'success' && w.receipt) {
    return (
      <Screen title="Retiro enviado" footer={<Button onClick={resetWithdrawal}>Listo</Button>}>
        <div className="pop rounded-2xl bg-emerald-50 p-5 text-center">
          <svg viewBox="0 0 52 52" className="mx-auto size-14"><circle cx="26" cy="26" r="24" fill="#86ea63" /><path d="M14 27l8 8 16-17" fill="none" stroke="#021b47" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="draw-check" /></svg>
          <div className="mt-2 text-sm text-emerald-800">Recibirás</div>
          <div className="text-3xl font-bold text-emerald-900">{local(w.receipt.localAmount, w.receipt.currency)}</div>
          <div className="mt-2 text-xs text-emerald-800">en {w.bank.bank} · Ref. {w.receipt.reference}</div>
        </div>
      </Screen>
    )
  }

  if (w.phase === 'amount' || w.phase === 'quoting' || !q) {
    return (
      <Screen
        title="Retirar"
        subtitle={`Convierte tus dólares digitales a ${w.currency} y envíalos a tu banco en ${cur.country === 'Peru' ? 'Perú' : cur.country}.`}
        footer={<Button busy={w.phase === 'quoting'} onClick={() => void requestQuote()}>{w.phase === 'quoting' ? 'Cotizando…' : 'Cotizar'}</Button>}
      >
        {w.error && <Banner tone="error" title={w.error.startsWith('Tu banco') ? 'El retiro falló' : undefined}>{w.error}</Banner>}
        <Field label="Monto (USD)">
          <input className={inputClass} inputMode="decimal" placeholder="0.00" value={w.amountUsd} onChange={(e) => update((s) => { s.withdraw.amountUsd = e.target.value })} />
        </Field>
        <div className="-mt-2 flex justify-between text-xs text-slate-500">
          <span>Disponible para retirar: <b>{usd(b.available)}</b></span>
          <button className="font-semibold text-brand-700" onClick={() => update((s) => { s.withdraw.amountUsd = (b.available / 100).toFixed(2) })}>Máximo</button>
        </div>
        {b.pending + b.onHold > 0 && <Banner tone="warn">El saldo que aún no está disponible ({usd(b.pending + b.onHold)}) no se puede retirar.</Banner>}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold">Cuenta bancaria · <CountryCell code={cur.code} lang="es" /></div>
          <Field label="Banco">
            <Select placeholder="Elige un banco" value={w.bank.bank} onChange={(v) => setBank({ bank: v })} options={cur.banks.map((x) => ({ value: x, label: x }))} />
          </Field>
          <Field label={cur.accountLabel}><input className={inputClass} inputMode="numeric" value={w.bank.account} onChange={(e) => setBank({ account: e.target.value })} placeholder={cur.accountPlaceholder} /></Field>
          <Field label="Titular de la cuenta"><input className={inputClass} value={w.bank.holder} onChange={(e) => setBank({ holder: e.target.value })} /></Field>
        </div>
      </Screen>
    )
  }

  const remaining = Math.min(q.ttlMs, Math.max(0, q.expiresAt - now))
  const busy = w.phase === 'processing'
  const expired = remaining === 0 && !busy // once confirmed, the rate is locked: the countdown no longer applies
  const secs = Math.ceil(remaining / 1000)
  const barPct = Math.min(100, (remaining / q.ttlMs) * 100)
  const lastDigits = w.bank.account.replace(/\s/g, '').slice(-4)
  const markup = state.mode === 'indie' ? 0 : Math.max(0, q.spreadPct - FX.platformFloorPct)

  return (
    <Screen
      title="Revisa y confirma"
      footer={expired
        ? <Button onClick={() => void requestQuote()}>Pedir nueva cotización</Button>
        : <Button busy={busy} onClick={() => void confirmWithdrawal()}>{busy ? 'Enviando a tu banco…' : `Confirmar · ${local(q.localAmount, q.currency)}`}</Button>}
    >
      <div className={`rounded-2xl p-4 transition-colors ${expired ? 'bg-rose-50' : 'bg-slate-50'}`}>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{busy ? 'Tasa asegurada' : expired ? 'Cotización vencida' : 'Cotización válida por'}</span>
          {!busy && <span className={`font-mono text-lg font-bold ${expired ? 'text-rose-600' : secs <= 8 ? 'text-amber-600' : 'text-ink'}`}>0:{String(secs).padStart(2, '0')}</span>}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full transition-all duration-300 ${expired ? 'bg-rose-400' : 'bg-brand-600'}`} style={{ width: `${busy ? 100 : barPct}%` }} /></div>
        <dl className="mt-4 space-y-2 text-sm">
          <Line k="Envías" v={usd(q.usd)} />
          <Line k="Comisión" v={q.fee ? usd(q.fee) : 'Gratis (una por pago)'} />
          <Line k="Tasa real del mercado" v={rate(q.mid, q.currency)} />
          <Line k={`Spread (${pct(q.spreadPct)})`} v={usd(q.spreadUsd)} />
          {markup > 0 && <p className="-mt-1 text-right text-xs text-slate-500">Incluye {pct(markup)} definido por {COMPANY.name}</p>}
          <Line k="Tu tasa" v={rate(q.rate, q.currency)} />
          <div className="my-1 border-t border-slate-200" />
          <Line k="Recibes" v={local(q.localAmount, q.currency)} strong />
          <Line k="En" v={`${w.bank.bank} ···${lastDigits}`} />
        </dl>
      </div>

      {expired && <Banner tone="error">{COPY.withdraw.quoteExpired}</Banner>}
      {w.error && !expired && <Banner tone="error">{w.error}</Banner>}

      {!busy && <button className="w-full text-center text-xs font-semibold text-slate-400" onClick={backToWithdrawForm}>Volver</button>}
      <DigitalNote />
    </Screen>
  )
}

const Line = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
  <div className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className={strong ? 'text-lg font-bold' : 'font-medium'}>{v}</dd></div>
)
