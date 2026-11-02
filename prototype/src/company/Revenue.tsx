import { useBus } from '../bus'
import { acct, ledger } from '../core/ledger'
import { state } from '../core/state'
import { usd } from '../format'
import { Panel, Stat } from './kit'

export function Revenue() {
  useBus()
  const mine = ledger.balance(acct.companyMarkup)
  const lines = [
    ['Payout fees', ledger.balance(acct.revenue.payoutFee), 'Charged to the company per payment'],
    ['FX spread, platform share', ledger.balance(acct.revenue.fxSpread), 'The floor the platform always keeps'],
    ['Withdrawal fees', ledger.balance(acct.revenue.withdrawalFee), 'After the free withdrawal'],
    ['Interchange (assumed)', ledger.balance(acct.revenue.interchange), 'Share of what merchants pay on card spend'],
  ] as const
  const platform = lines.reduce((s, l) => s + l[1], 0)
  const max = Math.max(1, platform, mine)
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Your FX earnings" value={usd(mine)} sub={`At a ${(state.company.spreadPct * 100).toFixed(2)}% spread`} tone="lime" />
        <Stat label="Platform revenue" value={usd(platform)} sub="Fees, FX floor, interchange" />
        <Stat label="Total spread captured" value={usd(mine + ledger.balance(acct.revenue.fxSpread))} sub="Your share plus the platform share" />
      </div>
      <Panel title="Where the money comes from" hint="Fees and FX earnings by source. Activity builds up as payments move.">
        <div className="space-y-3">
          {[['Your FX markup', mine, 'Paid to you', true] as const, ...lines.map((l) => [l[0], l[1], l[2], false] as const)].map(([k, v, hint, mineRow]) => (
            <div key={k}>
              <div className="flex justify-between text-sm"><span className="font-semibold">{k} <span className="font-normal text-slate-400">{hint}</span></span><span className="font-bold">{usd(v)}</span></div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all duration-700 ${mineRow ? 'bg-lime' : 'bg-ink'}`} style={{ width: `${(v / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
