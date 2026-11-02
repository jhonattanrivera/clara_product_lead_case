// MOCK local bank payout rail (what the off-ramp partner uses to reach the employee's bank).
import { wait } from './latency'
import { consume } from './demoControls'
import { CURRENCIES, type CurrencyCode } from '../config'

export interface BankDetails { bank: string; account: string; holder: string }

/** Cheap format validation before sending anything to the bank. Returns an error message or null. */
export function validateFormat(currency: CurrencyCode, d: BankDetails): string | null {
  const digits = d.account.replace(/\s/g, '')
  if (!d.holder.trim()) return 'Escribe el nombre del titular.'
  return CURRENCIES[currency].accountPattern.test(digits) ? null : CURRENCIES[currency].accountError
}

export async function payout(_currency: CurrencyCode, _d: BankDetails): Promise<{ ok: true; reference: string } | { ok: false; code: string }> {
  await wait(2200)
  if (consume('wrongBank')) return { ok: false, code: 'ACCOUNT_NOT_FOUND' }
  return { ok: true, reference: `PAY-${Math.floor(100000 + Math.random() * 900000)}` }
}
