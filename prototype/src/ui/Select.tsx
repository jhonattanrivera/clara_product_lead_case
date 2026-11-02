// Dropdown used instead of the native one: same size, border and radius as the inputs,
// and options can carry a flag, a hint, or a disabled state with its reason.
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { inputClass, inputSmClass } from './Primitives'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  icon?: ReactNode
  hint?: string
  disabled?: boolean
  reason?: string // why it is disabled. Always visible in the list
}

interface Props<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
  title?: string
  size?: 'md' | 'sm'
  fieldClass?: string // use the look of the inputs next to it when they are not the standard ones
}

const MIN_POPUP = 208
const MAX_POPUP = 320
const GAP = 4

export function Select<T extends string>({ value, onChange, options, ariaLabel, placeholder, disabled, title, size = 'md', fieldClass, ...rest }: Props<T>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState<CSSProperties>({ position: 'fixed', visibility: 'hidden' })
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const id = useId()
  const current = options.find((o) => o.value === value)
  const field = fieldClass ?? (size === 'sm' ? inputSmClass : inputClass)

  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0)
  const show = () => {
    const i = options.findIndex((o) => o.value === value && !o.disabled)
    setActive(i >= 0 ? i : enabled[0] ?? -1)
    setOpen(true)
  }
  const pick = (o: SelectOption<T>) => {
    if (o.disabled) return
    setOpen(false)
    if (o.value !== value) onChange(o.value)
    button.current?.focus()
  }

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = button.current?.getBoundingClientRect()
      if (!r) return
      const width = Math.min(Math.max(r.width, MIN_POPUP), window.innerWidth - 16)
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
      const below = window.innerHeight - r.bottom - GAP - 8
      const above = r.top - GAP - 8
      const up = below < 200 && above > below
      setPos({ position: 'fixed', left, width, maxHeight: Math.min(MAX_POPUP, up ? above : below), ...(up ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      const t = e.target as Node
      if (!button.current?.contains(t) && !list.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  // Scrolls only the list. scrollIntoView would also move the page behind it.
  useEffect(() => {
    const ul = list.current
    const el = ul?.querySelector('[data-active="true"]')
    if (!open || !ul || !el) return
    const item = el.getBoundingClientRect()
    const box = ul.getBoundingClientRect()
    if (item.top < box.top) ul.scrollTop -= box.top - item.top
    else if (item.bottom > box.bottom) ul.scrollTop += item.bottom - box.bottom
  }, [open, active, pos])

  const move = (step: number) => {
    if (!enabled.length) return
    const at = enabled.indexOf(active)
    setActive(enabled[(at + step + enabled.length) % enabled.length])
  }
  const typeAhead = (key: string) => {
    const now = Date.now()
    typed.current = { text: now - typed.current.at > 600 ? key : typed.current.text + key, at: now }
    const hit = enabled.find((i) => options[i].label.toLowerCase().startsWith(typed.current.text.toLowerCase()))
    if (hit !== undefined) setActive(hit)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show() }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false) }
    else if (e.key === 'Tab') setOpen(false)
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Home' && enabled.length) { e.preventDefault(); setActive(enabled[0]) }
    else if (e.key === 'End' && enabled.length) { e.preventDefault(); setActive(enabled[enabled.length - 1]) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[active]) pick(options[active]) }
    else if (e.key.length === 1) typeAhead(e.key)
  }

  return (
    <>
      <button
        {...rest}
        ref={button}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
        disabled={disabled}
        title={title}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={`${field} flex items-center gap-2 text-left disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${open ? 'border-brand-500 ring-2 ring-brand-100' : ''}`}
      >
        {current?.icon}
        <span className={`min-w-0 flex-1 truncate ${current ? '' : 'text-slate-400'}`}>{current?.label ?? placeholder ?? ''}</span>
        <svg viewBox="0 0 16 16" className={`size-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
      </button>
      {open && createPortal(
        <ul ref={list} id={`${id}-list`} role="listbox" aria-label={ariaLabel} style={pos} onMouseDown={(e) => e.preventDefault()} className={`z-[70] overflow-y-auto rounded-[10px] border border-slate-200 bg-white py-1 text-ink shadow-lg ${size === 'sm' ? 'text-sm' : 'text-[15px]'}`}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              data-active={i === active}
              onMouseEnter={() => { if (!o.disabled) setActive(i) }}
              onClick={() => pick(o)}
              className={`flex items-start gap-2 px-3 py-2 ${o.disabled ? 'cursor-not-allowed text-slate-400' : `cursor-pointer ${i === active ? 'bg-brand-50' : ''}`}`}
            >
              {o.icon && <span className={`mt-0.5 shrink-0 ${o.disabled ? 'opacity-40 grayscale' : ''}`}>{o.icon}</span>}
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{o.label}</span>
                {o.hint && !o.disabled && <span className="block text-xs text-slate-500">{o.hint}</span>}
                {o.reason && o.disabled && <span className="block text-xs text-slate-400">{o.reason}</span>}
              </span>
              {o.value === value && !o.disabled && <Icon name="check" className="mt-0.5 size-4 shrink-0 text-brand-600" />}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  )
}
