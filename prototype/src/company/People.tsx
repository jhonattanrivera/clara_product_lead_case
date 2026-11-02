import { useState } from 'react'
import { useBus } from '../bus'
import { COMPANY, CURRENCIES, DOC_TYPES, LIVE_EMPLOYEE_ID } from '../config'
import { acceptTeamInvite, approveTeamKyc, inviteTeamMember, nudgeEmployee, setTeamRole, toggleFreeze } from '../core/services'
import { CSV_HEADER, CSV_TEMPLATE, decideOnboarding, emptyRow, parseOnboardCsv, submitForApproval, validateRows, type Checked, type OnboardRow } from '../core/onboarding'
import { usd } from '../format'
import { can } from '../core/auth'
import { allPeople, employeeStatus, state, type TeamRole } from '../core/state'
import { Badge, Banner, Field, fieldBase, inputClass } from '../ui/Primitives'
import { Select } from '../ui/Select'
import { CountryCell, countryName, payeeCountries } from '../ui/countries'
import { Flag } from '../ui/Flag'
import { Btn, KycBadge, Panel, Th, dt } from './kit'

const ROLES: TeamRole[] = ['admin', 'finance', 'approver', 'holder']
const ROLE_HINT: Record<TeamRole, string> = { admin: 'Everything, including pricing and roles', finance: 'Funds and pays', approver: 'Approves held items only', holder: 'Has a card, no company access' }
const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1), hint: ROLE_HINT[r] }))
const emptyOne = (country: string, prev: OnboardRow): OnboardRow => ({ ...prev, country, docType: DOC_TYPES[country][0].type, docNumber: '' })
function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url; a.download = 'employees-template.csv'; a.click()
  URL.revokeObjectURL(url)
}

export function People() {
  useBus()
  const [csv, setCsv] = useState('')
  const [res, setRes] = useState<{ added: number; errors: Checked[] } | null>(null)
  const [mode, setMode] = useState<'one' | 'csv'>('one')
  const [preview, setPreview] = useState<Checked[] | null>(null)
  const [one, setOne] = useState<OnboardRow>(emptyRow())
  const pending = state.invitees.filter((i) => i.approval === 'pending_approval')
  const [tm, setTm] = useState({ email: '', role: 'finance' as TeamRole })
  const rows = allPeople().map((p) => ({ ...p, ...employeeStatus(p.id) }))
  return (
    <div className="space-y-5">
      <Panel title="Company team" hint="Invited by email. Roles decide what each person can do, and card limits are inherited from the company.">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr><Th>Person</Th><Th>Role</Th><Th>Identity</Th><Th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {state.company.team.map((m) => (
              <tr key={m.id}>
                <td className="py-2.5"><div className="font-semibold">{m.name}</div><div className="text-xs text-slate-400">{m.email}</div></td>
                <td className="pr-3">
                  <div className="w-36"><Select size="sm" ariaLabel={`Role of ${m.name}`} disabled={!can('team')} value={m.role} onChange={(r) => setTeamRole(m.id, r)} title={ROLE_HINT[m.role]} options={ROLE_OPTIONS} /></div>
                </td>
                <td>{m.status === 'invited' ? <Badge tone="gray">Invited</Badge> : <KycBadge k={m.kyc} />}</td>
                <td className="space-x-2 text-right text-xs font-bold text-brand-700">
                  
                  {m.kyc === 'in_review' && can('approve') && <button onClick={() => approveTeamKyc(m.id)}>Approve identity</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1"><Field label="Invite a teammate by email"><input className={inputClass} placeholder="name@company.com" value={tm.email} onChange={(e) => setTm({ ...tm, email: e.target.value })} /></Field></div>
          <div className="w-40"><Field label="Role"><Select value={tm.role} onChange={(r) => setTm({ ...tm, role: r })} options={ROLE_OPTIONS} /></Field></div>
          <Btn perm="team" tall onClick={() => { inviteTeamMember(tm.email, tm.role); setTm({ ...tm, email: '' }) }}>Invite</Btn>
        </div>
        <p className="mt-2 text-xs text-slate-400">{ROLE_HINT[tm.role]}</p>
      </Panel>

      <Panel title="Add employees" hint="Every person is checked, then waits for a second person to approve. Nobody is invited and no card is issued before approval and identity verification.">
        <div className="mb-4 inline-flex rounded-lg border border-[#d0d5dd] p-0.5 text-sm font-bold">
          {([['one', 'Individual form'], ['csv', 'Bulk CSV upload']] as const).map(([k, l]) => <button key={k} onClick={() => { setMode(k); setRes(null) }} className={`rounded-md px-3.5 py-1.5 ${mode === k ? 'bg-ink text-white' : 'text-slate-600'}`}>{l}</button>)}
        </div>
        {mode === 'one' ? (
          <div className="space-y-3">
            <div className="grid items-end gap-3 sm:grid-cols-2">
              <Field label="Full legal name"><input className={inputClass} value={one.legalName} onChange={(e) => setOne({ ...one, legalName: e.target.value })} placeholder="As it appears on the ID" /></Field>
              <Field label={`Corporate email (@${COMPANY.domain})`}><input className={inputClass} value={one.email} onChange={(e) => setOne({ ...one, email: e.target.value })} placeholder={`name@${COMPANY.domain}`} /></Field>
              <Field label="Country"><Select value={one.country} onChange={(v) => setOne(emptyOne(v, one))} options={payeeCountries()} /></Field>
              <div className="grid grid-cols-[7.5rem_1fr] items-end gap-2">
                <Field label="Document type"><Select value={one.docType} onChange={(v) => setOne({ ...one, docType: v })} options={DOC_TYPES[one.country].map((d) => ({ value: d.type as string, label: d.label }))} /></Field>
                <Field label="Document number"><input className={inputClass} value={one.docNumber} onChange={(e) => setOne({ ...one, docNumber: e.target.value })} placeholder={DOC_TYPES[one.country].find((d) => d.type === one.docType)?.hint} /></Field>
              </div>
              <Field label="Job title"><input className={inputClass} value={one.jobTitle} onChange={(e) => setOne({ ...one, jobTitle: e.target.value })} /></Field>
              <div className="grid grid-cols-2 items-end gap-2">
                <Field label="Cost center"><input className={inputClass} value={one.costCenter} onChange={(e) => setOne({ ...one, costCenter: e.target.value })} placeholder="CC-100" /></Field>
                <Field label="Card limit (USD)"><input className={inputClass} inputMode="numeric" value={one.limitUsd} onChange={(e) => setOne({ ...one, limitUsd: e.target.value })} /></Field>
              </div>
            </div>
            <Btn perm="invite" variant="lime" onClick={() => { const r = submitForApproval([one], 'form'); setRes(r); if (r.added) setOne(emptyRow(one.country)) }}>Send for approval</Btn>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={downloadTemplate} className="rounded-lg border border-[#d0d5dd] px-3.5 py-2 text-sm font-bold hover:bg-slate-50">Download CSV template</button>
              <label className="cursor-pointer rounded-lg border border-[#d0d5dd] px-3.5 py-2 text-sm font-bold hover:bg-slate-50">Upload CSV<input data-testid="csv-file" type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setCsv(await f.text()); setPreview(null); setRes(null) } }} /></label>
            </div>
            <textarea className={`${fieldBase} h-24 px-3.5 py-3 font-mono text-xs`} value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null) }} placeholder={CSV_HEADER} />
            <Btn perm="invite" onClick={() => setPreview(validateRows(parseOnboardCsv(csv)))} disabled={!csv.trim()}>Check file</Btn>
            {preview && (
              <div className="space-y-2">
                <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-left text-xs">
                  <thead className="bg-slate-50"><tr><Th>Row</Th><Th>Name</Th><Th>Document</Th><Th>Country</Th><Th>Email</Th><Th>Result</Th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.map((c) => (
                      <tr key={c.line} className={c.errors.length ? 'bg-red-50/60' : ''}>
                        <td className="px-2 py-1.5">{c.line}</td><td>{c.row.legalName}</td><td>{c.row.docType} {c.row.docNumber}</td><td><CountryCell code={c.row.country.trim().toUpperCase()} /></td><td>{c.row.email}</td>
                        <td className="py-1.5 pr-2">{c.errors.length === 0 ? <Badge tone="green">Valid</Badge> : <ul className="text-red-700">{c.errors.map((e) => <li key={e}>{e}</li>)}</ul>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
                {(() => { const ok = preview.filter((c) => c.errors.length === 0); return (
                  <div className="flex flex-wrap items-center gap-3">
                    <Btn perm="invite" variant="lime" disabled={ok.length === 0} onClick={() => { const r = submitForApproval(ok.map((c) => c.row), 'CSV'); setRes(r); setPreview(null); setCsv('') }}>Confirm and send {ok.length} for approval</Btn>
                    <span className="text-xs text-slate-500">{preview.length - ok.length > 0 ? `${preview.length - ok.length} row(s) with errors will be left out. Fix them and upload again.` : 'All rows are valid.'}</span>
                  </div>
                ) })()}
              </div>
            )}
          </div>
        )}
        {res && (
          <div className="mt-3 space-y-2">
            {res.added > 0 && <Banner tone="success">{res.added} sent for approval. They stay as "Pending approval" until an approver decides.</Banner>}
            {res.errors.length > 0 && <Banner tone="error" title="Not submitted">{res.errors.map((c) => <div key={c.line}>Row {c.line}: {c.errors.join('. ')}</div>)}</Banner>}
          </div>
        )}
      </Panel>

      {pending.length > 0 && (
        <Panel title={`Waiting for approval (${pending.length})`} hint="Maker-checker: a second person decides. The person who submitted cannot approve their own entry.">
          <div className="divide-y divide-slate-100 text-sm">
            {pending.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-56 flex-1">
                  <div className="flex items-center gap-2 font-semibold">{i.name} <Flag code={i.country} /><span className="text-xs font-normal text-slate-500">{countryName(i.country)}</span></div>
                  <div className="text-xs text-slate-500">{i.email} · {i.docType} ••••{i.docNumber?.slice(-3)} · {i.jobTitle} · {i.costCenter} · limit {usd(Math.round((i.limitUsd ?? 0) * 100))}</div>
                  <div className="text-xs text-slate-400">Submitted by {i.submittedBy}, {dt(i.submittedAt ?? 0)}</div>
                </div>
                {can('onboard_approve')
                  ? <div className="flex gap-2"><Btn variant="lime" onClick={() => decideOnboarding(i.id, true)}>Approve</Btn><Btn onClick={() => decideOnboarding(i.id, false)}>Reject</Btn></div>
                  : <Badge tone="amber">Needs an approver</Badge>}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Employees and contractors" hint="After approval the person receives an invitation, verifies identity with our provider in their own app and accepts the terms and data consent. Only then can they get a card or be paid.">
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr><Th>Name</Th><Th>Country</Th><Th>Status</Th><Th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2.5"><div className="font-semibold">{r.name}</div><div className="text-xs text-slate-400">{r.email}</div></td>
                <td className="pr-3"><CountryCell code={r.country} /></td>
                <td className="pr-3 text-xs text-slate-500">{r.note}</td>
                <td className="space-x-3 whitespace-nowrap text-right text-xs font-bold text-brand-700">
                  {['invited', 'kyc_pending', 'failed'].includes(r.status) && <button onClick={() => nudgeEmployee(r.id)}>Remind</button>}
                  {r.id === LIVE_EMPLOYEE_ID && state.card && state.card.status !== 'canceled' && can('team') && (state.card.lockedBy !== 'holder') && <button onClick={() => void toggleFreeze('company')}>{state.card.frozen ? 'Unlock card' : 'Lock card'}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Panel>

      <Panel title="Onboarding audit log" hint="Who did what, and when. Entries cannot be edited.">
        <ul className="divide-y divide-slate-100 text-sm">
          {state.audit.filter((a) => /onboarding|identity verification|Invitation/i.test(a.action)).slice(0, 20).map((a, i) => <li key={i} className="flex gap-3 py-2"><span className="w-28 shrink-0 text-xs text-slate-400">{dt(a.ts)}</span><span className="w-32 shrink-0 text-xs font-semibold">{a.actor}</span><span className="text-slate-600">{a.action}</span></li>)}
        </ul>
      </Panel>
    </div>
  )
}
