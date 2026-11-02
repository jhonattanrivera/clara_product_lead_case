// A generic online store payment page. The store only knows its price in local currency: the conversion and the
// spread are the card program's, and the person sees them in the movement detail in the app.
// Pay sends a real authorization through the same flow as any card payment. Like a real store, it only learns approved or declined.
import { useEffect, useState } from 'react'
import { useBus } from '../bus'
import { FX } from '../config'
import { cardDetails, payWithCard } from '../core/services'
import { state, update } from '../core/state'
import { enterAs } from '../core/auth'
import { local } from '../format'
import { Banner, Spinner } from '../ui/Primitives'

type Details = NonNullable<Awaited<ReturnType<typeof cardDetails>>>
const spaced = (pan: string) => pan.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
const STORE_PRICE_USD = 50 // the store's price, set in local currency at the market rate (illustrative)
const fieldCls = 'h-11 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-[15px] text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

export function Checkout() {
  useBus()
  const [d, setD] = useState<Details | null>(null)
  const [loaded, setLoaded] = useState(false)
  const cur = state.withdraw.currency
  const cents = Math.round(STORE_PRICE_USD * FX.mid[cur]) * 100
  const price = local(cents / 100, cur)
  const [shown, setShown] = useState(false)
  const cardId = state.card?.cardId
  useEffect(() => { setLoaded(false); void cardDetails().then((x) => { setD(x); setLoaded(true) }) }, [cardId, state.card?.status])
  const paying = state.cardBusy === 'paying'
  const last = shown ? state.lastPayment : null
  const pay = () => { if (!d) return; setShown(true); void payWithCard('shop_local', cents) }
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-[#e4e7ec] bg-white shadow-sm">
      <div className="grid md:grid-cols-[1fr_1.2fr]">
        <div className="rounded-t-2xl bg-[#f6f8fb] p-7 md:rounded-l-2xl md:rounded-tr-none">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Tienda en línea</div>
          <div className="mt-1 text-xl font-bold">Marketplace Norte</div>
          <div className="mt-6 text-sm text-slate-500">Total a pagar</div>
          <div className="text-4xl font-bold tracking-tight">{price}</div>
          <ul className="mt-6 space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-600">
            <li className="flex justify-between"><span>Pedido #48213</span><span>{price}</span></li>
            <li className="flex justify-between"><span>Envío</span><span>Gratis</span></li>
          </ul>
        </div>
        <div className="p-7">
          <h2 className="text-lg font-bold">Pagar con tarjeta</h2>
          {!loaded ? <div className="mt-6 flex items-center gap-2 text-sm text-slate-500"><Spinner /> Cargando tarjeta…</div> : !d ? (
            <div className="mt-4"><Banner tone="warn" title="No hay una tarjeta activa">Esta cuenta todavía no tiene tarjeta. Abre la vista de empleado y completa la verificación primero.</Banner></div>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); pay() }}>
              <label className="block text-sm font-medium">Número de tarjeta<input aria-label="Número de tarjeta" className={`${fieldCls} mt-1 font-mono`} value={spaced(d.pan)} onChange={() => {}} /></label>
              <div className="grid grid-cols-2 items-end gap-3">
                <label className="block text-sm font-medium">Vencimiento<input aria-label="Vencimiento" className={`${fieldCls} mt-1 font-mono`} value={d.expiry} onChange={() => {}} /></label>
                <label className="block text-sm font-medium">CVV<input aria-label="CVV" className={`${fieldCls} mt-1 font-mono`} value={d.cvv} onChange={() => {}} /></label>
              </div>
              <label className="block text-sm font-medium">Nombre en la tarjeta<input aria-label="Nombre en la tarjeta" className={`${fieldCls} mt-1`} value={d.holder} onChange={() => {}} /></label>
              <button type="submit" disabled={paying} className="press mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-[15px] font-bold text-white disabled:opacity-50">{paying ? <><Spinner /> Procesando…</> : `Pagar ${price}`}</button>
              {last && (
                <div data-testid="checkout-result" className="space-y-2">
                  <Banner tone={last.ok ? 'success' : 'error'} title={last.ok ? 'Pago aprobado' : 'Pago rechazado'}>{last.ok ? `Pedido #48213 por ${price}. Te enviamos la confirmación por correo.` : 'Tu tarjeta no autorizó el pago. El motivo está en la app de tu tarjeta.'}</Banner>
                  <button type="button" className="text-sm font-bold text-brand-700 underline" onClick={() => { enterAs(state.mode === 'indie' ? 'independent' : 'employee'); update((s) => { s.checkoutOpen = false; s.tab = 'activity'; s.activityDetail = last.activityId ?? null }) }}>Ver el movimiento en la app</button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
