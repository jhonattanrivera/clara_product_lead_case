import { useEffect, useState } from 'react'
import { useBus } from '../bus'
import { COPY } from '../copy'
import { submitKyc } from '../core/services'
import { state, update } from '../core/state'
import { Banner, Button, Screen, Spinner } from '../ui/Primitives'
import { Icon } from '../ui/Icon'

function Capture({ label, done, onCapture, kind, disabled }: { label: string; done: boolean; onCapture: () => void; kind: 'id' | 'selfie'; disabled?: boolean }) {
  return (
    <button onClick={onCapture} disabled={disabled} className={`press flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left ${done ? 'border-emerald-300 bg-emerald-50' : 'border-dashed border-slate-300 hover:border-brand-500'}`}>
      <div className={`grid size-14 shrink-0 place-items-center rounded-xl ${done ? 'bg-white text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
        <Icon name={done ? 'check' : kind === 'id' ? 'id' : 'face'} className="size-7" />
      </div>
      <div className="text-sm">
        <div className="font-semibold">{label}</div>
        <div className={done ? 'text-emerald-700' : 'text-slate-500'}>{done ? 'Capturada' : 'Toca para capturar'}</div>
      </div>
    </button>
  )
}

function Checking() {
  const [step, setStep] = useState(0)
  useEffect(() => { const t = setInterval(() => setStep((n) => Math.min(n + 1, COPY.kyc.steps.length - 1)), 600); return () => clearInterval(t) }, [])
  return (
    <ul className="row-in space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
      {COPY.kyc.steps.map((t, i) => (
        <li key={t} className={`flex items-center gap-2.5 transition ${i <= step ? 'text-ink' : 'text-slate-300'}`}>
          {i < step ? <span className="grid size-4 place-items-center rounded-full bg-lime text-ink"><Icon name="check" className="size-3" /></span> : i === step ? <Spinner /> : <span className="size-4 rounded-full bg-slate-200" />}
          {t}
        </li>
      ))}
    </ul>
  )
}

export function Kyc() {
  useBus()
  const k = state.kyc
  const submitting = k.status === 'submitting'
  return (
    <Screen
      title={COPY.kyc.title}
      subtitle={COPY.kyc.intro}
      footer={<Button busy={submitting} disabled={!k.idPhoto || !k.selfie} onClick={() => void submitKyc()}>{submitting ? 'Verificando…' : 'Enviar para verificación'}</Button>}
    >
      {k.status === 'unreadable' && <div className="shake"><Banner tone="error" title={COPY.kyc.unreadableTitle}>{COPY.kyc.unreadableBody}</Banner></div>}
      <Capture kind="id" label="Foto de tu documento" done={k.idPhoto} disabled={submitting} onCapture={() => update((s) => { s.kyc.idPhoto = true; if (s.kyc.status === 'unreadable') s.kyc.status = 'none' })} />
      <Capture kind="selfie" label="Selfie" done={k.selfie} disabled={submitting} onCapture={() => update((s) => { s.kyc.selfie = true })} />
      {submitting && <Checking />}
    </Screen>
  )
}

export function KycReview() {
  useBus()
  return (
    <Screen title={COPY.kyc.reviewTitle} subtitle={COPY.kyc.reviewBody}>
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-amber-50 py-10">
        <Spinner />
        <div className="text-sm font-semibold text-amber-900">En revisión</div>
        <div className="text-xs text-amber-800">Caso {state.kyc.caseId}</div>
      </div>
    </Screen>
  )
}

export function KycRejected() {
  return (
    <Screen title={COPY.kyc.rejectedTitle} subtitle={COPY.kyc.rejectedBody}>
      <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-600">Caso {state.kyc.caseId}</div>
    </Screen>
  )
}
