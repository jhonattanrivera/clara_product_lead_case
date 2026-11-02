import type { ReactNode, ButtonHTMLAttributes } from 'react'
import { DISCLAIMER } from '../copy'
import { Icon } from './Icon'

type Variant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-lime text-ink hover:bg-lime-600 disabled:bg-slate-200 disabled:text-slate-400',
  dark: 'bg-ink text-white hover:bg-night disabled:bg-slate-300',
  secondary: 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-brand-700 hover:bg-brand-50 disabled:text-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-slate-300',
}

export function Button({ variant = 'primary', busy, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={`press inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-4 py-3.5 text-[15px] font-bold disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {busy && <Spinner light={variant === 'dark' || variant === 'danger'} />}
      {children}
    </button>
  )
}

export function Spinner({ light = false }: { light?: boolean }) {
  return <span className={`inline-block size-4 animate-spin rounded-full border-2 border-t-transparent ${light ? 'border-white' : 'border-brand-600'}`} />
}

export function Banner({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'error' | 'success'; title?: string; children: ReactNode }) {
  const tones = {
    info: 'bg-sky-50 text-sky-900 border-sky-200',
    warn: 'bg-amber-50 text-amber-900 border-amber-200',
    error: 'bg-rose-50 text-rose-900 border-rose-200',
    success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  }
  return (
    <div className={`row-in rounded-xl border px-4 py-3 text-sm leading-snug ${tones[tone]}`}>
      {title && <div className="mb-0.5 font-semibold">{title}</div>}
      {children}
    </div>
  )
}

export function Badge({ tone, children }: { tone: 'gray' | 'green' | 'amber' | 'red' | 'blue'; children: ReactNode }) {
  const tones = {
    gray: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-rose-100 text-rose-700',
    blue: 'bg-sky-100 text-sky-700',
  }
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}

export function Screen({ title, subtitle, children, footer }: { title?: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-4 px-5 pb-4 pt-3">
        {title && (
          <div className="pt-1">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-[15px] leading-snug text-slate-500">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
      {footer && <div className="sticky bottom-0 space-y-2 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">{footer}</div>}
    </div>
  )
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-sm leading-snug">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 accent-ink" />
      <span>{children}</span>
    </label>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  )
}
// Every form field shares these: inputs, the Select and the date picker line up in any row.
export const fieldBase = 'w-full rounded-[10px] border border-slate-200 bg-white text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'
export const inputClass = `${fieldBase} h-12 px-3.5 text-[15px]`
export const inputSmClass = `${fieldBase} h-9 px-3 text-sm`

/** The legal line that goes wherever the app talks about the balance. */
export const DigitalNote = () => (
  <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-400"><Icon name="info" className="mt-px size-3.5 shrink-0" />{DISCLAIMER}</p>
)
