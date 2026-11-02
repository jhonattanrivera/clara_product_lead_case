import { useEffect, useRef, useState } from 'react'

/** Animates a number toward its new value, so a balance change is something you can see happen. */
export function useCountUp(value: number, ms = 650) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    if (start === value) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { from.current = value; setShown(value); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      const eased = 1 - (1 - k) ** 3
      setShown(Math.round(start + (value - start) * eased))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = value; setShown(value) }
  }, [value, ms])
  return shown
}
