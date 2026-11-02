// Company-side fees. Rates come from config.ts.
import { FEES } from '../config'
import type { Cents } from './ledger'

export const payoutFee = (amount: Cents): Cents =>
  Math.max(Math.round(amount * FEES.payrollPayoutPct), Math.round(FEES.payrollPayoutMinUsd * 100))
