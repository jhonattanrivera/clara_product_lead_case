// Flags as inline SVG: flag emoji do not render on Windows, and these look the same everywhere.
import type { ReactNode } from 'react'

const W = 20
const H = 15
const FLAGS: Record<string, ReactNode> = {
  PE: <><rect width={W} height={H} fill="#fff" /><rect width="6.67" height={H} fill="#D91023" /><rect x="13.33" width="6.67" height={H} fill="#D91023" /></>,
  CL: <><rect width={W} height="7.5" fill="#fff" /><rect y="7.5" width={W} height="7.5" fill="#D52B1E" /><rect width="7.5" height="7.5" fill="#0039A6" /><polygon fill="#fff" points="3.75,1.55 4.28,3.02 5.84,3.07 4.61,4.03 5.04,5.53 3.75,4.65 2.46,5.53 2.89,4.03 1.66,3.07 3.22,3.02" /></>,
  AR: <><rect width={W} height={H} fill="#74ACDF" /><rect y="5" width={W} height="5" fill="#fff" /><circle cx="10" cy="7.5" r="1.6" fill="#F6B40E" /></>,
  CO: <><rect width={W} height="7.5" fill="#FCD116" /><rect y="7.5" width={W} height="3.75" fill="#003893" /><rect y="11.25" width={W} height="3.75" fill="#CE1126" /></>,
  MX: <><rect width={W} height={H} fill="#fff" /><rect width="6.67" height={H} fill="#006847" /><rect x="13.33" width="6.67" height={H} fill="#CE1126" /><circle cx="10" cy="7.5" r="1.5" fill="#8C5A2B" /></>,
  BR: <><rect width={W} height={H} fill="#009C3B" /><polygon fill="#FFDF00" points="10,1.5 18.5,7.5 10,13.5 1.5,7.5" /><circle cx="10" cy="7.5" r="3.2" fill="#002776" /></>,
  US: <><rect width={W} height={H} fill="#fff" />{[0, 2, 4, 6, 8, 10, 12].map((i) => <rect key={i} y={(i * H) / 13} width={W} height={H / 13} fill="#B22234" />)}<rect width="8.5" height="8.08" fill="#3C3B6E" /></>,
}

export function Flag({ code, className = '' }: { code: string; className?: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} data-flag={code} aria-hidden="true" className={`inline-block h-[15px] w-5 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10 ${className}`}>
      {FLAGS[code] ?? <rect width={W} height={H} fill="#e2e8f0" />}
    </svg>
  )
}
