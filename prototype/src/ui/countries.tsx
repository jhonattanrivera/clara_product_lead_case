// Country lists for selectors and tables, in one place: what is enabled, what is not, and why.
import { CURRENCIES, NOT_ENABLED, type CurrencyCode } from '../config'
import { Flag } from './Flag'
import type { SelectOption } from './Select'

const NAMES_ES: Record<string, string> = { PE: 'Perú', CL: 'Chile', AR: 'Argentina' }
const ENABLED = Object.values(CURRENCIES)

export const countryName = (code: string, lang: 'en' | 'es' = 'en') => {
  const off = NOT_ENABLED.find((c) => c.code === code)
  if (off) return lang === 'es' ? off.nameEs : off.name
  const on = ENABLED.find((c) => c.code === code)
  return on ? (lang === 'es' ? NAMES_ES[code] ?? on.country : on.country) : code
}

const notEnabled = (codes: string[], lang: 'en' | 'es'): SelectOption[] =>
  NOT_ENABLED.filter((c) => codes.includes(c.code)).map((c) => ({
    value: c.code, label: lang === 'es' ? c.nameEs : c.name, icon: <Flag code={c.code} />, disabled: true,
    reason: lang === 'es' ? `No habilitado: ${c.reasonEs}` : `Not enabled: ${c.reason}`,
  }))

/** Where a person can receive: every corridor, then the ones that are not enabled. */
export const payeeCountries = (lang: 'en' | 'es' = 'en'): SelectOption[] => [
  ...ENABLED.map((c) => ({ value: c.code, label: countryName(c.code, lang), icon: <Flag code={c.code} /> })),
  ...notEnabled(NOT_ENABLED.map((c) => c.code), lang),
]

/** Where a company can be based. Colombia is enabled for companies, not for people receiving dollars. */
export const companyCountries = (): SelectOption[] => [
  { value: 'CO', label: 'Colombia', icon: <Flag code="CO" /> },
  ...ENABLED.map((c) => ({ value: c.code, label: c.country, icon: <Flag code={c.code} /> })),
  ...notEnabled(NOT_ENABLED.filter((c) => c.code !== 'CO').map((c) => c.code), 'en'),
]

/** Local currencies a company can send from. */
export const fundingCurrencies = (): SelectOption<CurrencyCode>[] => {
  const on = (Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => ({ value: c, label: `${CURRENCIES[c].country} (${c})`, icon: <Flag code={CURRENCIES[c].code} /> }))
  const off = NOT_ENABLED.map((c) => ({ value: c.currency as CurrencyCode, label: `${c.name} (${c.currency})`, icon: <Flag code={c.code} />, disabled: true, reason: `Not enabled: ${c.reason}` }))
  return [...on, ...off]
}

export const CountryCell = ({ code, lang = 'en', currency }: { code: string; lang?: 'en' | 'es'; currency?: string }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Flag code={code} /><span>{countryName(code, lang)}</span>{currency && <span className="text-slate-400">{currency}</span>}</span>
)
