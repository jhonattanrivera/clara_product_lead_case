// Partner/API panel: keys, a sandbox console, webhooks and revenue share. Nothing leaves the browser.
import { useState } from 'react'
import { notify, useBus } from '../bus'
import { acct, ledger } from '../core/ledger'
import { committedFunds } from '../core/services'
import { state } from '../core/state'
import { usd } from '../format'
import { Badge } from '../ui/Primitives'
import { PARTNER_SHARE } from '../config'
import { Btn, Panel } from './kit'
import { dt } from './kit'

interface Key { id: string; kind: 'sandbox' | 'live'; secret: string; created: number; revoked: boolean }
const keys: Key[] = [{ id: 'key_1', kind: 'sandbox', secret: 'sk_test_51JsandboxKeyA9x2', created: Date.now() - 6 * 86400000, revoked: false }]
const rnd = () => Array.from({ length: 24 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')
const mask = (s: string) => s.slice(0, 8) + '••••••••••' + s.slice(-4)

const CALLS = {
  'POST /v1/payments': { body: { idempotency_key: 'pay_001', recipient_email: 'camila@acme.co', amount_usd: 450, type: 'Contractor payment' }, res: (b: Record<string, unknown>) => ({ id: 'pay_9f3a21', status: 'queued_kyc', ...b, fee_usd: Math.max(1, Math.round(Number(b.amount_usd) * 0.0075 * 100) / 100), created_at: new Date().toISOString() }) },
  'GET /v1/balances': { body: {}, res: () => ({ company_usd: ledger.balance(acct.company) / 100, reserved_usd: committedFunds() / 100, currency: 'USD' }) },
  'POST /v1/invitations': { body: { email: 'new.hire@acme.co', country: 'PE', role: 'holder' }, res: (b: Record<string, unknown>) => ({ id: 'inv_77c0', status: 'sent', ...b }) },
} as const

export function Partner() {
  useBus()
  const base = ledger.revenueTotal()
  const [call, setCall] = useState<keyof typeof CALLS>('POST /v1/payments')
  const [body, setBody] = useState(JSON.stringify(CALLS['POST /v1/payments'].body, null, 2))
  const [out, setOut] = useState('')
  const [copied, setCopied] = useState('')
  const run = () => {
    try { setOut(JSON.stringify(CALLS[call].res(body.trim() ? JSON.parse(body) : {}), null, 2)) } catch { setOut('{ "error": { "code": "invalid_json", "message": "The request body is not valid JSON" } }') }
  }
  return (
    <div className="space-y-5">
      <Panel title="API keys" hint="Sandbox keys work against the sandbox environment. A live key needs a verified company (KYB)."
        action={<div className="flex gap-2"><Btn variant="light" onClick={() => { keys.unshift({ id: `key_${keys.length + 1}`, kind: 'sandbox', secret: `sk_test_${rnd()}`, created: Date.now(), revoked: false }); notify() }}>Create sandbox key</Btn><Btn variant="light" disabled={state.company.kyb !== 'approved'} title="Requires approved KYB" onClick={() => { keys.unshift({ id: `key_${keys.length + 1}`, kind: 'live', secret: `sk_live_${rnd()}`, created: Date.now(), revoked: false }); notify() }}>Create live key</Btn></div>}>
        <ul className="divide-y divide-slate-100 text-sm">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="flex items-center gap-3"><Badge tone={k.kind === 'live' ? 'green' : 'gray'}>{k.kind}</Badge><span className={`font-mono text-xs ${k.revoked ? 'text-slate-300 line-through' : ''}`}>{mask(k.secret)}</span><span className="text-xs text-slate-400">{dt(k.created)}</span></div>
              <div className="flex gap-3 text-xs font-bold text-brand-700">
                {!k.revoked && <button onClick={() => { void navigator.clipboard?.writeText(k.secret); setCopied(k.id); setTimeout(() => setCopied(''), 1200) }}>{copied === k.id ? 'Copied ✓' : 'Copy'}</button>}
                {k.revoked ? <span className="text-slate-400">Revoked</span> : <button className="text-rose-600" onClick={() => { k.revoked = true; notify() }}>Revoke</button>}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Sandbox console" hint="Pick a call, edit the body, send it. Responses show the shape of a real call.">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CALLS) as (keyof typeof CALLS)[]).map((c) => (
            <button key={c} onClick={() => { setCall(c); setBody(JSON.stringify(CALLS[c].body, null, 2)); setOut('') }} className={`rounded-full border px-3 py-1.5 font-mono text-xs font-bold ${call === c ? 'border-ink bg-ink text-white' : 'border-slate-200'}`}>{c}</button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} className="h-48 rounded-lg bg-night p-3 font-mono text-xs text-sky-100 outline-none" />
          <pre className="h-48 overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-xs">{out || 'Response appears here'}</pre>
        </div>
        <div className="mt-3"><Btn variant="lime" onClick={run}>Send request</Btn></div>
      </Panel>
      <Panel title="Webhooks" hint="We call your endpoint for payment and card events. Verify the signature and treat the event id as an idempotency key.">
        <pre className="overflow-auto rounded-lg bg-night p-3 font-mono text-xs leading-relaxed text-sky-100">{`// Node, verify a webhook
const sig = req.headers['x-signature']          // t=1730000000,v1=<hmac>
const [t, v1] = sig.split(',').map(p => p.split('=')[1])
const expected = hmac('sha256', SECRET, t + '.' + rawBody)
if (!timingSafeEqual(v1, expected)) return res.sendStatus(400)
if (await seen(event.id)) return res.sendStatus(200)  // duplicate, ignore
await handle(event); res.sendStatus(200)`}</pre>
        <ul className="mt-3 divide-y divide-slate-100 text-xs">
          {state.events.slice(0, 5).map((e) => <li key={e.id} className="flex gap-3 py-2"><span className="w-28 shrink-0 text-slate-400">{dt(e.ts)}</span><span className="font-mono font-bold">{e.type}</span><span className="text-slate-500">{e.result}</span></li>)}
          {state.events.length === 0 && <li className="py-2 text-slate-400">Events show up here as they happen.</li>}
        </ul>
      </Panel>
      <Panel title="Revenue share" hint={`Example: PayrollCo keeps ${PARTNER_SHARE * 100}% of the platform's fee, FX spread and interchange on its users.`}>
        <div className="text-3xl font-bold">{usd(Math.round(base * PARTNER_SHARE))}</div>
        <p className="mt-1 text-xs text-slate-400">{PARTNER_SHARE * 100}% of {usd(base)} in platform revenue so far. The percentage is an assumption, with a monthly minimum in the real deal.</p>
      </Panel>
    </div>
  )
}
