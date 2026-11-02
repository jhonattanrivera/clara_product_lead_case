import { useBus } from '../bus'
import { state, update, type ActivityItem } from '../core/state'
import { local, timeLabel, usd } from '../format'
import { Badge, Banner, DigitalNote, Screen } from '../ui/Primitives'
import { Icon } from '../ui/Icon'

const statusBadge: Record<ActivityItem['status'], { tone: 'gray' | 'green' | 'amber' | 'red' | 'blue'; label: string }> = {
  pending: { tone: 'amber', label: 'Pendiente' },
  on_hold: { tone: 'red', label: 'En revisión' },
  completed: { tone: 'green', label: 'Completado' },
  authorized: { tone: 'blue', label: 'Autorizada' },
  cleared: { tone: 'green', label: 'Contabilizada' },
  declined: { tone: 'red', label: 'Rechazada' },
  reversed: { tone: 'gray', label: 'Reversada' },
  expired: { tone: 'gray', label: 'Vencida' },
  processing: { tone: 'blue', label: 'En proceso' },
  failed: { tone: 'red', label: 'Fallido' },
}
const icon = { deposit: 'down', card: 'card', withdrawal: 'up' }

/** Purchases open their detail, from Movimientos or from the list on Inicio. */
export const openMovement = (id: string) => update((s) => { s.tab = 'activity'; s.activityDetail = id })

export function ActivityRow({ a }: { a: ActivityItem }) {
  const b = statusBadge[a.status]
  const struck = ['declined', 'failed', 'reversed', 'expired'].includes(a.status)
  const Row = a.kind === 'card' ? 'button' : 'div'
  return (
    <Row data-activity={a.id} {...(a.kind === 'card' ? { type: 'button' as const, onClick: () => openMovement(a.id) } : {})} className={`row-in flex w-full gap-3 py-3 text-left ${a.kind === 'card' ? 'press -mx-2 rounded-xl px-2 hover:bg-slate-50' : ''}`}>
      <div className={`grid size-10 shrink-0 place-items-center rounded-full ${a.amount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}><Icon name={icon[a.kind]} className="size-[18px]" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="truncate text-[15px] font-semibold">{a.title}</div>
          <div className={`whitespace-nowrap text-[15px] font-semibold ${struck ? 'text-slate-400 line-through' : a.amount > 0 ? 'text-emerald-700' : ''}`}>{a.amount > 0 ? '+' : ''}{usd(a.amount)}</div>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
          <Badge tone={b.tone}>{b.label}</Badge>
          <span>{a.subtitle} · {timeLabel(a.ts)}</span>
        </div>
        {a.note && <div className="mt-1 text-xs leading-snug text-slate-500">{a.note}</div>}
      </div>
    </Row>
  )
}

const rateText = (r: number, c: string) => `1 USD = ${r.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: r < 100 ? 3 : 2 })} ${c}`
const Line = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
  <div className={`flex justify-between gap-3 py-2 ${strong ? 'border-t border-slate-200 font-bold' : ''}`}><dt className={strong ? '' : 'text-slate-500'}>{k}</dt><dd className="text-right font-semibold tabular-nums">{v}</dd></div>
)
const TOTAL_LABEL: Partial<Record<ActivityItem['status'], string>> = {
  authorized: 'Reservado de tu saldo', cleared: 'Total descontado de tu saldo', declined: 'Se habría descontado', reversed: 'Reserva devuelta a tu saldo', expired: 'Reserva devuelta a tu saldo',
}

/** One movement, with the conversion spelled out: the store only knows its own price. */
export function MovementDetail({ a }: { a: ActivityItem }) {
  const b = statusBadge[a.status]
  const fx = a.fx
  const dollars = ['authorized', 'cleared'].includes(a.status) ? Math.abs(a.amount) : fx?.authorized ?? Math.abs(a.amount)
  const changed = !!fx && dollars !== fx.authorized
  const localPrice = fx && fx.rate ? (changed ? Math.round(dollars * fx.rate) : fx.price) : 0
  const atMarket = fx && fx.mid ? Math.round(localPrice / fx.mid) : dollars
  const when = new Date(a.ts)
  return (
    <Screen>
      <button onClick={() => update((s) => { s.activityDetail = null })} className="flex items-center gap-1 text-sm font-bold text-brand-700"><span aria-hidden="true">‹</span> Movimientos</button>
      <div data-testid="movement-detail" className="space-y-4">
        <div className="text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-600"><Icon name={icon[a.kind]} className="size-5" /></div>
          <div className="mt-2 text-[15px] font-semibold">{a.title}</div>
          <div className={`mt-1 text-[32px] font-bold tracking-tight tabular-nums ${['declined', 'reversed', 'expired'].includes(a.status) ? 'text-slate-400 line-through' : ''}`}>{a.amount > 0 ? '+' : ''}{usd(a.amount)}</div>
          <div className="mt-1 flex items-center justify-center gap-2 text-xs text-slate-500"><Badge tone={b.tone}>{b.label}</Badge><span>{when.toLocaleDateString('es-419', { day: 'numeric', month: 'short' })}, {timeLabel(a.ts)}</span></div>
        </div>
        {a.note && <Banner tone={a.status === 'declined' ? 'error' : 'info'}>{a.note}</Banner>}
        {fx && (
          <section>
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Desglose</h2>
            <dl className="rounded-xl bg-slate-50 px-3.5 text-sm">
              {fx.currency === 'USD' ? (
                <>
                  <Line k="Precio en la tienda" v={usd(dollars)} />
                  <Line k="Conversión" v="Compra en USD, sin spread" />
                </>
              ) : (
                <>
                  {changed && <Line k="Autorizado al pagar" v={local(fx.price / 100, fx.currency)} />}
                  <Line k={changed ? 'Monto final de la tienda' : 'Precio en la tienda'} v={`${changed ? '≈ ' : ''}${local(localPrice / 100, fx.currency)}`} />
                  <Line k="Tasa real del mercado" v={rateText(fx.mid!, fx.currency)} />
                  <Line k={`Spread ${(fx.spreadPct * 100).toFixed(2)}% ${fx.spreadBy ? `definido por ${fx.spreadBy}` : 'de la plataforma'}`} v={`+${usd(dollars - atMarket)}`} />
                  <Line k="Tasa aplicada" v={rateText(fx.rate!, fx.currency)} />
                </>
              )}
              <Line strong k={TOTAL_LABEL[a.status] ?? 'Total en dólares'} v={usd(dollars)} />
            </dl>
          </section>
        )}
        <dl className="rounded-xl border border-slate-100 px-3.5 text-sm">
          <Line k="Medio" v={a.kind === 'card' ? 'Tarjeta virtual' : a.subtitle} />
          <Line k="Referencia" v={a.id} />
        </dl>
        <DigitalNote />
      </div>
    </Screen>
  )
}

export function Activity() {
  useBus()
  const open = state.activityDetail ? state.activity.find((a) => a.id === state.activityDetail) : undefined
  if (open) return <MovementDetail a={open} />
  return (
    <Screen title="Movimientos">
      {state.activity.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Aún no hay movimientos. Aquí verás pagos, compras y retiros.</p>
      ) : (
        <div className="divide-y divide-slate-100">{state.activity.map((a) => <ActivityRow key={a.id} a={a} />)}</div>
      )}
    </Screen>
  )
}
