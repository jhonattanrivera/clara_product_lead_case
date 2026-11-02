import { useState } from 'react'
import { useBus } from '../bus'
import { FEES, FX } from '../config'
import { can } from '../core/auth'
import { payoutFee } from '../core/pricing'
import { setCompanyLimits, setSpread } from '../core/services'
import { state } from '../core/state'
import { toCents, usd } from '../format'
import { Banner } from '../ui/Primitives'
import { Btn, Panel } from './kit'

export function Pricing() {
  useBus()
  const c = state.company
  const [per, setPer] = useState(c.limits.perPaymentUsd)
  const [day, setDay] = useState(c.limits.dailyUsd)
  const pct = c.spreadPct
  const markup = Math.max(0, pct - FX.platformFloorPct)
  const sample = 10000
  const locked = !can('pricing')
  return (
    <div className="space-y-5">
      {locked && <Banner tone="info">Only admins can change pricing and limits. You can see them here.</Banner>}
      <Panel title="FX spread" hint="Added on top of the market rate when a person converts dollars to local currency. You choose it. The platform always keeps its floor, you keep the rest.">
        <div className="flex items-end justify-between"><div className="text-4xl font-bold tracking-tight">{(pct * 100).toFixed(2)}%</div><div className="text-sm text-slate-500">allowed {FX.platformFloorPct * 100}% to {FX.maxPct * 100}%</div></div>
        <input type="range" disabled={locked} min={FX.platformFloorPct * 10000} max={FX.maxPct * 10000} step={5} value={Math.round(pct * 10000)} onChange={(e) => setSpread(Number(e.target.value) / 10000)} className="mt-3 w-full accent-ink" />
        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Person pays on $100.00</div><div className="mt-1 text-lg font-bold">{usd(Math.round(sample * pct))}</div></div>
          <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Platform keeps</div><div className="mt-1 text-lg font-bold">{usd(Math.round(sample * Math.min(pct, FX.platformFloorPct)))}</div></div>
          <div className="rounded-lg bg-lime p-3"><div className="text-xs text-ink/70">You earn</div><div className="mt-1 text-lg font-bold">{usd(Math.round(sample * markup))}</div></div>
        </div>
        <p className="mt-2 text-xs text-slate-500">A higher spread earns you more and gives your people a worse rate. They see the market rate, the full spread and your share before they confirm. Have counsel check any markup on salary-type payments.</p>
      </Panel>
      <Panel title="Card limits for holders" hint="Every card holder inherits these. They can lower them in their app but never raise them.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Per payment: {usd(per * 100)}<input type="range" disabled={locked} min={50} max={10000} step={50} value={per} onChange={(e) => setPer(Number(e.target.value))} className="mt-1 w-full accent-ink" /></label>
          <label className="text-sm font-bold">Per day: {usd(day * 100)}<input type="range" disabled={locked} min={100} max={50000} step={100} value={day} onChange={(e) => setDay(Number(e.target.value))} className="mt-1 w-full accent-ink" /></label>
        </div>
        <div className="mt-3"><Btn perm="pricing" onClick={() => setCompanyLimits(per, day)}>Save limits</Btn></div>
      </Panel>
      <Panel title="Platform fees (assumptions)" hint="All values are placeholders in src/config.ts.">
        <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
          <dt>Fee per payment sent</dt><dd className="font-bold">{(FEES.payrollPayoutPct * 100).toFixed(2)}% (min {usd(FEES.payrollPayoutMinUsd * 100)})</dd>
          <dt className="text-slate-500">Example: $450.00 payment</dt><dd>{usd(payoutFee(toCents(450)))}</dd>
          <dt>Funding conversion (partner cost, passed through)</dt><dd className="font-bold">{(FEES.onRampPct * 100).toFixed(2)}%</dd>
          <dt>Withdrawal after the free one</dt><dd className="font-bold">{usd(FEES.withdrawalFeeUsd * 100)}</dd>
          <dt>Card interchange kept by the program</dt><dd className="font-bold">{(FEES.interchangeNetPct * 100).toFixed(2)}%</dd>
        </dl>
      </Panel>
    </div>
  )
}
