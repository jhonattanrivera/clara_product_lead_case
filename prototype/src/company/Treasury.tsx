import { useState } from 'react'
import { useBus } from '../bus'
import { CHAIN } from '../config'
import { anchor, refreshChain } from '../core/chain'
import { current } from '../core/machines'
import { openAddFunds, runReconciliation, setCustodyDown } from '../core/services'
import { usd } from '../format'
import { state } from '../core/state'
import { flags } from '../mocks/demoControls'
import { Badge, Banner } from '../ui/Primitives'
import { Btn, Panel, Th, dt } from './kit'


export function Treasury() {
  useBus()
  const [busy, setBusy] = useState(false)
  const ch = state.chain
  return (
    <div className="space-y-5">
      <Panel title="Custody vault" hint="One vault per company at an institutional custodian. USDC is credited after network confirmations. Withdrawals need approval by policy." action={<Btn perm="fund" variant="light" onClick={() => openAddFunds()}>Add funds</Btn>}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Custodian status: {flags.custodyDown ? <Badge tone="red">Outage</Badge> : <Badge tone="green">Operational</Badge>}</span>
        </div>
        {state.custodyQueue.length > 0 && <div className="mt-3"><Banner tone="warn" title={`${state.custodyQueue.length} deposit(s) queued`}>They are credited as soon as the custodian is back. Nothing is lost.</Banner></div>}
      </Panel>
      <Panel title="Funding" hint="The platform owns the intent. Only the custodian's confirmation credits the ledger. A repeated request is a no-op.">
        {state.fundings.length === 0 ? <p className="text-sm text-slate-400">No funding yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-xs">
            <thead><tr><Th>Intent</Th><Th>Who</Th><Th>Via</Th><Th right>Amount</Th><Th>State</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {state.fundings.slice(0, 8).map((f) => {
                const st = current('funding', f.id)
                return <tr key={f.id}><td className="py-2 pr-3 font-mono">{f.id}</td><td className="pr-3">{f.kind}</td><td className="pr-3">{f.via}</td><td className="pr-3 text-right font-semibold">{usd(f.amount)}</td><td><Badge tone={st === 'confirmed' ? 'green' : st === 'failed' ? 'red' : st === 'queued' ? 'amber' : 'blue'}>{st}</Badge></td></tr>
              })}
            </tbody>
          </table></div>
        )}
      </Panel>
      <Panel title="Daily reconciliation" hint="Compares the ledger with what the custodian and the issuer report. A difference becomes an exception. Nothing is adjusted automatically."
        action={<Btn perm="fund" onClick={runReconciliation}>Run reconciliation</Btn>}>
        {!state.recon ? <p className="text-sm text-slate-400">Not run yet.</p> : (
          <>
            <div className="mb-2"><Badge tone={state.recon.ok ? 'green' : 'red'}>{state.recon.ok ? 'Everything matches' : 'Difference found'}</Badge></div>
            <div className="overflow-x-auto"><table className="w-full text-left text-xs">
              <thead><tr><Th>Check</Th><Th right>Ledger</Th><Th>Compared with</Th><Th right>Reported</Th><Th right>Difference</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {state.recon.rows.map((r) => <tr key={r.label}><td className="py-2 pr-3 font-semibold">{r.label}</td><td className="pr-3 text-right">{usd(r.ledger)}</td><td className="pr-3 text-slate-500">{r.otherLabel}</td><td className="pr-3 text-right">{usd(r.other)}</td><td className={`text-right font-bold ${r.ledger === r.other ? 'text-emerald-700' : 'text-rose-600'}`}>{usd(r.ledger - r.other)}</td></tr>)}
              </tbody>
            </table></div>
          </>
        )}
      </Panel>
      <Panel title="On-chain proof" hint="When anchoring is on, funding and settlement leave a USDC transfer on a public network, linked to its explorer page.">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {!ch.checked ? <Badge tone="gray">Checking…</Badge> : ch.live ? <Badge tone="green">Anchoring on Arc</Badge> : <Badge tone="amber">Anchoring queued</Badge>}
          {ch.live && <span className="font-mono text-xs text-slate-500">{ch.address} | {ch.balance.toFixed(2)} USDC</span>}
          <button className="text-xs font-bold text-brand-700" onClick={() => void refreshChain()}>Recheck</button>
        </div>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs">
          <thead><tr><Th>Time</Th><Th>What</Th><Th>USDC</Th><Th>Status</Th><Th>Proof</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {ch.txs.length === 0 && <tr><td colSpan={5} className="py-3 text-slate-400">No transfers yet. Funding and settlement appear here.</td></tr>}
            {ch.txs.map((t) => (
              <tr key={t.id}><td className="py-2 pr-3 text-slate-400">{dt(t.ts)}</td><td className="pr-3 font-semibold">{t.label}</td><td className="pr-3">{t.usdc}</td><td className="pr-3"><Badge tone={t.mode === 'testnet' ? 'green' : 'gray'}>{t.mode === 'testnet' ? 'Confirmed' : 'Queued'}</Badge></td>
                <td>{t.status === 'sending' ? 'Sending…' : t.url ? <a className="font-bold text-brand-700 underline" href={t.url} target="_blank" rel="noreferrer">{t.hash.slice(0, 10)}…{t.hash.slice(-6)}</a> : <span className="text-slate-400">Not anchored yet</span>}</td></tr>
            ))}
          </tbody>
        </table></div>
      </Panel>
    </div>
  )
}
