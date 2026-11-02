// Decline reasons as stable codes. Logic branches on the code and category, never on a provider's free text.
export type DeclineCategory = 'balance' | 'limit' | 'card' | 'authentication' | 'policy' | 'risk' | 'availability' | 'unknown'

export const DECLINES: Record<string, { category: DeclineCategory; holderCanFix: boolean }> = {
  insufficient_funds: { category: 'balance', holderCanFix: true },
  funds_pending: { category: 'balance', holderCanFix: true },
  funds_on_hold: { category: 'balance', holderCanFix: false },
  limit_per_payment: { category: 'limit', holderCanFix: true },
  limit_daily: { category: 'limit', holderCanFix: true },
  card_frozen: { category: 'card', holderCanFix: true },
  card_canceled: { category: 'card', holderCanFix: true },
  cvv_3ds_failed: { category: 'authentication', holderCanFix: true },
  mcc_blocked: { category: 'policy', holderCanFix: false },
  country_blocked: { category: 'policy', holderCanFix: false },
  international_off: { category: 'policy', holderCanFix: true },
  online_off: { category: 'policy', holderCanFix: true },
  fraud_suspected: { category: 'risk', holderCanFix: false },
  timeout_declined: { category: 'availability', holderCanFix: true },
}
export const classifyDecline = (code?: string) => (code && DECLINES[code]) || { category: 'unknown' as const, holderCanFix: false }
