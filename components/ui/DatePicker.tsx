'use client'

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from './Icon'

type PickerMode = 'date' | 'month'
type CalendarView = 'days' | 'months' | 'years'

export interface DatePickerProps {
  /** 'YYYY-MM-DD' en modo fecha, 'YYYY-MM' en modo mes; cadena vacía si no hay valor. */
  value: string
  onChange: (value: string) => void
  mode?: PickerMode
  min?: string
  max?: string
  disabled?: boolean
  required?: boolean
  /** Permite borrar el valor; por defecto solo cuando el campo no es obligatorio. */
  clearable?: boolean
  placeholder?: string
  size?: 'sm' | 'md' | 'lg'
  id?: string
  name?: string
  className?: string
  error?: boolean
  'aria-label'?: string
  'aria-describedby'?: string
}

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const WEEKDAYS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do']
const YEARS_PER_PAGE = 12
const POPOVER_WIDTH = 300
const POPOVER_GAP = 6
const VIEWPORT_MARGIN = 8

interface YMD {
  y: number
  m: number // 0-11
  d: number
}

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = ({ y, m, d }: YMD) => `${y}-${pad(m + 1)}-${pad(d)}`
const toMonthIso = (y: number, m: number) => `${y}-${pad(m + 1)}`
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()

// Se interpreta en hora local sin pasar por Date.parse, que trata 'YYYY-MM-DD' como UTC.
function parseIso(value: string | undefined): YMD | null {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value || '')
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2]) - 1
  const d = match[3] ? Number(match[3]) : 1
  if (m < 0 || m > 11 || d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

function todayYmd(): YMD {
  const now = new Date()
  return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() }
}

function addDays(date: YMD, amount: number): YMD {
  const next = new Date(date.y, date.m, date.d + amount)
  return { y: next.getFullYear(), m: next.getMonth(), d: next.getDate() }
}

function addMonths(date: YMD, amount: number): YMD {
  const target = new Date(date.y, date.m + amount, 1)
  const y = target.getFullYear()
  const m = target.getMonth()
  return { y, m, d: Math.min(date.d, daysInMonth(y, m)) }
}

function formatDisplay(value: string, mode: PickerMode): string {
  const parsed = parseIso(value)
  if (!parsed) return ''
  if (mode === 'month') return `${MONTH_NAMES[parsed.m]} ${parsed.y}`
  return `${pad(parsed.d)} ${MONTH_SHORT[parsed.m]} ${parsed.y}`
}

export function DatePicker({
  value,
  onChange,
  mode = 'date',
  min,
  max,
  disabled = false,
  required = false,
  clearable,
  placeholder,
  size = 'md',
  id,
  name,
  className = '',
  error = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: DatePickerProps) {
  const autoId = useId()
  const triggerId = id || `date-picker-${autoId}`
  const dialogId = `${triggerId}-calendar`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const selected = parseIso(value)
  const minDate = parseIso(min)
  const maxDate = parseIso(max)
  const initialView: CalendarView = mode === 'month' ? 'months' : 'days'

  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<CalendarView>(initialView)
  const [cursor, setCursor] = useState<YMD>(() => selected || todayYmd())
  const [position, setPosition] = useState<{ top: number; left: number; placement: 'bottom' | 'top' } | null>(null)

  useEffect(() => setMounted(true), [])

  const minKey = minDate ? toIso(minDate) : ''
  const maxKey = maxDate ? toIso(maxDate) : ''
  const isDayDisabled = useCallback(
    (date: YMD) => {
      const key = toIso(date)
      return Boolean((minKey && key < minKey) || (maxKey && key > maxKey))
    },
    [minKey, maxKey]
  )
  const isMonthDisabled = useCallback(
    (y: number, m: number) => {
      const key = toMonthIso(y, m)
      return Boolean((minKey && key < minKey.slice(0, 7)) || (maxKey && key > maxKey.slice(0, 7)))
    },
    [minKey, maxKey]
  )

  const open = () => {
    if (disabled) return
    setCursor(selected || clampToRange(todayYmd()))
    setView(initialView)
    setIsOpen(true)
  }

  const close = useCallback((restoreFocus = true) => {
    setIsOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  function clampToRange(date: YMD): YMD {
    if (minDate && toIso(date) < toIso(minDate)) return minDate
    if (maxDate && toIso(date) > toIso(maxDate)) return maxDate
    return date
  }

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const popoverHeight = popoverRef.current?.offsetHeight || 360
    const spaceBelow = window.innerHeight - rect.bottom
    const placement = spaceBelow < popoverHeight + POPOVER_GAP && rect.top > spaceBelow ? 'top' : 'bottom'
    const top = placement === 'bottom' ? rect.bottom + POPOVER_GAP : rect.top - popoverHeight - POPOVER_GAP
    const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN
    const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft))
    setPosition({ top: Math.max(VIEWPORT_MARGIN, top), left, placement })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return
    updatePosition()
  }, [isOpen, view, cursor.y, cursor.m, updatePosition])

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    // Captura para que los drawers/modales no cierren antes que el calendario.
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKey, true)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey, true)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, close, updatePosition])

  // Lleva el foco al día activo para que las flechas funcionen sin tocar el mouse.
  useEffect(() => {
    if (!isOpen) return
    const active = gridRef.current?.querySelector<HTMLButtonElement>('[data-active="true"]')
    active?.focus({ preventScroll: true })
  }, [isOpen, view, cursor])

  const commitDay = (date: YMD) => {
    if (isDayDisabled(date)) return
    onChange(toIso(date))
    close()
  }

  const commitMonth = (y: number, m: number) => {
    if (isMonthDisabled(y, m)) return
    if (mode === 'month') {
      onChange(toMonthIso(y, m))
      close()
      return
    }
    setCursor((prev) => ({ y, m, d: Math.min(prev.d, daysInMonth(y, m)) }))
    setView('days')
  }

  const commitYear = (y: number) => {
    setCursor((prev) => ({ y, m: prev.m, d: Math.min(prev.d, daysInMonth(y, prev.m)) }))
    setView('months')
  }

  const handleGridKeyDown = (event: React.KeyboardEvent) => {
    const step: Record<CalendarView, Partial<Record<string, number>>> = {
      days: { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 },
      months: { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 },
      years: { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 },
    }
    const delta = step[view][event.key]
    if (delta !== undefined) {
      event.preventDefault()
      setCursor((prev) =>
        view === 'days' ? addDays(prev, delta) : view === 'months' ? addMonths(prev, delta) : { ...prev, y: prev.y + delta }
      )
      return
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      const direction = event.key === 'PageUp' ? -1 : 1
      setCursor((prev) => (view === 'days' ? addMonths(prev, direction) : { ...prev, y: prev.y + direction * (view === 'years' ? YEARS_PER_PAGE : 1) }))
    }
  }

  const shiftPage = (direction: -1 | 1) => {
    setCursor((prev) => {
      if (view === 'days') return addMonths(prev, direction)
      if (view === 'months') return { ...prev, y: prev.y + direction }
      return { ...prev, y: prev.y + direction * YEARS_PER_PAGE }
    })
  }

  const dayCells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const offset = (first.getDay() + 6) % 7 // semana inicia el lunes
    const start = addDays({ y: cursor.y, m: cursor.m, d: 1 }, -offset)
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [cursor.y, cursor.m])

  const yearPageStart = cursor.y - (((cursor.y % YEARS_PER_PAGE) + YEARS_PER_PAGE) % YEARS_PER_PAGE)
  const today = todayYmd()
  const todayKey = toIso(today)
  const selectedKey = selected ? toIso(selected) : ''
  const showClear = (clearable ?? !required) && Boolean(value) && !disabled
  const display = formatDisplay(value, mode)
  const fallbackPlaceholder = mode === 'month' ? 'Selecciona un mes' : 'dd/mm/aaaa'

  const title =
    view === 'days'
      ? `${MONTH_NAMES[cursor.m]} ${cursor.y}`
      : view === 'months'
        ? String(cursor.y)
        : `${yearPageStart} – ${yearPageStart + YEARS_PER_PAGE - 1}`
  const canZoomOut = view !== 'years'

  const goToToday = () => {
    if (mode === 'month') return commitMonth(today.y, today.m)
    if (!isDayDisabled(today)) commitDay(today)
  }

  const popover =
    isOpen && mounted
      ? createPortal(
          <div
            ref={popoverRef}
            id={dialogId}
            role="dialog"
            aria-modal="false"
            aria-label={mode === 'month' ? 'Seleccionar mes' : 'Seleccionar fecha'}
            className={`date-picker-popover placement-${position?.placement || 'bottom'}`}
            style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, width: POPOVER_WIDTH }}
          >
            <div className="date-picker-header">
              <button
                type="button"
                className="date-picker-nav"
                onClick={() => shiftPage(-1)}
                aria-label={view === 'days' ? 'Mes anterior' : view === 'months' ? 'Año anterior' : 'Años anteriores'}
              >
                <AppIcon name="chevronLeft" size={16} />
              </button>
              <button
                type="button"
                className="date-picker-title"
                onClick={() => canZoomOut && setView(view === 'days' ? 'months' : 'years')}
                disabled={!canZoomOut}
                aria-live="polite"
              >
                <span>{title}</span>
                {canZoomOut && <AppIcon name="chevronDown" size={14} />}
              </button>
              <button
                type="button"
                className="date-picker-nav"
                onClick={() => shiftPage(1)}
                aria-label={view === 'days' ? 'Mes siguiente' : view === 'months' ? 'Año siguiente' : 'Años siguientes'}
              >
                <AppIcon name="chevronRight" size={16} />
              </button>
            </div>

            <div ref={gridRef} onKeyDown={handleGridKeyDown}>
              {view === 'days' && (
                <div className="date-picker-days" role="grid" aria-label={title}>
                  {WEEKDAYS.map((day) => (
                    <span key={day} className="date-picker-weekday" role="columnheader">
                      {day}
                    </span>
                  ))}
                  {dayCells.map((date) => {
                    const key = toIso(date)
                    const outside = date.m !== cursor.m
                    const isActive = date.y === cursor.y && date.m === cursor.m && date.d === cursor.d
                    const isDisabled = isDayDisabled(date)
                    return (
                      <button
                        key={key}
                        type="button"
                        role="gridcell"
                        tabIndex={isActive ? 0 : -1}
                        data-active={isActive}
                        className={[
                          'date-picker-cell',
                          outside && 'is-outside',
                          key === todayKey && 'is-today',
                          key === selectedKey && 'is-selected',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        disabled={isDisabled}
                        aria-selected={key === selectedKey}
                        aria-label={`${date.d} de ${MONTH_NAMES[date.m]} de ${date.y}`}
                        onClick={() => commitDay(date)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            commitDay(date)
                          }
                        }}
                      >
                        {date.d}
                      </button>
                    )
                  })}
                </div>
              )}

              {view === 'months' && (
                <div className="date-picker-grid-3" role="grid" aria-label={`Meses de ${cursor.y}`}>
                  {MONTH_SHORT.map((label, m) => {
                    const isActive = m === cursor.m
                    const isSelected = selected?.y === cursor.y && selected?.m === m
                    const isCurrent = today.y === cursor.y && today.m === m
                    return (
                      <button
                        key={label}
                        type="button"
                        tabIndex={isActive ? 0 : -1}
                        data-active={isActive}
                        className={['date-picker-cell wide', isCurrent && 'is-today', isSelected && 'is-selected']
                          .filter(Boolean)
                          .join(' ')}
                        disabled={isMonthDisabled(cursor.y, m)}
                        aria-label={`${MONTH_NAMES[m]} de ${cursor.y}`}
                        onClick={() => commitMonth(cursor.y, m)}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}

              {view === 'years' && (
                <div className="date-picker-grid-3" role="grid" aria-label={title}>
                  {Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i).map((y) => {
                    const outOfRange =
                      Boolean(minDate && y < minDate.y) || Boolean(maxDate && y > maxDate.y)
                    return (
                      <button
                        key={y}
                        type="button"
                        tabIndex={y === cursor.y ? 0 : -1}
                        data-active={y === cursor.y}
                        className={['date-picker-cell wide', y === today.y && 'is-today', selected?.y === y && 'is-selected']
                          .filter(Boolean)
                          .join(' ')}
                        disabled={outOfRange}
                        onClick={() => commitYear(y)}
                      >
                        {y}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="date-picker-footer">
              <button type="button" className="date-picker-link" onClick={goToToday}>
                {mode === 'month' ? 'Este mes' : 'Hoy'}
              </button>
              {showClear && (
                <button
                  type="button"
                  className="date-picker-link is-muted"
                  onClick={() => {
                    onChange('')
                    close()
                  }}
                >
                  Borrar
                </button>
              )}
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <div
      className={[
        'date-picker',
        `size-${size}`,
        isOpen && 'is-open',
        disabled && 'is-disabled',
        error && 'has-error',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="date-picker-trigger"
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !isOpen) {
            event.preventDefault()
            open()
          }
        }}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? dialogId : undefined}
        aria-label={ariaLabel ? `${ariaLabel}${display ? `: ${display}` : ''}` : undefined}
        aria-describedby={ariaDescribedBy}
        aria-invalid={error || undefined}
      >
        <AppIcon name="calendar" size={15} className="date-picker-icon" />
        <span className={display ? 'date-picker-value' : 'date-picker-placeholder'}>
          {display || placeholder || fallbackPlaceholder}
        </span>
      </button>
      {showClear && (
        <button
          type="button"
          className="date-picker-clear"
          onClick={() => onChange('')}
          aria-label="Borrar fecha"
        >
          <AppIcon name="closeSimple" size={13} />
        </button>
      )}
      {/* Mantiene la validación nativa de formularios (required) y el envío por name. */}
      <input
        className="date-picker-proxy"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        onChange={() => undefined}
        onFocus={() => triggerRef.current?.focus()}
      />
      {popover}
    </div>
  )
}
