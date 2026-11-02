// "Add to Apple Wallet" provisioning with the steps a real push-provisioning flow shows.
import { useEffect, useState } from 'react'
import { useBus } from '../bus'
import { addToWallet, removeFromWallet } from '../core/services'
import { state } from '../core/state'

const STEPS = ['Validando tu tarjeta con nuestro aliado', 'Protegiéndola para este teléfono', 'Agregándola a tu billetera']

export function WalletBlock() {
  useBus()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const busy = state.walletBusy
  useEffect(() => {
    if (!busy) return
    setStep(0)
    const a = setTimeout(() => setStep(1), 900)
    const b = setTimeout(() => setStep(2), 1800)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [busy])
  useEffect(() => { if (open && state.wallet) { const t = setTimeout(() => setOpen(false), 1600); return () => clearTimeout(t) } }, [open, state.wallet])
  return (
    <>
      {state.wallet ? (
        <div className="fade-up flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm">
          <div><div className="font-bold text-emerald-900">En Apple Wallet</div><div className="text-xs text-emerald-800">Paga acercando tu teléfono. Un número aparte protege tu tarjeta</div></div>
          <button className="text-xs font-bold text-emerald-900 underline" onClick={removeFromWallet}>Quitar</button>
        </div>
      ) : (
        <button aria-label="Añadir a Apple Wallet" onClick={() => { setOpen(true); addToWallet() }} className="press grid w-full place-items-center rounded-[10px] bg-black py-2.5 hover:bg-neutral-900"><img src="/brand/add-to-apple-wallet-es.svg" alt="Añadir a Apple Wallet" className="h-10" /></button>
      )}
      {open && (
        <div className="absolute inset-0 z-40 flex items-end bg-black/40">
          <div className="sheet-up w-full rounded-t-[28px] bg-white p-6 pb-8">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            {state.wallet ? (
              <div className="py-4 text-center">
                <svg viewBox="0 0 52 52" className="mx-auto size-16"><circle cx="26" cy="26" r="24" fill="#86ea63" /><path d="M14 27l8 8 16-17" fill="none" stroke="#021b47" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="draw-check" /></svg>
                <div className="mt-3 text-lg font-bold">Agregada a Apple Wallet</div>
                <p className="text-sm text-slate-500">Ya puedes pagar con tu teléfono.</p>
              </div>
            ) : (
              <div>
                <div className="relative mx-auto mb-5 h-24 w-44">
                  <div className="absolute inset-x-3 top-0 h-20 rounded-xl bg-slate-200" />
                  <div className="absolute inset-x-1.5 top-2 h-20 rounded-xl bg-slate-300" />
                  <div className="tap-phone absolute inset-x-0 top-5 h-20 rounded-xl bg-gradient-to-br from-[#0b0b0d] to-[#25272e] p-3"><img src="/brand/clara-star-white.svg" alt="" className="size-6" /></div>
                </div>
                <div className="text-center text-lg font-bold">Agregando tu tarjeta…</div>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {STEPS.map((t, i) => (
                    <li key={t} className={`flex items-center gap-3 transition ${i <= step ? 'text-ink' : 'text-slate-300'}`}>
                      <span className={`grid size-5 place-items-center rounded-full text-[11px] font-bold ${i < step ? 'bg-lime text-ink' : i === step ? 'ring-pulse bg-lime/60' : 'bg-slate-100'}`}>{i < step ? '✓' : ''}</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
