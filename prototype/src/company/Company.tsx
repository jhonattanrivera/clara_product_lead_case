import { useBus } from '../bus'
import { operationalBlocker, resolveKybReview, retryKyb, submitKyb } from '../core/services'
import { state } from '../core/state'
import { Banner, Badge } from '../ui/Primitives'
import { Btn, KycBadge, Panel } from './kit'

const steps = ['init', 'pending', 'in_review', 'approved'] as const
const label: Record<string, string> = { init: 'Not submitted', pending: 'Pending', in_review: 'In review', approved: 'Approved', rejected: 'Rejected', retry: 'Retry needed' }

export function CompanyPage() {
  useBus()
  const c = state.company
  const idx = steps.indexOf(c.kyb as (typeof steps)[number])
  const block = operationalBlocker()
  return (
    <div className="space-y-5">
      <Panel title="Company verification (KYB)" hint="One applicant for the company. Owners and representatives each have their own identity check.">
        <ol className="mb-4 flex items-center gap-2 text-xs font-bold">
          {steps.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span className={`grid size-7 shrink-0 place-items-center rounded-full ${c.kyb === 'rejected' && i >= 2 ? 'bg-rose-100 text-rose-700' : i <= idx ? 'bg-lime text-ink' : 'bg-slate-100 text-slate-400'}`}>{i < idx || c.kyb === 'approved' ? '✓' : i + 1}</span>
              <span className={i <= idx ? 'text-ink' : 'text-slate-400'}>{label[s]}</span>
              {i < 3 && <span className="h-px flex-1 bg-slate-200" />}
            </li>
          ))}
        </ol>
        <Banner tone={c.kyb === 'approved' ? 'success' : c.kyb === 'rejected' ? 'error' : c.kyb === 'retry' ? 'warn' : 'info'} title={label[c.kyb]}>{c.kybNote}</Banner>
        <div className="mt-3 flex flex-wrap gap-2">
          {c.kyb === 'init' && <Btn perm="team" onClick={() => void submitKyb()}>Submit documents</Btn>}
          {c.kyb === 'retry' && <Btn perm="team" variant="lime" onClick={retryKyb}>Upload a clearer document</Btn>}
          {c.kyb === 'in_review' && <><Btn perm="approve" variant="lime" onClick={() => resolveKybReview(true)}>Reviewer: approve</Btn><Btn perm="approve" variant="light" onClick={() => resolveKybReview(false)}>Reviewer: ask for a retry</Btn></>}
        </div>
        {c.kyb === 'rejected' && <p className="mt-2 text-xs text-slate-500">A rejection is final for this application. Retryable cases (unreadable document) show "Retry needed" instead.</p>}
        {c.kyb === 'in_review' && <p className="mt-2 text-xs text-slate-500">The reviewer buttons stand in for the compliance queue that checks PEP and sanctions list hits.</p>}
      </Panel>
      <Panel title="Owners and representatives" hint="The company cannot move money until every owner and active admin is approved.">
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-slate-100">
            {c.ubos.map((u) => <tr key={u.name}><td className="py-2.5 font-semibold">{u.name}</td><td><Badge tone="gray">Owner {u.share}%</Badge></td><td><KycBadge k={u.kyc} /></td></tr>)}
            {c.team.filter((m) => m.role === 'admin').map((m) => <tr key={m.id}><td className="py-2.5 font-semibold">{m.name}</td><td><Badge tone="blue">Admin</Badge></td><td><KycBadge k={m.kyc} /></td></tr>)}
          </tbody>
        </table>
        <div className="mt-3 text-sm">{block ? <span className="text-amber-700">Blocked: {block}</span> : <span className="text-emerald-700">Everything is approved. The company can operate.</span>}</div>
      </Panel>
    </div>
  )
}
