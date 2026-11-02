import { useBus } from '../bus'
import { COPY } from '../copy'
import { giveConsent } from '../core/services'
import { state, update } from '../core/state'
import { Banner, Button, Check, DigitalNote, Screen } from '../ui/Primitives'

export function Consent() {
  useBus()
  const c = state.consent
  const indie = state.mode === 'indie'
  const all = c.terms && c.kyc && (indie || c.optIn)
  return (
    <Screen title={COPY.consent.title} subtitle={indie ? COPY.consent.introIndie : COPY.consent.intro} footer={<Button disabled={!all} onClick={giveConsent}>{COPY.consent.cta}</Button>}>
      {!indie && <Banner tone="info" title="Ten en cuenta">{COPY.consent.laborNote}</Banner>}
      <div className="space-y-2.5">
        <Check checked={c.terms} onChange={(v) => update((s) => { s.consent.terms = v })}>{COPY.consent.terms}</Check>
        <Check checked={c.kyc} onChange={(v) => update((s) => { s.consent.kyc = v })}>{COPY.consent.kyc}</Check>
        {!indie && <Check checked={c.optIn} onChange={(v) => update((s) => { s.consent.optIn = v })}>{COPY.consent.optIn}</Check>}
      </div>
      <p className="text-xs text-slate-500">{COPY.consent.rateNote}</p>
      <DigitalNote />
    </Screen>
  )
}
