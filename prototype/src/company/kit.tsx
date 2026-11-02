import type { ReactNode } from 'react'
import { can } from '../core/auth'
import { Badge } from '../ui/Primitives'

export const Panel = ({ title, hint, action, children, className = '' }: { title?: string; hint?: string; action?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={`fade-up rounded-xl border border-[#e4e7ec] bg-white p-5 ${className}`}>
    {(title || action) && (
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="text-[17px] font-bold">{title}</h2>{hint && <p className="mt-0.5 text-sm text-[#667085]">{hint}</p>}</div>
        {action}
      </div>
    )}
    {children}
  </section>
)
export const Stat = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'lime' }) => (
  <div className={`fade-up h-full rounded-xl p-4 ${tone === 'lime' ? 'bg-lime text-ink' : 'border border-[#e4e7ec] bg-white'}`}>
    <div className={`text-xs font-bold uppercase tracking-wide ${tone === 'lime' ? 'text-ink/70' : 'text-[#667085]'}`}>{label}</div>
    <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
    {sub && <div className={`mt-0.5 text-xs ${tone === 'lime' ? 'text-ink/70' : 'text-[#667085]'}`}>{sub}</div>}
  </div>
)
export const Btn = ({ perm, children, variant = 'dark', tall, ...rest }: { perm?: string; variant?: 'dark' | 'lime' | 'light' | 'danger'; tall?: boolean; children: ReactNode; disabled?: boolean; onClick?: () => void; title?: string }) => {
  const denied = perm ? !can(perm) : false
  const cls = { dark: 'bg-brand-600 text-white hover:bg-brand-700', lime: 'bg-lime text-ink hover:bg-lime-600', light: 'border border-[#d0d5dd] bg-white hover:bg-slate-50', danger: 'bg-rose-600 text-white hover:bg-rose-700' }[variant]
  return (
    <button {...rest} disabled={rest.disabled || denied} title={denied ? 'Your role cannot do this' : rest.title} className={`press rounded-lg px-3.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${tall ? 'min-h-12 py-2' : 'min-h-9 py-1.5'} ${cls}`}>
      {children}{denied && <span className="ml-1.5 text-[10px] opacity-70">locked</span>}
    </button>
  )
}
export const Th = ({ children, right }: { children?: ReactNode; right?: boolean }) => <th className={`py-2 pr-3 text-xs font-bold uppercase tracking-wide text-[#667085] ${right ? 'text-right' : ''}`}>{children}</th>
export const kycTone = (k: string) => (k === 'approved' ? 'green' : k === 'rejected' ? 'red' : k === 'in_review' ? 'blue' : 'amber') as 'green' | 'red' | 'blue' | 'amber'
export const KycBadge = ({ k }: { k: string }) => <Badge tone={kycTone(k)}>{k.replace('_', ' ')}</Badge>
export const dt = (ts: number) => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
