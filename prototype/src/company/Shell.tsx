import { useBus } from '../bus'
import { can } from '../core/auth'
import { operationalBlocker } from '../core/services'
import { state, update, type CompanyPage as Page } from '../core/state'
import { Icon } from '../ui/Icon'
import { Logo } from '../ui/brand'
import { Compliance } from './Compliance'
import { CompanyPage } from './Company'
import { Overview } from './Overview'
import { Partner } from './Partner'
import { Payments } from './Payments'
import { People } from './People'
import { Pricing } from './Pricing'
import { Revenue } from './Revenue'
import { Treasury } from './Treasury'
import { AddFundsModal } from './AddFunds'

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'people', label: 'People', icon: 'users' },
  { id: 'payments', label: 'Payments', icon: 'send' },
  { id: 'compliance', label: 'Compliance', icon: 'shield' },
  { id: 'pricing', label: 'Pricing and FX', icon: 'percent' },
  { id: 'revenue', label: 'Revenue', icon: 'chart' },
  { id: 'treasury', label: 'Treasury', icon: 'vault' },
  { id: 'company', label: 'Company', icon: 'building' },
]

function Sidebar({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <nav className="flex flex-col gap-1 rounded-xl bg-ink p-3 text-white md:sticky md:top-4 md:min-h-[calc(100vh-6rem)] max-md:flex-row max-md:overflow-x-auto">
      <div className="mb-4 hidden px-2 pt-1 md:block"><Logo className="h-5" /></div>
      {children}
      <div className="mt-auto hidden rounded-lg bg-white/5 p-3 text-xs text-sky-100 md:block">{footer}</div>
    </nav>
  )
}

const itemClass = (active: boolean) => `press relative flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm font-medium ${active ? 'bg-white/10 text-white' : 'text-sky-100/80 hover:bg-white/5 hover:text-white'}`

export function CompanyApp() {
  useBus()
  const isPartner = state.auth?.role === 'partner'
  const page = state.companyPage
  const pending = state.payouts.filter((p) => p.status === 'on_hold').length + state.exceptions.filter((e) => e.status === 'open').length
  const toastNode = state.toast?.audience === 'company' && <div className="toast-in fixed left-1/2 top-4 z-50 max-w-md -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-lg">{state.toast.text}</div>

  // A partner works through the API. It never sees a customer company's data.
  if (isPartner) {
    return (
      <div className="grid gap-5 md:grid-cols-[13.5rem_1fr]">
        <Sidebar footer={<>Signed in as <b className="text-white">{state.auth?.name}</b>. API access only.</>}>
          <button className={itemClass(true)}><span className="absolute inset-y-2 left-0 w-1 rounded-full bg-lime" /><Icon name="code" className="size-[18px]" />API and webhooks</button>
        </Sidebar>
        <div className="min-w-0">{toastNode}<Partner /></div>
      </div>
    )
  }
  return (
    <div className="grid gap-5 md:grid-cols-[13.5rem_1fr]">
      <Sidebar footer={<>Signed in as <b className="text-white">{state.auth?.name}</b> ({state.auth?.role}).<div className="mt-1 text-sky-200/80">{can('pricing') ? 'Full access.' : can('pay') ? 'Can fund and pay.' : can('approve') ? 'Can approve only.' : 'Read only.'}</div></>}>
        {NAV.map((n) => (
          <button key={n.id} onClick={() => update((s) => { s.companyPage = n.id })} className={itemClass(page === n.id)}>
            {page === n.id && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-lime" />}
            <Icon name={n.icon} className="size-[18px]" />{n.label}
            {n.id === 'compliance' && pending > 0 && <span className="ml-auto rounded-full bg-lime px-1.5 text-[11px] font-bold text-ink">{pending}</span>}
            {n.id === 'company' && operationalBlocker() && <span className="ml-auto size-2 rounded-full bg-amber-400" />}
          </button>
        ))}
      </Sidebar>
      <div className="min-w-0">
        {toastNode}
        <AddFundsModal />
        <div key={page} className="page-in">
          {{ overview: <Overview />, people: <People />, payments: <Payments />, compliance: <Compliance />, pricing: <Pricing />, revenue: <Revenue />, treasury: <Treasury />, company: <CompanyPage /> }[page]}
        </div>
      </div>
    </div>
  )
}
