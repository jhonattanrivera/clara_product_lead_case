// Compliant employee onboarding: maker-checker. One person submits, a different person (approver) decides.
// Nobody is invited before approval. After approval the person completes identity verification and consent in their own app.
import { COMPANY, CURRENCIES, DOC_TYPES, NOT_ENABLED, type CurrencyCode } from '../config'
import { can } from './auth'
import { acceptTeamInvite, deliverQueued } from './services'
import { audit, allPeople, state, toast, update, type DocType, type Invitee } from './state'

export interface OnboardRow { legalName: string; docType: string; docNumber: string; country: string; email: string; jobTitle: string; costCenter: string; limitUsd: string }
export interface Checked { line: number; row: OnboardRow; errors: string[] }

export const CSV_HEADER = 'legal_name,document_type,document_number,country,email,job_title,cost_center,limit_usd'
export const CSV_TEMPLATE = `${CSV_HEADER}\nLucía Paredes,DNI,45678912,PE,lucia@${COMPANY.domain},Designer,CC-100,500\nMartín Soto,RUT,12345678-5,CL,martin@${COMPANY.domain},Analyst,CC-200,400\n`
const EMAIL = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/

export const emptyRow = (country = 'PE'): OnboardRow => ({ legalName: '', docType: DOC_TYPES[country][0].type, docNumber: '', country, email: '', jobTitle: '', costCenter: '', limitUsd: '500' })

/** Row-level checks: required data, corporate domain, document format, supported country, duplicates (also against what is already in the company). */
export function validateRows(rows: OnboardRow[]): Checked[] {
  const seenEmail = new Set(allPeople().map((p) => p.email.toLowerCase()))
  const seenDoc = new Set((allPeople() as Invitee[]).filter((p) => p.docNumber).map((p) => `${p.country}:${p.docNumber}`))
  return rows.map((row, i) => {
    const errors: string[] = []
    const country = row.country.trim().toUpperCase()
    const email = row.email.trim().toLowerCase()
    const doc = row.docNumber.trim()
    if (row.legalName.trim().split(/\s+/).filter(Boolean).length < 2) errors.push('Legal name needs first and last name')
    const off = NOT_ENABLED.find((c) => c.code === country)
    if (off) errors.push(`${off.name} is not enabled: ${off.reason}`)
    else if (!DOC_TYPES[country]) errors.push(`Country "${row.country}" is not supported (use ${Object.keys(DOC_TYPES).join(', ')})`)
    else {
      const rule = DOC_TYPES[country].find((d) => d.type === row.docType.trim().toUpperCase())
      if (!rule) errors.push(`Document type "${row.docType}" is not valid in ${country} (use ${DOC_TYPES[country].map((d) => d.type).join(', ')})`)
      else if (!rule.pattern.test(doc)) errors.push(`${rule.type} number must look like ${rule.hint}`)
    }
    const m = EMAIL.exec(email)
    if (!m) errors.push(`"${row.email}" is not a valid email`)
    else if (m[1] !== COMPANY.domain) errors.push(`Email must be on the company domain @${COMPANY.domain}`)
    if (!row.jobTitle.trim()) errors.push('Job title is missing')
    if (!row.costCenter.trim()) errors.push('Cost center is missing')
    const lim = Number(row.limitUsd)
    if (!(lim > 0) || lim > state.company.limits.perPaymentUsd) errors.push(`Limit must be between 1 and ${state.company.limits.perPaymentUsd} USD (company cap)`)
    if (m) {
      if (seenEmail.has(email)) errors.push(`${email} is already in the company or earlier in this file`)
      else seenEmail.add(email)
    }
    if (DOC_TYPES[country] && doc) {
      const key = `${country}:${doc}`
      if (seenDoc.has(key)) errors.push(`Document ${doc} is already registered or repeated in this file`)
      else seenDoc.add(key)
    }
    return { line: i + 1, row, errors }
  })
}

/** CSV text to rows. Quoted commas are not supported: the template has none. */
export function parseOnboardCsv(text: string): OnboardRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const body = lines.filter((l, i) => !(i === 0 && /legal_name/i.test(l)))
  return body.map((l) => {
    const [legalName = '', docType = '', docNumber = '', country = '', email = '', jobTitle = '', costCenter = '', limitUsd = ''] = l.split(',').map((x) => x.trim())
    return { legalName, docType, docNumber, country, email, jobTitle, costCenter, limitUsd }
  })
}

let seq = 100
/** Maker step. Every valid row becomes "Pending approval". Nothing is sent to the person yet. */
export function submitForApproval(rows: OnboardRow[], via: 'form' | 'CSV'): { added: number; errors: Checked[] } {
  if (!can('invite')) { toast(`Your role (${state.auth?.role}) cannot add people`, 'error', 'company'); return { added: 0, errors: [] } }
  const checked = validateRows(rows)
  const ok = checked.filter((c) => c.errors.length === 0)
  const maker = state.auth?.name ?? 'Unknown'
  update((s) => {
    ok.forEach(({ row }) => {
      const country = row.country.trim().toUpperCase()
      const currency = (Object.keys(CURRENCIES) as CurrencyCode[]).find((c) => CURRENCIES[c].code === country)!
      const id = `inv_${++seq}`
      s.invitees.push({
        id, name: row.legalName.trim(), email: row.email.trim().toLowerCase(), country, currency, type: 'Contractor payment', amountUsd: 0,
        docType: row.docType.trim().toUpperCase() as DocType, docNumber: row.docNumber.trim(), jobTitle: row.jobTitle.trim(), costCenter: row.costCenter.trim(), limitUsd: Number(row.limitUsd),
        approval: 'pending_approval', submittedBy: maker, submittedAt: Date.now(),
      })
      s.others[id] = { status: 'pending_approval', note: `Pending approval. Submitted by ${maker}` }
    })
  })
  ok.forEach(({ row }) => audit(`Submitted the onboarding of ${row.legalName.trim()} (${row.country.toUpperCase()}, ${row.docType.toUpperCase()} ${maskDoc(row.docNumber)}) for approval via ${via}`))
  if (ok.length) toast(`${ok.length} ${ok.length > 1 ? 'people' : 'person'} sent for approval`, 'success', 'company')
  return { added: ok.length, errors: checked.filter((c) => c.errors.length > 0) }
}

const maskDoc = (d: string) => `••••${d.trim().slice(-3)}`

/** Checker step. Only an approver, and never the person who submitted it. */
export function decideOnboarding(id: string, approve: boolean) {
  if (!can('onboard_approve')) return toast(`Your role (${state.auth?.role}) cannot approve onboarding`, 'error', 'company')
  const inv = state.invitees.find((i) => i.id === id)
  if (!inv || inv.approval !== 'pending_approval') return
  const me = state.auth?.name ?? ''
  if (inv.submittedBy === me) return toast('Maker-checker: you cannot approve a person you submitted yourself', 'error', 'company')
  update((s) => {
    const i = s.invitees.find((x) => x.id === id)!
    i.approval = approve ? 'approved' : 'rejected'; i.decidedBy = me; i.decidedAt = Date.now()
    s.others[id] = approve ? { status: 'invited', note: `Invitation sent to ${i.email}. Waiting for the person to verify identity` } : { status: 'rejected', note: `Rejected by ${me}. No invitation was sent` }
  })
  audit(approve ? `Approved the onboarding of ${inv.name}. Invitation sent to ${inv.email}` : `Rejected the onboarding of ${inv.name}. No invitation was sent`)
  toast(approve ? `Approved. Invitation sent to ${inv.email}` : `${inv.name} was rejected`, approve ? 'success' : 'info', 'company')
}

/** The invited person finishes identity verification and accepts terms and data consent in their own app. */
export function inviteeCompletesKyc(id: string) {
  const inv = state.invitees.find((i) => i.id === id)
  if (!inv || inv.approval !== 'approved' || state.others[id]?.status !== 'invited') return
  update((s) => { s.others[id] = { status: 'ready', note: 'Identity verified, terms and data consent accepted' } })
  audit(`Completed identity verification and accepted the terms and data consent`, inv.name)
  deliverQueued(id)
}

/** Everyone who was invited opens the email link and finishes their side. Used by the side panel to move time along. */
export function inviteesFinishOnboarding(): number {
  const ids = state.invitees.filter((i) => i.approval === 'approved' && state.others[i.id]?.status === 'invited').map((i) => i.id)
  ids.forEach(inviteeCompletesKyc)
  state.company.team.filter((m) => m.status === 'invited').forEach((m) => acceptTeamInvite(m.id))
  return ids.length
}
