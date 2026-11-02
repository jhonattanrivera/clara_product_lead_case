// Brand pieces. The assets live in /public/brand. Swap the files to re-skin the whole prototype.
import { APP_NAME } from '../config'

export function Logo({ dark = false, className = 'h-6' }: { dark?: boolean; className?: string }) {
  return <img src={dark ? '/brand/clara-logo-dark.svg' : '/brand/clara-logo-white.svg'} alt="Clara" className={className} />
}
export function ProductTag({ dark = false }: { dark?: boolean }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${dark ? 'bg-ink text-lime' : 'bg-white/10 text-lime'}`}>{APP_NAME.replace('Clara ', '')}</span>
}
