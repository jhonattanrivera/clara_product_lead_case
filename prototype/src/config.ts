// ─────────────────────────────────────────────────────────────────────────────
// Everything you are likely to tweak live lives here: names, corridors, timing, fees, FX.
// ALL NUMBERS ARE ILLUSTRATIVE ASSUMPTIONS, not market data and not real pricing.
// ─────────────────────────────────────────────────────────────────────────────

export const APP_NAME = 'Clara Dollar' // working name for the prototype
export const APP_SCHEME = 'claradollar'

export const COMPANY = {
  name: 'Acme Corp',
  domain: 'acme.co', // corporate email domain: employees must be added with an address on it
  hq: 'Colombia', // the paying customer sits where the platform already operates
  startingFundingUsd: 2500, // company funding balance when the demo starts
}

// Demo corridors: countries where the platform has NO local operation (the core pain in the case).
export type CurrencyCode = 'PEN' | 'CLP' | 'ARS'

export const TIMING = {
  pendingSeconds: 6, // how long a deposit stays "pending" before it becomes "available"
  clearingSeconds: 6, // how long a card authorization waits for the clearing file
  quoteTtlSeconds: 30, // FX quote validity
  shortQuoteTtlSeconds: 5, // used when the "quote expires fast" demo toggle is on
  latencyMs: 900, // fake network latency of every mocked partner call
}

export const FEES = {
  payrollPayoutPct: 0.0075, // company pays per payout (assumption: 0.5%–1%)
  payrollPayoutMinUsd: 1,
  onRampPct: 0.001, // partner cost on company funding: fiat -> USDC, passed through to the company
  withdrawalFeeUsd: 1.5, // flat fee per withdrawal, after the free one per payment received (assumption)
  interchangeNetPct: 0.01, // what the program keeps on card spend. Placeholder until the issuer confirms it
}

export const FX = {
  spreadPct: 0.01, // default FX spread on USD -> local. The company can change it (floor and cap below)
  platformFloorPct: 0.005, // part of the spread that always stays with the platform (cost + margin)
  maxPct: 0.03, // the company cannot set a spread above this
  jitterPct: 0.003, // each new quote moves the mid rate by up to ±0.3%
  mid: { PEN: 3.5, CLP: 930, ARS: 1400 } as Record<CurrencyCode, number>, // illustrative, not market rates
}

export const CURRENCIES: Record<CurrencyCode, {
  country: string
  code: string
  decimals: number
  accountLabel: string
  accountPlaceholder: string
  accountPattern: RegExp
  accountError: string
  banks: string[]
}> = {
  PEN: { country: 'Peru', code: 'PE', decimals: 2, accountLabel: 'CCI (20 dígitos)', accountPlaceholder: '00219300123456789012', accountPattern: /^\d{20}$/, accountError: 'El CCI tiene exactamente 20 dígitos.', banks: ['BCP', 'Interbank', 'BBVA Perú'] },
  CLP: { country: 'Chile', code: 'CL', decimals: 0, accountLabel: 'Número de cuenta', accountPlaceholder: '0012345678', accountPattern: /^\d{6,20}$/, accountError: 'Escribe un número de cuenta válido (solo dígitos).', banks: ['Banco de Chile', 'BancoEstado', 'Santander Chile'] },
  ARS: { country: 'Argentina', code: 'AR', decimals: 2, accountLabel: 'CBU o CVU (22 dígitos)', accountPlaceholder: '0720000000000000000000', accountPattern: /^\d{22}$/, accountError: 'El CBU o CVU tiene exactamente 22 dígitos.', banks: ['Banco Galicia', 'Banco Nación', 'BBVA Argentina'] },
}

// Which payments may be delivered in digital dollars, per country and type. It drives the company batch.
// DEMO ASSUMPTION, NOT LEGAL ADVICE: every cell has to be validated with counsel in each country.
// Salary is blocked everywhere until counsel clears it. Chile: Labor Code art. 54 (legal tender).
// Argentina: LCT art. 124 (only a bank or official savings account). Peru: no norm verified, so it stays blocked.
export type PayType = 'Contractor payment' | 'Reimbursement' | 'Benefit' | 'Bonus' | 'Salary'
export type PayRule = 'allowed' | 'opt_in' | 'blocked'
export const PAY_TYPES: PayType[] = ['Contractor payment', 'Reimbursement', 'Benefit', 'Bonus', 'Salary']
// Identity documents accepted per country. The number is checked for format before anything is submitted.
export const DOC_TYPES: Record<string, { type: 'DNI' | 'CE' | 'RUT' | 'CUIL'; label: string; pattern: RegExp; hint: string }[]> = {
  PE: [{ type: 'DNI', label: 'DNI', pattern: /^\d{8}$/, hint: '8 digits' }, { type: 'CE', label: 'Carné de extranjería', pattern: /^\d{9}$/, hint: '9 digits' }],
  CL: [{ type: 'RUT', label: 'RUT', pattern: /^\d{7,8}-[\dkK]$/, hint: '12345678-9' }],
  AR: [{ type: 'DNI', label: 'DNI', pattern: /^\d{7,8}$/, hint: '7 or 8 digits' }, { type: 'CUIL', label: 'CUIL', pattern: /^\d{11}$/, hint: '11 digits' }],
}
export const PAY_RULES: Record<string, Record<PayType, PayRule>> = {
  PE: { 'Contractor payment': 'allowed', Reimbursement: 'allowed', Benefit: 'opt_in', Bonus: 'opt_in', Salary: 'blocked' },
  CL: { 'Contractor payment': 'allowed', Reimbursement: 'allowed', Benefit: 'opt_in', Bonus: 'opt_in', Salary: 'blocked' },
  AR: { 'Contractor payment': 'allowed', Reimbursement: 'allowed', Benefit: 'opt_in', Bonus: 'opt_in', Salary: 'blocked' },
}
// Countries that are not enabled, with the reason shown in selectors and tables.
// Source: gtm-pricing.md. ASSUMPTION, NOT LEGAL ADVICE: counsel has to validate each one. Colombia stays enabled as a company base.
export const NOT_ENABLED: { code: string; name: string; nameEs: string; currency: string; reason: string; reasonEs: string }[] = [
  { code: 'BR', name: 'Brazil', nameEs: 'Brasil', currency: 'BRL', reason: 'BCB Resolution 561 limits this kind of settlement abroad', reasonEs: 'la Resolución BCB 561 limita este tipo de liquidación con el exterior' },
  { code: 'MX', name: 'Mexico', nameEs: 'México', currency: 'MXN', reason: 'Banxico Circular 4/2019 limits offering virtual assets to customers', reasonEs: 'la Circular 4/2019 de Banxico limita ofrecer activos virtuales a clientes' },
  { code: 'CO', name: 'Colombia', nameEs: 'Colombia', currency: 'COP', reason: 'no specific rule yet and a bill is pending. Needs counsel review', reasonEs: 'aún no hay una regla específica y hay un proyecto de ley. Falta revisión legal' },
]

export const payRule = (country: string, type: PayType): PayRule => PAY_RULES[country]?.[type] ?? 'blocked'

// Merchants for the "try a card payment" box. A local merchant charges in the employee's currency,
// so the USD card converts it at a visible rate. clearRatio < 1 simulates a pre-auth that clears lower;
// clearRatio > 1 simulates a final amount above the authorization (a tip added at clearing).
export const MERCHANTS: { id: string; name: string; mcc: number; pricing: 'local' | 'usd'; defaultUsd: number; clearRatio: number; country?: string; channel: 'in_person' | 'online'; hidden?: boolean }[] = [
  { id: 'coffee', name: 'Corner Coffee', mcc: 5814, pricing: 'local', defaultUsd: 6.5, clearRatio: 1, channel: 'in_person' },
  { id: 'store', name: 'Online Store (USD)', mcc: 5311, pricing: 'usd', defaultUsd: 49, clearRatio: 1, country: 'US', channel: 'online' },
  { id: 'fuel', name: 'Fuel Station (pre-auth)', mcc: 5541, pricing: 'local', defaultUsd: 50, clearRatio: 0.68, channel: 'in_person' },
  { id: 'restaurant', name: 'Restaurant (tip added)', mcc: 5812, pricing: 'local', defaultUsd: 40, clearRatio: 1.18, channel: 'in_person' },
  { id: 'casino', name: 'Lucky Casino', mcc: 7995, pricing: 'usd', defaultUsd: 20, clearRatio: 1, country: 'US', channel: 'online' },
  { id: 'abroad', name: 'Overseas Marketplace (blocked country)', mcc: 5311, pricing: 'usd', defaultUsd: 30, clearRatio: 1, country: 'KP', channel: 'online' },
  { id: 'hotel', name: 'City Hotel (pre-auth)', mcc: 7011, pricing: 'usd', defaultUsd: 120, clearRatio: 1, country: 'US', channel: 'in_person' },
  { id: 'shop_local', name: 'Online Store', mcc: 5311, pricing: 'local', defaultUsd: 30, clearRatio: 1, channel: 'online', hidden: true },
  { id: 'saas', name: 'Cloud Software (USD)', mcc: 5734, pricing: 'usd', defaultUsd: 29, clearRatio: 1, country: 'US', channel: 'online' },
]
export const BLOCKED_COUNTRIES = ['KP', 'IR', 'RU'] // card default: countries the program does not serve
export const CARD_DEFAULTS = { perTxnUsd: 500, dailyUsd: 1000 }
export const HOLD_DAYS = 7 // an authorization that never clears releases its hold after this many days (assumption)
// If the platform does not answer the issuer in time, the issuer decides alone with this policy.
export const STANDIN = { maxUsd: 25 }
// On-chain proof amounts are symbolic: real USDC sent = demo dollars x scale, capped per transfer.
export const CHAIN = { scale: 0.0002, maxUsdcPerTx: 1, minUsdcPerTx: 0.01 }

export type Role = 'admin' | 'finance' | 'approver' | 'employee' | 'independent' | 'partner'
export const DEMO_USERS: { email: string; password: string; role: Role; name: string; segment: string; blurb: string }[] = [
  { email: 'admin@acme.co', password: 'clara1234', role: 'admin', name: 'Valentina Ortiz', segment: 'Company', blurb: 'Admin: funds, pays, sets the FX spread, approves, sees revenue' },
  { email: 'finance@acme.co', password: 'clara1234', role: 'finance', name: 'Andrés Mejía', segment: 'Company', blurb: 'Finance: funds and pays, cannot change pricing or approve holds' },
  { email: 'approver@acme.co', password: 'clara1234', role: 'approver', name: 'Paula Reyes', segment: 'Company', blurb: 'Approver: only approves or rejects items under review' },
  { email: 'camila@acme.co', password: 'clara1234', role: 'employee', name: 'Camila Torres', segment: 'Employee', blurb: 'Invited by the company: accepts, verifies, gets paid' },
  { email: 'mateo@mail.com', password: 'clara1234', role: 'independent', name: 'Mateo Vargas', segment: 'Independent', blurb: 'Signs up alone, no employer: tops up in local currency, gets paid from the US' },
  { email: 'dev@payrollco.com', password: 'clara1234', role: 'partner', name: 'PayrollCo (API)', segment: 'Partner', blurb: 'Payroll provider using the API: keys, sandbox, webhooks' },
]
export const DEMO_DATE = new Date(2026, 10, 2) // the demo clock starts on Mon 2 Nov 2026
export const BLOCKED_MCCS = [7995] // gambling

// The payment batch. Camila is the person using the app. To demo another corridor, change her country and currency.
export const LIVE_EMPLOYEE_ID = 'camila'
export const EMPLOYEES: { id: string; email: string; name: string; country: string; currency: CurrencyCode; type: PayType; amountUsd: number }[] = [
  { id: 'camila', email: 'camila@acme.co', name: 'Camila Torres', country: 'PE', currency: 'PEN', type: 'Contractor payment', amountUsd: 1200 },
  { id: 'diego', email: 'diego@acme.co', name: 'Diego Hernández', country: 'CL', currency: 'CLP', type: 'Reimbursement', amountUsd: 850 },
  { id: 'ana', email: 'ana@acme.co', name: 'Ana Sosa', country: 'AR', currency: 'ARS', type: 'Contractor payment', amountUsd: 1500 },
  { id: 'luis', email: 'luis@acme.co', name: 'Luis Pardo', country: 'PE', currency: 'PEN', type: 'Bonus', amountUsd: 600 },
  { id: 'mariana', email: 'mariana@acme.co', name: 'Mariana Ruiz', country: 'CL', currency: 'CLP', type: 'Benefit', amountUsd: 700 },
  { id: 'sofia', email: 'sofia@acme.co', name: 'Sofía Rojas', country: 'AR', currency: 'ARS', type: 'Salary', amountUsd: 900 },
]

// Share of platform revenue (fee, FX spread, interchange) that an API partner keeps. Assumption, with a monthly minimum in the real deal.
export const PARTNER_SHARE = 0.3
