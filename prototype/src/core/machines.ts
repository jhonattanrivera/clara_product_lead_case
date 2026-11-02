// The product's state machines in one place. A status only changes through transition(): a move that
// is not on the map is refused, so a late or repeated provider event can never push something backwards.
import { state, update } from './state'

export type MachineName = 'kyc' | 'cardholder' | 'card' | 'transaction' | 'funding'
export type TransitionSource = 'webhook' | 'api' | 'admin' | 'system'

export const MACHINES: Record<MachineName, { label: string; initial: string; edges: Record<string, string[]> }> = {
  // Provider answers are normalized to these. "retry" means the person can fix it; "rejected" is final.
  kyc: {
    label: 'Identity (KYC)', initial: 'not_started',
    edges: { not_started: ['pending'], pending: ['approved', 'retry', 'in_review', 'rejected'], retry: ['pending'], in_review: ['approved', 'retry', 'rejected'], approved: ['in_review'], rejected: [] },
  },
  // The issuer runs its own checks, so its verdict is stored apart from KYC. Only "approved" can hold a card.
  cardholder: {
    label: 'Cardholder application', initial: 'not_started',
    edges: { not_started: ['pending'], pending: ['approved', 'needs_info', 'in_review', 'denied'], needs_info: ['pending'], in_review: ['approved', 'denied'], approved: ['compliance_block', 'closed'], compliance_block: ['approved', 'closed'], denied: [], closed: [] },
  },
  card: {
    label: 'Card', initial: 'none',
    edges: { none: ['not_activated'], not_activated: ['active', 'canceled'], active: ['locked', 'canceled'], locked: ['active', 'canceled'], canceled: [] },
  },
  // One per authorization. Final states stay final, whatever arrives later.
  transaction: {
    label: 'Card transaction', initial: 'none',
    edges: { none: ['pending', 'declined'], pending: ['completed', 'reversed', 'expired'], completed: [], declined: [], reversed: [], expired: [] },
  },
  // The platform owns the intent. Only the custodian's confirmation credits the ledger.
  funding: {
    label: 'Funding', initial: 'none',
    edges: { none: ['requested'], requested: ['queued', 'detected', 'failed'], queued: ['detected', 'failed'], detected: ['confirmed', 'failed'], confirmed: [], failed: [] },
  },
}

export const current = (m: MachineName, subject: string) => state.fsm[m][subject] ?? MACHINES[m].initial
export const canMove = (m: MachineName, subject: string, to: string) => (MACHINES[m].edges[current(m, subject)] ?? []).includes(to)

/** Moves a machine if the map allows it. Returns false, and changes nothing, if it does not. */
export function transition(m: MachineName, subject: string, to: string, source: TransitionSource, note = ''): boolean {
  if (!canMove(m, subject, to)) return false
  const from = current(m, subject)
  update((s) => {
    s.fsm[m][subject] = to
    s.transitions.unshift({ ts: Date.now(), machine: m, subject, from, to, source, note })
    s.transitions.length = Math.min(s.transitions.length, 120)
  })
  return true
}

/** A person decided to start over (a new application after a final answer). Recorded, never automatic. */
export function reopen(m: MachineName, subject: string, note: string) {
  const from = current(m, subject)
  update((s) => {
    s.fsm[m][subject] = MACHINES[m].initial
    s.transitions.unshift({ ts: Date.now(), machine: m, subject, from, to: MACHINES[m].initial, source: 'admin', note })
  })
}
