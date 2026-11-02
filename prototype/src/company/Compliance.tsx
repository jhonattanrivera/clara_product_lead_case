import { useBus } from '../bus'
import { approveHold, approveTeamKyc, rejectHold, resolveKybReview, resolveSuspense } from '../core/services'
import { employeeStatus, state } from '../core/state'
import { requeue } from '../core/events'
import { usd } from '../format'
import { Badge } from '../ui/Primitives'
import { Btn, Panel, Th, dt } from './kit'
import { allPeople } from '../core/state'

const result = { processed: 'green', 'duplicate ignored': 'amber', 'stale ignored': 'amber', queued: 'blue', exception: 'red', rejected: 'red', postponed: 'blue', retrying: 'amber', dead: 'red', skipped: 'gray', declined: 'gray' } as const

export function Compliance() {
  useBus()
  const held = state.payouts.filter((p) => p.status === 'on_hold')
  const kycQueue = state.company.team.filter((m) => m.kyc === 'in_review')
  const open = state.exceptions
  const nameOf = (id: string) => allPeople().find((p) => p.id === id)?.name ?? id
  const nothing = held.length + kycQueue.length === 0 && state.company.kyb !== 'in_review' && open.every((e) => e.status === 'resolved')
  return (
    <div className="space-y-5">
      <Panel title="Waiting for a decision" hint="Approvers and admins clear these. Finance can see them but not decide.">
        {nothing && <p className="text-sm text-slate-400">The queue is empty. Items appear here when a payment is held or a company review starts.</p>}
        {state.company.kyb === 'in_review' && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sky-50 p-3 text-sm"><span><b>Company KYB</b> is in manual review</span><span className="flex gap-2"><Btn perm="approve" variant="lime" onClick={() => resolveKybReview(true)}>Approve</Btn><Btn perm="approve" variant="light" onClick={() => resolveKybReview(false)}>Ask for retry</Btn></span></div>
        )}
        {held.map((p) => (
          <div key={p.id} className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-3 text-sm">
            <span><b>{usd(p.amount)}</b> to {nameOf(p.employeeId)} is on hold. {employeeStatus(p.employeeId).note}</span>
            <span className="flex gap-2"><Btn perm="approve" variant="lime" onClick={() => approveHold(p.id)}>Approve</Btn><Btn perm="approve" variant="danger" onClick={() => rejectHold(p.id)}>Reject, return funds</Btn></span>
          </div>
        ))}
        {kycQueue.map((m) => (
          <div key={m.id} className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sky-50 p-3 text-sm"><span><b>{m.name}</b> identity check is in review</span><Btn perm="approve" variant="lime" onClick={() => approveTeamKyc(m.id)}>Approve identity</Btn></div>
        ))}
      </Panel>

      <Panel title="Exceptions" hint="Money or events that did not follow the normal path. Nothing is lost, it waits here until someone decides.">
        {open.length === 0 ? <p className="text-sm text-slate-400">No exceptions. Unmatched events and deposits that cannot be credited appear here.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {open.map((e) => (
              <li key={e.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><span className="font-bold">{e.kind.replaceAll('_', ' ')}</span> <span className="text-slate-500">{usd(e.amount)}</span><div className="text-xs text-slate-500">{e.detail}</div></div>
                  {e.status === 'resolved' ? <Badge tone="green">{e.resolution}</Badge> : (
                    <div className="flex flex-wrap gap-2">
                      {e.kind === 'clearing_without_auth' && <Btn perm="approve" variant="light" onClick={() => resolveSuspense(e.id, 'charge')}>Charge the user</Btn>}
                      {e.kind.startsWith('wrong_network') && <Btn perm="approve" variant="light" onClick={() => resolveSuspense(e.id, 'recover')}>Recover, $5 fee</Btn>}
                      {e.kind === 'reconciliation_break'
                        ? <Btn perm="approve" variant="light" onClick={() => resolveSuspense(e.id, 'writeoff')}>Mark as explained</Btn>
                        : <Btn perm="approve" variant="light" onClick={() => resolveSuspense(e.id, 'writeoff')}>{e.kind.startsWith('wrong_network') ? 'Not recoverable' : 'Write off'}</Btn>}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Provider events" hint="Signature checked first, stored under a unique key, answered at once. Repeats are ignored, early events wait and retry, and repeated failures go to dead letters.">
        {state.events.length === 0 ? <p className="text-sm text-slate-400">No events yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-xs">
            <thead><tr><Th>Time</Th><Th>Source</Th><Th>Type</Th><Th>Result</Th><Th>Detail</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {state.events.slice(0, 25).map((e) => (
                <tr key={e.id}><td className="whitespace-nowrap py-2 pr-3 text-slate-400">{dt(e.ts)}</td><td className="pr-3 font-semibold">{e.source}</td><td className="pr-3 font-mono">{e.type}</td><td className="pr-3"><Badge tone={result[e.result]}>{e.result}</Badge></td><td className="text-slate-500">{e.detail}{e.result === 'dead' && <button className="ml-2 font-bold text-brand-700" onClick={() => requeue(e.id)}>Requeue</button>}</td></tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Panel>

      <Panel title="Audit log" hint="Append-only. Who did what and when.">
        <ul className="divide-y divide-slate-100 text-sm">
          {state.audit.length === 0 && <li className="py-2 text-slate-400">Nothing yet.</li>}
          {state.audit.slice(0, 30).map((a, i) => <li key={i} className="flex gap-3 py-2"><span className="w-28 shrink-0 text-xs text-slate-400">{dt(a.ts)}</span><span className="w-32 shrink-0 text-xs font-semibold">{a.actor}</span><span>{a.action}</span></li>)}
        </ul>
      </Panel>
    </div>
  )
}
