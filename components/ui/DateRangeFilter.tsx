'use client'

import React, { useState, useEffect, useRef } from 'react'
import { AppIcon } from './Icon'

export interface DateRangeFilterValue {
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
}

export interface DateRangeFilterProps {
  startDate?: string
  endDate?: string
  onChange: (range: DateRangeFilterValue) => void
  placeholder?: string
  align?: 'left' | 'right'
  className?: string
  size?: 'sm' | 'md'
}

const MONTH_NAMES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]

function formatDateToISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatReadableDate(isoDate: string): string {
  if (!isoDate) return ''
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  const year = parts[0]
  const monthIdx = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  const monthStr = MONTH_NAMES[monthIdx] || parts[1]
  return `${day} ${monthStr} ${year}`
}

export function formatRangeLabel(startDate?: string, endDate?: string, placeholder = 'Filtrar por fecha'): string {
  if (!startDate && !endDate) return placeholder

  if (startDate && endDate) {
    if (startDate === endDate) {
      return formatReadableDate(startDate)
    }

    const [y1, m1, d1] = startDate.split('-')
    const [y2, m2, d2] = endDate.split('-')

    if (y1 === y2 && m1 === m2) {
      return `${parseInt(d1, 10)} - ${parseInt(d2, 10)} ${MONTH_NAMES[parseInt(m1, 10) - 1]} ${y1}`
    }

    if (y1 === y2) {
      return `${parseInt(d1, 10)} ${MONTH_NAMES[parseInt(m1, 10) - 1]} - ${parseInt(d2, 10)} ${MONTH_NAMES[parseInt(m2, 10) - 1]} ${y1}`
    }

    return `${formatReadableDate(startDate)} - ${formatReadableDate(endDate)}`
  }

  if (startDate) {
    return `Desde: ${formatReadableDate(startDate)}`
  }

  if (endDate) {
    return `Hasta: ${formatReadableDate(endDate)}`
  }

  return placeholder
}

interface PresetOption {
  label: string
  getRange: () => { startDate: string; endDate: string }
}

const PRESETS: PresetOption[] = [
  {
    label: 'Hoy',
    getRange: () => {
      const now = new Date()
      const str = formatDateToISO(now)
      return { startDate: str, endDate: str }
    },
  },
  {
    label: 'Ayer',
    getRange: () => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const str = formatDateToISO(d)
      return { startDate: str, endDate: str }
    },
  },
  {
    label: 'Últimos 7 días',
    getRange: () => {
      const now = new Date()
      const d = new Date()
      d.setDate(d.getDate() - 6)
      return { startDate: formatDateToISO(d), endDate: formatDateToISO(now) }
    },
  },
  {
    label: 'Últimos 15 días',
    getRange: () => {
      const now = new Date()
      const d = new Date()
      d.setDate(d.getDate() - 14)
      return { startDate: formatDateToISO(d), endDate: formatDateToISO(now) }
    },
  },
  {
    label: 'Este mes',
    getRange: () => {
      const now = new Date()
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { startDate: formatDateToISO(first), endDate: formatDateToISO(now) }
    },
  },
  {
    label: 'Mes anterior',
    getRange: () => {
      const now = new Date()
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return { startDate: formatDateToISO(first), endDate: formatDateToISO(last) }
    },
  },
  {
    label: 'Últimos 90 días',
    getRange: () => {
      const now = new Date()
      const d = new Date()
      d.setDate(d.getDate() - 89)
      return { startDate: formatDateToISO(d), endDate: formatDateToISO(now) }
    },
  },
  {
    label: 'Año actual',
    getRange: () => {
      const now = new Date()
      const first = new Date(now.getFullYear(), 0, 1)
      return { startDate: formatDateToISO(first), endDate: formatDateToISO(now) }
    },
  },
]

export function DateRangeFilter({
  startDate,
  endDate,
  onChange,
  placeholder = 'Filtrar por fecha',
  align = 'left',
  className = '',
  size = 'sm',
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempStart, setTempStart] = useState(startDate || '')
  const [tempEnd, setTempEnd] = useState(endDate || '')
  const [error, setError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  const hasValue = Boolean(startDate || endDate)
  const displayLabel = formatRangeLabel(startDate, endDate, placeholder)

  useEffect(() => {
    setTempStart(startDate || '')
    setTempEnd(endDate || '')
    setError(null)
  }, [startDate, endDate, isOpen])

  // Handle click outside and Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handlePresetClick = (preset: PresetOption) => {
    const range = preset.getRange()
    setTempStart(range.startDate)
    setTempEnd(range.endDate)
    setError(null)
  }

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setTempStart(val)
    if (tempEnd && val && val > tempEnd) {
      setError('La fecha inicial no puede ser posterior a la fecha final')
    } else {
      setError(null)
    }
  }

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setTempEnd(val)
    if (tempStart && val && tempStart > val) {
      setError('La fecha final no puede ser anterior a la fecha inicial')
    } else {
      setError(null)
    }
  }

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (tempStart && tempEnd && tempStart > tempEnd) {
      setError('La fecha inicial no puede ser posterior a la final')
      return
    }
    onChange({
      startDate: tempStart || undefined,
      endDate: tempEnd || undefined,
    })
    setIsOpen(false)
  }

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setTempStart('')
    setTempEnd('')
    setError(null)
    onChange({ startDate: undefined, endDate: undefined })
    setIsOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className={`date-range-filter-container ${className}`}
      style={{ position: 'relative' }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        className={`date-range-filter-trigger size-${size} ${hasValue ? 'is-active' : ''} ${
          isOpen ? 'is-open' : ''
        }`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={hasValue ? `Rango: ${displayLabel}` : 'Seleccionar rango de fechas'}
      >
        <span className="date-trigger-icon-wrap">
          <AppIcon
            name="calendar"
            size={14}
            color={hasValue ? 'var(--red)' : '#475569'}
          />
        </span>

        <span className="date-trigger-text">{displayLabel}</span>

        {hasValue && (
          <span
            className="date-trigger-clear-btn"
            onClick={handleClear}
            role="button"
            tabIndex={0}
            title="Quitar filtro de fechas"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleClear()
              }
            }}
          >
            <AppIcon name="close" size={12} color="#64748b" />
          </span>
        )}

        <span className={`date-trigger-chevron ${isOpen ? 'rotate' : ''}`}>
          <AppIcon name="chevronDown" size={12} color="#64748b" />
        </span>
      </button>

      {/* Floating Popover */}
      {isOpen && (
        <div
          className={`date-range-popover-box align-${align}`}
          role="dialog"
          aria-label="Selector de rango de fechas"
        >
          {/* Header */}
          <div className="date-range-popover-box-header">
            <div className="popover-box-title">
              <AppIcon name="calendar" size={15} color="var(--navy)" />
              <span>Filtrar por Rango de Fechas</span>
            </div>
            <button
              type="button"
              className="popover-box-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar selector"
            >
              <AppIcon name="close" size={14} color="#64748b" />
            </button>
          </div>

          {/* Quick Presets Chips */}
          <div className="date-range-presets-section">
            <span className="presets-section-label">Atajos rápidos:</span>
            <div className="presets-chips-grid">
              {PRESETS.map((p) => {
                const range = p.getRange()
                const isSelected =
                  tempStart === range.startDate && tempEnd === range.endDate
                return (
                  <button
                    key={p.label}
                    type="button"
                    className={`date-preset-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => handlePresetClick(p)}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Manual Date Inputs */}
          <form onSubmit={handleApply} className="date-range-popover-form">
            <div className="date-range-inputs-row">
              <div className="date-input-field">
                <label htmlFor="filter-start-date">
                  <AppIcon name="calendar" size={12} color="#64748b" />
                  <span>Desde</span>
                </label>
                <input
                  id="filter-start-date"
                  type="date"
                  className="filter-date-input"
                  value={tempStart}
                  onChange={handleStartChange}
                  max={tempEnd || undefined}
                />
              </div>

              <div className="date-inputs-arrow">
                <AppIcon name="arrowRight" size={14} color="#94a3b8" />
              </div>

              <div className="date-input-field">
                <label htmlFor="filter-end-date">
                  <AppIcon name="calendar" size={12} color="#64748b" />
                  <span>Hasta</span>
                </label>
                <input
                  id="filter-end-date"
                  type="date"
                  className="filter-date-input"
                  value={tempEnd}
                  onChange={handleEndChange}
                  min={tempStart || undefined}
                />
              </div>
            </div>

            {error && (
              <div className="date-range-popover-error">
                <AppIcon name="warning" size={13} color="#dc2626" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="date-range-popover-footer">
              <button
                type="button"
                className="outline-button compact date-clear-action-btn"
                onClick={() => {
                  setTempStart('')
                  setTempEnd('')
                  setError(null)
                  onChange({ startDate: undefined, endDate: undefined })
                  setIsOpen(false)
                }}
              >
                Limpiar
              </button>

              <div className="date-footer-right-actions">
                <button
                  type="button"
                  className="outline-button compact"
                  onClick={() => setIsOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-button compact"
                  disabled={Boolean(error)}
                >
                  <AppIcon name="check" size={13} color="#ffffff" />
                  <span>Aplicar</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
