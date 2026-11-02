import { useBus } from '../bus'
import { APP_SCHEME, COMPANY, EMPLOYEES } from '../config'
import { COPY } from '../copy'
import { acceptInvite } from '../core/services'
import { state, update } from '../core/state'
import { usd } from '../format'
import { Button, DigitalNote, Screen } from '../ui/Primitives'

const me = EMPLOYEES[0]

export function Invite() {
  useBus()
  const link = state.inviteChannel === 'link'
  return (
    <Screen footer={<Button onClick={acceptInvite}>{COPY.invite.cta}</Button>}>
      <div className="flex rounded-full bg-slate-100 p-1 text-sm font-semibold">
        {(['email', 'link'] as const).map((c) => (
          <button key={c} onClick={() => update((s) => { s.inviteChannel = c })} className={`flex-1 rounded-full py-2 transition ${state.inviteChannel === c ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
            {c === 'email' ? 'Desde correo' : 'Desde enlace'}
          </button>
        ))}
      </div>

      {!link ? (
        <div className="fade-up rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-ink text-sm font-bold text-white">A</div>
            <div className="text-sm leading-tight">
              <div className="font-semibold">{COMPANY.name}</div>
              <div className="text-slate-500">para {me.name}</div>
            </div>
          </div>
          <div className="mb-2 text-[17px] font-bold leading-snug">{COPY.invite.emailSubject}</div>
          <p className="text-sm leading-relaxed text-slate-600">{COPY.invite.emailBody}</p>
        </div>
      ) : (
        <div className="fade-up space-y-2 rounded-2xl bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{COPY.invite.deepLinkHint}</div>
          <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white p-3 text-sm shadow-sm">
            {COMPANY.name}: tu cuenta en dólares digitales está lista para activar.
            <div className="mt-1 break-all font-mono text-xs text-brand-700 underline">{APP_SCHEME}://invite/acme?t=8f3a91</div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-brand-50 p-4">
        <div className="text-sm text-slate-600">{state.batches > 0 ? 'Tu primer pago te está esperando' : 'Tu primer pago'}</div>
        <div className="mt-0.5 text-2xl font-bold text-brand-700">{usd(me.amountUsd * 100)}</div>
        <div className="text-sm text-slate-500">{COPY.payTypes[me.type] ?? me.type} · de {COMPANY.name}</div>
      </div>
      <DigitalNote />
    </Screen>
  )
}
