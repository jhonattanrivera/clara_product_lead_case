import type { ReactNode } from 'react'
import { useBus } from '../bus'
import { state } from '../core/state'

export function PhoneFrame({ children, tabBar }: { children: ReactNode; tabBar?: ReactNode }) {
  useBus()
  const t = state.toast?.audience === 'employee' ? state.toast : null
  const tones = { info: 'bg-ink', success: 'bg-emerald-600', error: 'bg-rose-600' }
  return (
    <div className="relative mx-auto flex h-[min(820px,calc(100vh-7.5rem))] w-[390px] flex-col overflow-hidden rounded-[46px] border-[10px] border-ink bg-white shadow-2xl max-sm:h-screen max-sm:w-full max-sm:rounded-none max-sm:border-0 max-sm:shadow-none">
      <div className="flex items-center justify-between px-7 pb-1 pt-3 text-[13px] font-semibold max-sm:hidden">
        <span>9:41</span>
        <span className="absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-full bg-ink" />
        <span className="text-xs">5G ▮▮▮</span>
      </div>
      {t && (
        <div className={`toast-in absolute inset-x-4 top-12 z-20 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${tones[t.tone]}`}>{t.text}</div>
      )}
      <div className="flex-1 overflow-y-auto">{children}</div>
      {tabBar}
    </div>
  )
}
