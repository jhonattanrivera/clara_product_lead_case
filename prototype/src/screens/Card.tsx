import { useEffect, useRef, useState } from 'react'
import { useBus } from '../bus'
import { COMPANY, FX, LIVE_EMPLOYEE_ID, MERCHANTS } from '../config'
import { COPY } from '../copy'
import { ledger } from '../core/ledger'
import { current } from '../core/machines'
import { cancelCard, cardCharge, hideCard, merchantDefault, payWithCard, replaceCard, revealCard, setCardLimits, submitCardholderInfo, toggleFreeze } from '../core/services'
import { state } from '../core/state'
import { parseAmount, usd } from '../format'
import { Banner, Button, Field, Screen, inputClass } from '../ui/Primitives'
import { Icon } from '../ui/Icon'
import { VirtualCard } from '../ui/VirtualCard'
import { WalletBlock } from '../ui/WalletSheet'

const Toggle = ({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) => (
  <div className="flex items-center justify-between gap-3 py-2.5">
    <div><div className="text-sm font-bold">{label}</div><div className="text-xs text-slate-500">{hint}</div></div>
    <button role="switch" aria-label={label} aria-checked={on} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-lime' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  </div>
)

const pct = (v: number) => `${(v * 100).toFixed(2)}%`

function NoCard() {
  useBus()
  const status = current('cardholder', LIVE_EMPLOYEE_ID)
  const [address, setAddress] = useState('Av. Larco 345, Lima')
  if (status === 'needs_info') {
    return (
      <Screen title="Tu tarjeta" footer={<Button busy={state.cardBusy === 'issuing'} disabled={!address.trim()} onClick={() => void submitCardholderInfo()}>Enviar</Button>}>
        <Banner tone="warn" title={COPY.card.needsInfoTitle}>{COPY.card.needsInfoBody}</Banner>
        <Field label="Tu dirección"><input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
      </Screen>
    )
  }
  if (status === 'denied') return <Screen title="Tu tarjeta"><Banner tone="error" title={COPY.card.deniedTitle}>{COPY.card.deniedBody}</Banner></Screen>
  return <Screen title="Tu tarjeta"><p className="py-10 text-center text-sm text-slate-400">Estamos emitiendo tu tarjeta…</p></Screen>
}

export function Card() {
  useBus()
  const [shake, setShake] = useState(0)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const c = state.card
  const ctl = state.cardCtl
  const indie = state.mode === 'indie'
  const maxPer = indie ? 5000 : state.company.limits.perPaymentUsd
  const maxDay = indie ? 10000 : state.company.limits.dailyUsd
  const last = state.lastPayment
  useEffect(() => { if (last && !last.ok) setShake((n) => n + 1) }, [last])

  if (!c) return <NoCard />
  if (c.status === 'canceled') {
    return (
      <Screen title="Tu tarjeta" footer={<Button busy={state.cardBusy === 'issuing'} onClick={() => void replaceCard()}>Pedir una tarjeta nueva</Button>}>
        <VirtualCard />
        <p className="text-sm text-slate-500">Esta tarjeta ya no acepta compras. La nueva tiene otro número y conserva tu saldo.</p>
      </Screen>
    )
  }
  const lockedByCompany = c.lockedBy === 'company'
  return (
    <Screen title="Tu tarjeta">
      <div key={shake} className={shake ? 'shake' : ''}><VirtualCard /></div>

      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" busy={state.cardBusy === 'freezing'} disabled={lockedByCompany} onClick={() => void toggleFreeze()}><Icon name={c.frozen ? 'unlock' : 'lock'} className="size-[18px]" />{c.frozen ? 'Desbloquear' : 'Bloquear'}</Button>
        {state.revealed
          ? <Button variant="dark" onClick={hideCard}><Icon name="eyeOff" className="size-[18px]" />Ocultar datos</Button>
          : <Button variant="secondary" busy={state.cardBusy === 'revealing'} disabled={c.frozen} onClick={() => void revealCard()}><Icon name="eye" className="size-[18px]" />Ver datos</Button>}
      </div>
      {lockedByCompany && <Banner tone="warn">{COPY.card.lockedByCompany}</Banner>}
      <p className="-mt-1 text-xs text-slate-400">Nuestro aliado de tarjetas muestra el número directamente y se oculta a los 15 segundos. Nosotros nunca lo vemos ni lo guardamos.</p>

      <WalletBlock />

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="flex items-baseline justify-between">
          <div className="text-[15px] font-bold">Límites y controles</div>
          <div className="text-xs text-slate-500">Gastado hoy {usd(state.spentToday)}</div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-lime transition-all duration-700" style={{ width: `${Math.min(100, (state.spentToday / 100 / ctl.dailyUsd) * 100)}%` }} /></div>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-bold text-slate-500">Por compra: <span className="text-ink">{usd(ctl.perTxnUsd * 100)}</span>
            <input type="range" min={10} max={maxPer} step={10} value={ctl.perTxnUsd} onChange={(e) => setCardLimits({ perTxnUsd: Number(e.target.value) })} className="mt-1 w-full accent-ink" />
          </label>
          <label className="block text-xs font-bold text-slate-500">Por día: <span className="text-ink">{usd(ctl.dailyUsd * 100)}</span>
            <input type="range" min={10} max={maxDay} step={10} value={ctl.dailyUsd} onChange={(e) => setCardLimits({ dailyUsd: Number(e.target.value) })} className="mt-1 w-full accent-ink" />
          </label>
        </div>
        {!indie && <p className="mt-2 text-xs text-slate-400">{COMPANY.name} permite hasta {usd(maxPer * 100)} por compra y {usd(maxDay * 100)} por día.</p>}
        <div className="mt-2 divide-y divide-slate-100">
          <Toggle on={ctl.international} onChange={(v) => setCardLimits({ international: v })} label="Pagos internacionales" hint="Apagado, solo funciona en tu país" />
          <Toggle on={ctl.online} onChange={(v) => setCardLimits({ online: v })} label="Pagos en línea" hint="Apagado, solo funciona en tiendas físicas" />
        </div>
      </div>

      {confirmCancel ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
          <p className="text-rose-900">¿Cancelar esta tarjeta? No se puede deshacer. Tu saldo no cambia.</p>
          <div className="mt-2 grid grid-cols-2 gap-2"><Button variant="danger" onClick={() => { cancelCard(); setConfirmCancel(false) }}>Sí, cancelar</Button><Button variant="secondary" onClick={() => setConfirmCancel(false)}>No</Button></div>
        </div>
      ) : <button className="w-full text-center text-xs font-semibold text-slate-400" onClick={() => setConfirmCancel(true)}>Cancelar tarjeta</button>}
    </Screen>
  )
}
