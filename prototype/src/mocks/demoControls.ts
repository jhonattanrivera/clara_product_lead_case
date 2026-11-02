// Failure scenarios the presenter can switch on. Each one fires ONCE and then turns itself off,
// except keepPending and custodyDown, which stay on until released. Mocks call consume(...) to check them.
import { notify } from '../bus'

export type DeclineMode = 'none' | 'insufficient' | 'mcc' | 'cvv3ds' | 'fraud'

export const flags = {
  kycUnreadable: false, // next ID photo is unreadable
  kycManualReview: false, // next KYC submission goes to manual review
  kycRejected: false, // next KYC submission is rejected for good
  cardholderNeedsInfo: false, // KYC passes, but the issuer asks for one more detail
  cardholderDenied: false, // KYC passes, but the issuer's own checks deny the card
  paymentHold: false, // next payment deposit is put on hold for review
  keepPending: false, // deposits stay pending (not spendable) until released
  quoteShortTtl: false, // next FX quote expires in a few seconds
  wrongBank: false, // next withdrawal is rejected by the bank (wrong details)
  kybManualReview: false, // next company KYB goes to manual review
  kybRejected: false, // next company KYB is rejected
  duplicateWebhook: false, // next provider event is delivered twice (idempotency)
  badSignature: false, // next provider event arrives with an invalid signature first
  webhookFails: false, // next provider event keeps failing and ends in dead letters
  wrongNetwork: false, // next deposit arrives on the wrong network
  custodyDown: false, // custodian outage: deposits are queued until it is restored
  custodyDrift: false, // next reconciliation: the custodian statement differs from the ledger
  authTimeout: false, // next card authorization: the platform does not answer in time (stand-in)
  cardDecline: 'none' as DeclineMode, // next card payment is declined
}
export type FlagKey = Exclude<keyof typeof flags, 'cardDecline'>
export type OnceFlag = Exclude<FlagKey, 'keepPending' | 'custodyDown'>

export function setFlag(key: FlagKey, value: boolean) {
  flags[key] = value
  notify()
}
export function setDecline(mode: DeclineMode) {
  flags.cardDecline = mode
  notify()
}
/** Returns true (and switches the flag off) if the flag was on. */
export function consume(key: OnceFlag): boolean {
  if (!flags[key]) return false
  flags[key] = false
  notify()
  return true
}
export function consumeDecline(): DeclineMode {
  const m = flags.cardDecline
  flags.cardDecline = 'none'
  notify()
  return m
}
