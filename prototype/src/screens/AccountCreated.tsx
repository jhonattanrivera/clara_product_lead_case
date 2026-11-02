import { useBus } from '../bus'
import { LIVE_EMPLOYEE_ID } from '../config'
import { COPY } from '../copy'
import { ledger } from '../core/ledger'
import { startUsing } from '../core/services'
import { state } from '../core/state'
import { usd } from '../format'
import { Banner, Button, DigitalNote, Screen } from '../ui/Primitives'

export function AccountCreated() {
  useBus()
  const b = ledger.employee(LIVE_EMPLOYEE_ID)
  const hasCard = !!state.card
  return (
    <Screen title={hasCard ? COPY.account.title : 'Tu cuenta está lista'} subtitle={COPY.account.body} footer={<Button onClick={startUsing}>Ir a mi cuenta</Button>}>
      <div className="pop hero-clara rounded-2xl p-5 text-white">
        <div className="text-sm text-sky-200">Cuenta en dólares digitales</div>
        <div className="mt-1 font-mono text-lg tracking-wide">{state.accountId}</div>
        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-sky-300">Disponible</div><div className="text-xl font-bold">{usd(b.available)}</div></div>
          <div><div className="text-sky-300">Pendiente</div><div className="text-xl font-bold">{usd(b.pending)}</div></div>
        </div>
      </div>
      {hasCard
        ? <Banner tone="success">Identidad verificada. Tu tarjeta virtual terminada en {state.card?.last4} ya sirve para pagar en línea y con tu teléfono.</Banner>
        : <Banner tone="warn" title="Identidad verificada, tarjeta pendiente">Revisa la pestaña Tarjeta para ver qué falta.</Banner>}
      <DigitalNote />
    </Screen>
  )
}
