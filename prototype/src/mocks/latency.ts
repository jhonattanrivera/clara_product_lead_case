// Fake network time. "fast" mode (used when skipping ahead in the demo) makes everything instant.
import { TIMING } from '../config'

let fast = false
export const setFast = (v: boolean) => { fast = v }
export const wait = (ms: number = TIMING.latencyMs) => new Promise<void>((r) => setTimeout(r, fast ? 0 : ms))
export const later = (fn: () => void, ms: number) => setTimeout(fn, fast ? 0 : ms)
