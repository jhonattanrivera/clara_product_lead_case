import { useBus } from '../bus'
import { committedFunds, companyBalance, depositsOnTheWay, openAddFunds, operationalBlocker } from '../core/services'
import { acct, ledger } from '../core/ledger'
import { FX } from '../config'
import { allPeople, state, update } from '../core/state'
import { useCountUp } from '../ui/useCountUp'
import { usd } from '../format'
import { Badge, Banner } from '../ui/Primitives'
import { Btn, Panel, Stat, dt } from './kit'

export function Overview() {
  useBus()
  const block = operationalBlocker()
  const held = state.payouts.filter((p) => p.status === 'on_hold').length
  const open = state.exceptions.filter((e) => e.status === 'open').length
  const go = (p: typeof state.companyPage) => update((s) => { s.companyPage = p })
  const rev = ledger.revenueTotal()
  const balance = useCountUp(companyBalance())
  return (
    <div className="space-y-5">
      {block && (
        <Banner tone="warn" title="Your company cannot operate yet">
          {block}. <button className="font-bold underline" onClick={() => go('company')}>Go to verification</button>
        </Banner>
      )}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="hero-clara fade-up rounded-xl p-5 text-white sm:col-span-2">
          <div className="text-sm text-sky-200">{state.company.name} | funding balance</div>
          <div className="mt-1 text-4xl font-bold tracking-tight">{usd(balance)}</div>
          <div className="mt-1 text-xs text-sky-200">{committedFunds() > 0 ? `${usd(committedFunds())} reserved for people finishing KYC` : 'USDC in your own custody vault, one per company'}</div>
          {depositsOnTheWay() > 0 && <div className="mt-1 text-xs font-semibold text-lime">{usd(depositsOnTheWay())} on the way</div>}
          <div className="mt-4"><Btn perm="fund" variant="lime" onClick={() => openAddFunds()}>Add funds</Btn></div>
        </div>
        <Stat label="Platform fees paid" value={usd(ledger.balance(acct.revenue.payoutFee))} sub="Per-payment fee" />
        <Stat label="Your FX earnings" value={usd(ledger.balance(acct.companyMarkup))} sub={`Markup ${(Math.max(0, state.company.spreadPct - FX.platformFloorPct) * 100).toFixed(2)}% on conversions`} tone="lime" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <button onClick={() => go('compliance')} className="text-left"><Stat label="Waiting for approval" value={String(held + open)} sub={`${held} held payments, ${open} exceptions`} /></button>
        <button onClick={() => go('people')} className="text-left"><Stat label="People" value={String(state.company.team.length + allPeople().length)} sub="Team members and payees" /></button>
        <button onClick={() => go('revenue')} className="text-left"><Stat label="Platform revenue" value={usd(rev)} sub="All fee lines" /></button>
      </div>
      <Checklist go={go} />
      <Panel title="Latest activity">
        {state.audit.length === 0 ? <p className="text-sm text-slate-400">Nothing yet.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">{state.audit.slice(0, 6).map((a, i) => <li key={i} className="flex gap-3 py-2"><span className="w-28 shrink-0 text-xs text-slate-400">{dt(a.ts)}</span><span>{a.action}</span></li>)}</ul>
        )}
      </Panel>
    </div>
  )
}

type Step = { title: string; detail: string; status: 'done' | 'pending' | 'action'; label: string; button: string; page: typeof state.companyPage }

function Checklist({ go }: { go: (p: typeof state.companyPage) => void }) {
  const kyb = state.company.kyb
  const pendingApprovals = state.invitees.filter((i) => i.approval === 'pending_approval').length
  const verifiedOwners = state.company.ubos.filter((u) => u.kyc === 'approved').length
  const steps: Step[] = [
    { title: 'Company verification', detail: state.company.kybNote, status: kyb === 'approved' ? 'done' : kyb === 'rejected' ? 'action' : 'pending', label: kyb === 'approved' ? 'Approved' : kyb === 'rejected' ? 'Rejected' : kyb === 'init' ? 'Pending' : 'In review', button: kyb === 'approved' ? 'View' : 'Continue', page: 'company' },
    { title: 'Owners and representatives', detail: `${verifiedOwners} of ${state.company.ubos.length} verified`, status: verifiedOwners === state.company.ubos.length ? 'done' : 'pending', label: verifiedOwners === state.company.ubos.length ? 'Approved' : 'Pending', button: 'Review', page: 'company' },
    { title: 'Fund the vault', detail: `Balance ${usd(companyBalance())}`, status: companyBalance() > 0 ? 'done' : 'action', label: companyBalance() > 0 ? 'Done' : 'To do', button: 'Add funds', page: 'overview' },
    { title: 'Add and approve people', detail: pendingApprovals ? `${pendingApprovals} waiting for an approver` : `${allPeople().length} on the team`, status: pendingApprovals ? 'pending' : allPeople().length ? 'done' : 'action', label: pendingApprovals ? 'Pending approval' : allPeople().length ? 'Done' : 'To do', button: pendingApprovals ? 'Review' : 'Add people', page: 'people' },
    { title: 'Send the first payment', detail: state.payouts.length ? `${state.payouts.length} payment${state.payouts.length > 1 ? 's' : ''} sent` : 'No payments yet', status: state.payouts.length ? 'done' : 'action', label: state.payouts.length ? 'Done' : 'To do', button: 'Go to payments', page: 'payments' },
  ]
  const done = steps.filter((x) => x.status === 'done').length
  const tone = { done: 'green', pending: 'amber', action: 'gray' } as const
  return (
    <Panel title="Set up your account" hint={`${done} of ${steps.length} steps completed`}>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-lime transition-all" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      <ul className="divide-y divide-slate-100">
        {steps.map((st) => (
          <li key={st.title} className="flex flex-wrap items-center gap-3 py-3">
            <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${st.status === 'done' ? 'bg-lime text-ink' : 'bg-slate-100 text-slate-400'}`}>{st.status === 'done' ? '✓' : '•'}</span>
            <div className="min-w-48 flex-1"><div className="text-sm font-bold">{st.title}: <Badge tone={tone[st.status]}>{st.label}</Badge></div><div className="text-xs text-slate-500">{st.detail}</div></div>
            <Btn variant={st.status === 'done' ? 'light' : 'dark'} onClick={() => (st.button === 'Add funds' ? openAddFunds() : go(st.page))}>{st.button}</Btn>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
