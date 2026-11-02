// Provider events the way a real platform takes them: verify the signature, store the event under a
// unique key, answer at once, then process it. Repeats are ignored, an event about something not known
// yet waits and retries, and one that keeps failing goes to a dead-letter list for manual requeue.
import { consume } from '../mocks/demoControls'
import { later } from '../mocks/latency'
import { state, update, type EventItem } from './state'

const MAX_ATTEMPTS = 3
const RETRY_MS = 900
const seen = new Set<string>()
const dead = new Map<string, () => void>()
let n = 0

export function logEvent(source: string, type: string, key: string, result: EventItem['result'], detail: string): string {
  const id = `evt_${++n}`
  update((s) => { s.events.unshift({ id, ts: Date.now(), source, type, key, result, detail }); s.events.length = Math.min(s.events.length, 80) })
  return id
}

interface Inbound { source: string; type: string; key: string; handler: () => void; detail: string; ready?: () => boolean; failing: boolean }

function attempt(ev: Inbound, tries: number) {
  const waiting = !!ev.ready && !ev.ready()
  if (!waiting && !ev.failing) {
    ev.handler()
    logEvent(ev.source, ev.type, ev.key, 'processed', ev.detail)
    return
  }
  const next = tries + 1
  if (next >= MAX_ATTEMPTS) {
    dead.set(logEvent(ev.source, ev.type, ev.key, 'dead', `Failed ${MAX_ATTEMPTS} times. Moved to dead letters. Nothing was posted`), ev.handler)
    return
  }
  logEvent(ev.source, ev.type, ev.key, waiting ? 'postponed' : 'retrying', `${waiting ? 'Refers to something not known yet' : 'Processing failed'}. Retry ${next} of ${MAX_ATTEMPTS - 1}`)
  later(() => attempt(ev, next), RETRY_MS)
}

/** Takes a provider event. handler runs at most once per key, whatever the provider sends. */
export function deliver(source: string, type: string, key: string, handler: () => void, detail = '', opts: { ready?: () => boolean } = {}) {
  if (consume('badSignature')) logEvent(source, type, key, 'rejected', 'Invalid signature: refused with 401 before reading the body. The provider sends it again, signed')
  const copies = consume('duplicateWebhook') ? 2 : 1
  const failing = consume('webhookFails')
  for (let i = 0; i < copies; i++) {
    if (seen.has(key)) {
      logEvent(source, type, key, 'duplicate ignored', 'Same event key already stored. Answered 200, no second posting')
      continue
    }
    seen.add(key)
    attempt({ source, type, key, handler, detail, ready: opts.ready, failing }, 0)
  }
}

/** An operator sends a dead-letter event through again. */
export function requeue(eventId: string) {
  const handler = dead.get(eventId)
  if (!handler) return
  dead.delete(eventId)
  handler()
  update((s) => { const e = s.events.find((x) => x.id === eventId); if (e) { e.result = 'processed'; e.detail = 'Requeued by an operator and processed' } })
}

/** A provider type we do not know. It is stored and skipped, never treated as an error. */
export function sendUnknownEvent() {
  logEvent('issuer', 'report.generated', `unknown_${++n}`, 'skipped', 'Unknown event type. Stored and skipped')
}

export function raiseException(kind: string, amount: number, detail: string) {
  update((s) => { s.exceptions.unshift({ id: `exc_${++n}`, ts: Date.now(), kind, amount, detail, status: 'open' }) })
}
export function resolveException(id: string, resolution: string) {
  update((s) => { const x = s.exceptions.find((e) => e.id === id); if (x) { x.status = 'resolved'; x.resolution = resolution } })
}
