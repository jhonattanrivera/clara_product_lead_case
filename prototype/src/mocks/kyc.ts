// MOCK identity provider. The real one keeps the document and selfie; our core receives a case id and a verdict.
import { wait } from './latency'
import { consume } from './demoControls'

export type KycStatus = 'approved' | 'unreadable' | 'manual_review' | 'rejected'
export interface KycResult { status: KycStatus; caseId: string }

const cases = new Map<string, 'review' | 'approved' | 'rejected'>()
let n = 0

export async function submitKyc(_docs: { idPhoto: boolean; selfie: boolean }): Promise<KycResult> {
  await wait(1800)
  const caseId = `kyc_${++n}`
  if (consume('kycUnreadable')) return { status: 'unreadable', caseId }
  if (consume('kycRejected')) return { status: 'rejected', caseId }
  if (consume('kycManualReview')) {
    cases.set(caseId, 'review')
    return { status: 'manual_review', caseId }
  }
  cases.set(caseId, 'approved')
  return { status: 'approved', caseId }
}

export const getCaseStatus = (caseId: string) => cases.get(caseId)
/** What a human reviewer at the provider would do. */
export const approveCase = (caseId: string) => cases.set(caseId, 'approved')
export const rejectCase = (caseId: string) => cases.set(caseId, 'rejected')
