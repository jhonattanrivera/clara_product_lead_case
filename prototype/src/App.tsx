import { useEffect } from 'react'
import { CompanyApp } from './company/Shell'
import { useBus } from './bus'
import { APP_NAME, type Role } from './config'
import { enterAs, initFromUrl, isOrgRole, logout } from './core/auth'
import { refreshChain } from './core/chain'
import { skipToActive } from './core/services'
import { state, update, type Tab } from './core/state'
import { AccountCreated } from './screens/AccountCreated'
import { Activity } from './screens/Activity'
import { AddMoney } from './screens/AddMoney'
import { Card } from './screens/Card'
import { Checkout } from './screens/Checkout'
import { Consent } from './screens/Consent'
import { Home } from './screens/Home'
import { Invite } from './screens/Invite'
import { Kyc, KycRejected, KycReview } from './screens/Kyc'
import { Signup } from './screens/Signup'
import { Withdraw } from './screens/Withdraw'
import { DemoControls } from './ui/DemoControls'
import { Login } from './ui/Login'
import { PhoneFrame } from './ui/PhoneFrame'
import { Icon } from './ui/Icon'
import { Logo } from './ui/brand'
import { Select } from './ui/Select'

initFromUrl()

function TabBar() {
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'home', label: 'Inicio', icon: 'home' },
    ...(state.mode === 'indie' ? [{ id: 'add' as Tab, label: 'Recargar', icon: 'plus' }] : []),
    { id: 'card', label: 'Tarjeta', icon: 'card' },
    { id: 'activity', label: 'Movimientos', icon: 'list' },
    { id: 'move', label: 'Retirar', icon: 'up' },
  ]
  return (
    <nav className={`grid ${tabs.length === 5 ? 'grid-cols-5' : 'grid-cols-4'} border-t border-slate-100 bg-white pb-2 pt-1.5`}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => update((s) => { s.tab = t.id; s.activityDetail = null })} className={`press flex flex-col items-center gap-0.5 py-1.5 text-[10.5px] font-bold ${state.tab === t.id ? 'text-ink' : 'text-slate-400'}`}>
          <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${state.tab === t.id ? 'bg-lime' : ''}`}><Icon name={t.icon} className="size-[18px]" /></span>{t.label}
        </button>
      ))}
    </nav>
  )
}

function PhoneApp() {
  if (state.step === 'signup') return <Signup />
  if (state.step === 'invite') return <Invite />
  if (state.step === 'consent') return <Consent />
  if (state.step === 'kyc') return <Kyc />
  if (state.step === 'kycReview') return <KycReview />
  if (state.step === 'kycRejected') return <KycRejected />
  if (state.step === 'accountCreated') return <AccountCreated />
  return <div key={`${state.tab}-${state.activityDetail ?? ''}`} className="page-in h-full">{{ home: <Home />, card: <Card />, activity: <Activity />, move: <Withdraw />, add: <AddMoney /> }[state.tab]}</div>
}

const COMPANY_ROLES = [['admin', 'Admin'], ['finance', 'Finance'], ['approver', 'Approver']] as const
const companyLabel = () => `Company (${state.company.name.replace(/\s+(Corp|Inc|LLC|SAS|S\.A\.?)\.?$/i, '')})`

/** Who the presenter is looking at. The company is one view, with its roles as a switch inside it. */
function ViewAs({ role }: { role: Role }) {
  const view = state.checkoutOpen ? 'checkout' : isOrgRole(role) ? 'company' : role
  const choose = (v: string) => {
    if (v === 'company') enterAs(isOrgRole(role) ? role : 'admin')
    else enterAs(v as Role | 'checkout')
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-xs font-bold text-slate-500">View as
        <div className="w-44 font-normal"><Select size="sm" value={view} onChange={choose} options={[
          { value: 'company', label: companyLabel() },
          { value: 'employee', label: 'Employee' },
          { value: 'independent', label: 'Independent' },
          { value: 'partner', label: 'Partner (API)' },
          { value: 'checkout', label: 'Checkout' },
        ]} /></div>
      </label>
      {view === 'company' && (
        <div role="group" aria-label="Company role" className="flex h-9 items-center rounded-[10px] border border-slate-200 bg-white p-0.5 text-xs font-bold">
          {COMPANY_ROLES.map(([r, label]) => <button key={r} aria-pressed={role === r} onClick={() => enterAs(r)} className={`h-full rounded-lg px-2.5 transition ${role === r ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}
        </div>
      )}
    </div>
  )
}

export default function App() {
  useBus()
  // Deep links for rehearsal and screenshots: ?as=<role>  ?preset=active  ?tab=card
  useEffect(() => {
    void refreshChain()
    const p = new URLSearchParams(window.location.search)
    void (async () => {
      if (p.get('preset') === 'active') await skipToActive(p.get('payments') !== '0')
      if (p.get('tab')) update((s) => { s.tab = p.get('tab') as Tab })
      if (p.get('page')) update((s) => { s.companyPage = p.get('page') as typeof s.companyPage })
    })()
  }, [])

  if (!state.auth) return <div className="min-h-screen p-4"><Login /></div>
  const role = state.auth.role
  const org = isOrgRole(role) || role === 'partner'
  const inApp = state.step === 'active'
  return (
    <div className="min-h-screen px-4 py-4 max-sm:p-0">
      <header className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center justify-between gap-3 max-sm:hidden">
        <div className="flex items-center gap-3">{!org && <Logo dark className="h-6" />}<span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-lime">{APP_NAME.replace('Clara ', '')}</span><span className="text-xs text-slate-500">Prototype. Providers are mocked.</span></div>
        <div className="flex items-center gap-2 text-sm">
          <ViewAs role={role} />
          <button onClick={() => update((s) => { s.demoOpen = !s.demoOpen })} aria-pressed={state.demoOpen} className="press hidden items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-bold shadow-sm hover:bg-slate-50 lg:flex"><Icon name="panel" className="size-4" />{state.demoOpen ? 'Hide demo panel' : 'Show demo panel'}</button>
          <button onClick={() => { logout(); }} className="press rounded-full bg-white px-3.5 py-1.5 text-sm font-bold shadow-sm hover:bg-slate-50">Sign out</button>
        </div>
      </header>
      <div className="fixed left-3 top-3 z-30 flex gap-2 sm:hidden">
        <button onClick={() => logout()} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow">Sign out</button>
      </div>
      <main className="mx-auto flex max-w-6xl items-start justify-center gap-6 max-lg:flex-col max-lg:items-stretch">
        <div className="min-w-0 flex-1">
          {state.checkoutOpen ? <Checkout /> : org ? <CompanyApp /> : <PhoneFrame tabBar={inApp ? <TabBar /> : undefined}><PhoneApp /></PhoneFrame>}
        </div>
        {state.demoOpen && <DemoControls />}
      </main>
    </div>
  )
}
