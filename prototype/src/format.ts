import { CURRENCIES, type CurrencyCode } from './config'

export const toCents = (usd: number) => Math.round(usd * 100)
export const usd = (cents: number) =>
  (cents < 0 ? '-' : '') + '$' + (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const local = (amount: number, code: CurrencyCode) => {
  const d = CURRENCIES[code].decimals
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })} ${code}`
}
export const timeLabel = (ts: number) => new Date(ts).toLocaleTimeString('es-419', { hour: 'numeric', minute: '2-digit' })

/**
 * Reads amounts the way people type them in LATAM and elsewhere: 6.50, 6,50, 1,200.50, 1.200,50, 1.200.
 * Returns cents, or null when the input is not a positive amount.
 */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/\s/g, '')
  if (!/^\d[\d.,]*$/.test(s)) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let normalized = s
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.'
    const thousands = decimal === ',' ? '.' : ','
    normalized = s.split(thousands).join('').replace(decimal, '.')
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.'
    const isThousands = new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`).test(s)
    if (isThousands) normalized = s.split(sep).join('')
    else if (s.split(sep).length === 2) normalized = s.replace(sep, '.')
    else return null
  }
  const value = Number(normalized)
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null
}
