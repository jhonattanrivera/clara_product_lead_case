// Tiny change bus: ledger, state and mocks call notify(); components call useBus() to re-render.
import { useSyncExternalStore } from 'react'

let version = 0
const listeners = new Set<() => void>()

export function notify() {
  version++
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export function useBus() {
  useSyncExternalStore(subscribe, () => version)
}
