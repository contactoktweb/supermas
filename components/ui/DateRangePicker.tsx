'use client'

import React, { useState, useEffect, useRef } from 'react'
import { AppIcon } from './Icon'

export interface DateRangeValue {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

interface DateRangePickerProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  isOpen: boolean
  onClose: () => void
  align?: 'left' | 'right'
  className?: string
}

// Helpers for date calculations in local/Bogota context
function formatDateToISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getPresets(): { label: string; range: DateRangeValue }[] {
  const now = new Date()

  // 1. Last 7 days
  const d7 = new Date(now)
  d7.setDate(d7.getDate() - 6)

  // 2. Last 15 days
  const d15 = new Date(now)
  d15.setDate(d15.getDate() - 14)

  // 3. This month
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // 4. Last month
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

  // 5. Last 90 days
  const d90 = new Date(now)
  d90.setDate(d90.getDate() - 89)

  // 6. This year
  const firstOfYear = new Date(now.getFullYear(), 0, 1)

  return [
    {
      label: 'Últimos 7 días',
      range: { startDate: formatDateToISO(d7), endDate: formatDateToISO(now) },
    },
    {
      label: 'Últimos 15 días',
      range: { startDate: formatDateToISO(d15), endDate: formatDateToISO(now) },
    },
    {
      label: 'Este mes',
      range: { startDate: formatDateToISO(firstOfMonth), endDate: formatDateToISO(now) },
    },
    {
      label: 'Mes anterior',
      range: {
        startDate: formatDateToISO(firstOfLastMonth),
        endDate: formatDateToISO(lastOfLastMonth),
      },
    },
    {
      label: 'Últimos 90 días',
      range: { startDate: formatDateToISO(d90), endDate: formatDateToISO(now) },
    },
    {
      label: 'Año actual',
      range: { startDate: formatDateToISO(firstOfYear), endDate: formatDateToISO(now) },
    },
  ]
}

export function DateRangePicker({
  value,
  onChange,
  isOpen,
  onClose,
  align = 'right',
  className = '',
}: DateRangePickerProps) {
  const [start, setStart] = useState(value.startDate)
  const [end, setEnd] = useState(value.endDate)
  const [error, setError] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setStart(value.startDate)
    setEnd(value.endDate)
    setError(null)
  }, [value, isOpen])

  // Handle click outside and escape
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setStart(val)
    if (end && val > end) {
      setError('La fecha inicial no puede ser posterior a la fecha final')
    } else {
      setError(null)
    }
  }

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setEnd(val)
    if (start && start > val) {
      setError('La fecha final no puede ser anterior a la fecha inicial')
    } else {
      setError(null)
    }
  }

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!start || !end) {
      setError('Por favor selecciona ambas fechas')
      return
    }
    if (start > end) {
      setError('La fecha inicial no puede ser posterior a la final')
      return
    }
    onChange({ startDate: start, endDate: end })
    onClose()
  }

  const handlePresetSelect = (presetRange: DateRangeValue) => {
    setStart(presetRange.startDate)
    setEnd(presetRange.endDate)
    setError(null)
  }

  const presets = getPresets()

  return (
    <div
      ref={popoverRef}
      className={`date-range-popover align-${align} ${className}`}
      role="dialog"
      aria-label="Selector de rango de fechas personalizado"
    >
      <div className="date-range-popover-header">
        <div className="popover-title-row">
          <AppIcon name="calendar" size={16} color="var(--navy)" />
          <strong>Rango de fechas personalizado</strong>
        </div>
        <button
          type="button"
          className="icon-button close-popover-btn"
          onClick={onClose}
          aria-label="Cerrar selector"
        >
          <AppIcon name="close" size={14} />
        </button>
      </div>

      {/* Quick Presets */}
      <div className="date-range-presets-list">
        <span className="presets-caption">Atajos rápidos:</span>
        <div className="presets-chips">
          {presets.map((p) => {
            const isMatch = start === p.range.startDate && end === p.range.endDate
            return (
              <button
                key={p.label}
                type="button"
                className={`preset-chip ${isMatch ? 'active' : ''}`}
                onClick={() => handlePresetSelect(p.range)}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Form with Inputs */}
      <form onSubmit={handleApply} className="date-range-form">
        <div className="date-inputs-grid">
          <div className="date-input-group">
            <label htmlFor="date-range-start">
              <AppIcon name="calendar" size={12} />
              <span>Desde (Fecha inicial):</span>
            </label>
            <input
              id="date-range-start"
              type="date"
              className="styled-date-input"
              value={start}
              onChange={handleStartChange}
              max={end || undefined}
              required
            />
          </div>

          <div className="date-range-separator">
            <AppIcon name="arrowRight" size={14} />
          </div>

          <div className="date-input-group">
            <label htmlFor="date-range-end">
              <AppIcon name="calendar" size={12} />
              <span>Hasta (Fecha final):</span>
            </label>
            <input
              id="date-range-end"
              type="date"
              className="styled-date-input"
              value={end}
              onChange={handleEndChange}
              min={start || undefined}
              required
            />
          </div>
        </div>

        {error && (
          <div className="date-range-error">
            <AppIcon name="warning" size={13} />
            <span>{error}</span>
          </div>
        )}

        <div className="date-range-actions">
          <button
            type="button"
            className="outline-button compact"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="primary-button compact"
            disabled={!start || !end || Boolean(error)}
          >
            <AppIcon name="check" size={14} />
            <span>Aplicar rango</span>
          </button>
        </div>
      </form>
    </div>
  )
}
