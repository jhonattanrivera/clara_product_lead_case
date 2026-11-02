import { useBus } from '../bus'
import { COMPANY, EMPLOYEES, LIVE_EMPLOYEE_ID } from '../config'
import { COPY } from '../copy'
import { ledger } from '../core/ledger'
import { payoutsOf, state, update } from '../core/state'
import { usd } from '../format'
import { Banner, DigitalNote, Screen } from '../ui/Primitives'
import { Icon } from '../ui/Icon'
import { useCountUp } from '../ui/useCountUp'
import { ActivityRow } from './Activity'

const HeroRow = ({ label, value }: { label: string; value: number }) => (
  <div className="row-in mt-2 flex items-center justify-between rounded-xl bg-white/10 px-3.5 py-2.5 text-sm">
    <span className="text-sky-100">{label}</span><span className="font-semibold">{usd(value)}</span>
  </div>
)

export function Home() {
  useBus()
  const b = ledger.employee(LIVE_EMPLOYEE_ID)
  const shown = useCountUp(b.available)
  const indie = state.mode === 'indie'
  const waiting = indie ? state.activity.length === 0 : payoutsOf(LIVE_EMPLOYEE_ID).length === 0
  const go = (tab: 'card' | 'move' | 'activity' | 'add') => update((s) => { s.tab = tab })
  return (
    <Screen>
      <div className="pt-1 text-[15px] text-slate-500">Hola, {EMPLOYEES[0].name.split(' ')[0]}</div>

      <div className="hero-clara rounded-2xl p-5 text-white shadow-lg">
        <div className="text-sm text-sky-200">Saldo disponible en dólares digitales</div>
        <div className="mt-1 text-[40px] font-bold leading-none tracking-tight">{usd(shown)}</div>
        <div className="mt-3" />
        <HeroRow label="Pendiente" value={b.pending} />
        {b.onHold > 0 && <HeroRow label="En revisión" value={b.onHold} />}
        {b.held > 0 && <HeroRow label="Reservado por la tarjeta" value={b.held} />}
        {b.owed > 0 && <HeroRow label="Por descontar" value={b.owed} />}
      </div>

      {b.pending > 0 && <Banner tone="warn" title="Parte de tu dinero sigue pendiente">{COPY.pendingExplainer}</Banner>}
      {b.onHold > 0 && <Banner tone="error" title="Pago en revisión">{COPY.holdExplainer}</Banner>}
      {b.owed > 0 && <Banner tone="warn" title={`Debes ${usd(b.owed)}`}>{COPY.owedExplainer}</Banner>}

      {waiting && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-center">
          <div className="text-sm font-semibold">{indie ? 'Recarga para empezar' : `Esperando tu primer pago de ${COMPANY.name}`}</div>
          <p className="mt-1 text-xs text-slate-500">{indie ? 'Recarga en moneda local o recibe un pago desde EE. UU.' : 'Te avisaremos apenas llegue.'}</p>
        </div>
      )}

      <div className={`grid ${indie ? 'grid-cols-4' : 'grid-cols-3'} gap-2.5 text-[13px] font-semibold`}>
        {indie && <Quick icon="plus" label="Recargar" onClick={() => go('add')} />}
        <Quick icon="card" label="Tarjeta" onClick={() => go('card')} />
        <Quick icon="up" label="Retirar" onClick={() => go('move')} />
        <Quick icon="list" label="Movimientos" onClick={() => go('activity')} />
      </div>

      {state.activity.length > 0 && (
        <div>
          <div className="mb-1 mt-2 text-sm font-bold">Recientes</div>
          <div className="divide-y divide-slate-100">{state.activity.slice(0, 3).map((a) => <ActivityRow key={a.id} a={a} />)}</div>
        </div>
      )}

      <details className="group rounded-xl bg-slate-50 p-3.5 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">{COPY.dollars.title}<Icon name="plus" className="size-4 transition group-open:rotate-45" /></summary>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{COPY.dollars.body} {COPY.dollars.notBank}</p>
      </details>
      <DigitalNote />
    </Screen>
  )
}

const Quick = ({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) => (
  <button onClick={onClick} className="press flex flex-col items-center gap-1.5 rounded-xl bg-slate-50 py-3.5 hover:bg-slate-100">
    <span className="grid size-9 place-items-center rounded-full bg-white shadow-sm"><Icon name={icon} className="size-[18px]" /></span>{label}
  </button>
)
