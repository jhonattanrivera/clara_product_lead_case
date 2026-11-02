// The animated virtual card: 3D flip, show/hide PAN and CVV with a 15 s countdown, frozen state.
import { useEffect, useState } from 'react'
import { EMPLOYEES, LIVE_EMPLOYEE_ID } from '../config'
import { ledger } from '../core/ledger'
import { state } from '../core/state'
import { usd } from '../format'
import { Icon } from './Icon'

const REVEAL_MS = 15000

export function VirtualCard() {
  const c = state.card!
  const r = state.revealed
  const [left, setLeft] = useState(REVEAL_MS)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!r) return
    setLeft(REVEAL_MS)
    const t0 = Date.now()
    const i = setInterval(() => setLeft(Math.max(0, REVEAL_MS - (Date.now() - t0))), 100)
    return () => clearInterval(i)
  }, [r])
  const holder = EMPLOYEES.find((e) => e.id === LIVE_EMPLOYEE_ID)!.name
  const avail = ledger.employee(LIVE_EMPLOYEE_ID).available
  const dash = 100 - (left / REVEAL_MS) * 100
  return (
    <div className="flip-scene relative">
      <div className={`flip-card h-[200px] ${r ? 'flipped' : ''} ${c.frozen ? 'saturate-50' : ''}`}>
        {/* Front: Clara black */}
        <div className="flip-face bg-black p-5 text-white shadow-2xl">
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-2"><img src="/brand/clara-star-white.svg" alt="Clara" className="size-9" /><span className="text-[15px] font-medium tracking-tight">black</span></div>
            <span className="rounded-full bg-[#d9f7cc] px-3 py-0.5 text-xs font-medium text-[#1e7a2e]">{c.status === 'canceled' ? 'Cancelada' : c.frozen ? 'Bloqueada' : 'Activa'}</span>
          </div>
          <div className="relative mt-5">
            <div className="text-[22px] font-medium leading-tight tracking-tight">{usd(avail)} USD</div>
            <div className="mt-0.5 text-xs text-white/70">Tarjeta virtual</div>
          </div>
          <div className="absolute inset-x-5 bottom-4 flex items-end justify-between">
            <div className="text-[15px] font-medium tracking-tight">{holder}</div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-white/80">{c.last4}</span>
              <img src="/brand/mastercard.svg" alt="Mastercard" className="h-9" />
            </div>
          </div>
        </div>
        {/* Back */}
        <div className="flip-face flip-back bg-gradient-to-br from-[#15161a] to-[#25272e] text-white shadow-2xl">
          <div className="mt-5 h-10 bg-black" />
          <div className="px-5 pt-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded bg-white/90 px-3 py-2 text-right font-mono text-sm italic text-ink">{r ? r.cvv : '•••'}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">CVV</div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/50">Número de tarjeta</div>
                <div className="font-mono text-sm tracking-widest">{r?.pan}</div>
              </div>
              <button
                onClick={() => { void navigator.clipboard?.writeText(r?.pan.replaceAll(' ', '') ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20"
              >{copied ? 'Copiado ✓' : 'Copiar'}</button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-white/60">
              <svg viewBox="0 0 36 36" className="size-6 -rotate-90"><circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3" /><circle cx="18" cy="18" r="15.9" fill="none" stroke="#86ea63" strokeWidth="3" pathLength="100" strokeDasharray="100" strokeDashoffset={dash} strokeLinecap="round" /></svg>
              Se oculta en {Math.ceil(left / 1000)} s
            </div>
          </div>
        </div>
      </div>
      {c.frozen && (
        <div className="pop pointer-events-none absolute inset-0 grid place-items-center rounded-[20px] bg-slate-900/30 backdrop-blur-[2px]">
          <span className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-sm font-bold text-white shadow-lg"><Icon name="lock" className="size-4" />{c.status === 'canceled' ? 'Cancelada' : c.lockedBy === 'company' ? 'Bloqueada por tu empresa' : 'Bloqueada'}</span>
        </div>
      )}
    </div>
  )
}
