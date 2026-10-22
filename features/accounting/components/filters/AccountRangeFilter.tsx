'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { AccountingAccount } from '../../types'
import { comparePucCodes, formatPucRangeLabel, normalizePucRange } from '../../utils/puc-code-range'

/** Máximo de opciones visibles en la lista (el resto se alcanza afinando la búsqueda). */
const MAX_VISIBLE_OPTIONS = 60

/** Un código PUC escrito a mano: dígitos con auxiliares opcionales tras punto. */
const PUC_CODE_PATTERN = /^\d+(\.\d+)*$/

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

interface AccountOption {
  code: string
  name: string
  levelLabel: string
}

const LEVEL_LABELS: Record<string, string> = {
  CLASS: 'Clase',
  GROUP: 'Grupo',
  ACCOUNT: 'Cuenta',
  SUBACCOUNT: 'Subcuenta',
  AUXILIARY: 'Auxiliar',
}

interface AccountCodeComboboxProps {
  label: string
  value: string
  onChange: (code: string) => void
  options: AccountOption[]
  placeholder: string
  disabled?: boolean
}

/** Selector de una cuenta PUC con búsqueda por código o nombre (vacío = sin límite). */
function AccountCodeCombobox({ label, value, onChange, options, placeholder, disabled }: AccountCodeComboboxProps) {
  const inputId = useId()
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)

  const selected = useMemo(() => options.find((o) => o.code === value), [options, value])
  const displayValue = isOpen ? query : value ? (selected ? `${selected.code} — ${selected.name}` : value) : ''

  const filtered = useMemo(() => {
    const q = normalizeText(query)
    if (!q) return options.slice(0, MAX_VISIBLE_OPTIONS)
    const byCode = options.filter((o) => o.code.startsWith(q))
    const byText = options.filter((o) => !o.code.startsWith(q) && (o.code.includes(q) || normalizeText(o.name).includes(q)))
    return [...byCode, ...byText].slice(0, MAX_VISIBLE_OPTIONS)
  }, [options, query])

  useEffect(() => {
    if (!isOpen) return
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !listRef.current) return
    const active = listRef.current.querySelector<HTMLElement>(`[data-index="${highlighted}"]`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [highlighted, isOpen])

  const open = () => {
    if (disabled) return
    setQuery('')
    setHighlighted(0)
    setIsOpen(true)
  }

  const choose = (code: string) => {
    onChange(code)
    setIsOpen(false)
    setQuery('')
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      event.preventDefault()
      open()
      return
    }
    if (!isOpen) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = filtered[highlighted]
      if (option) choose(option.code)
      else if (PUC_CODE_PATTERN.test(query.trim())) choose(query.trim())
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setIsOpen(false)
    } else if (event.key === 'Tab') {
      setIsOpen(false)
    }
  }

  const activeOptionId = isOpen && filtered[highlighted] ? `${listId}-opt-${highlighted}` : undefined

  return (
    <div ref={containerRef} className="relative min-w-0">
      <label htmlFor={inputId} className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
          <AppIcon name="search" size={13} />
        </span>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={displayValue}
          onFocus={open}
          onClick={() => !isOpen && open()}
          onChange={(e) => {
            setQuery(e.target.value)
            setHighlighted(0)
            if (!isOpen) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className="w-full h-9 pl-7 pr-8 text-xs bg-white border border-slate-300 rounded-md text-slate-800 font-mono truncate transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500 disabled:bg-slate-100"
        />
        {value && !disabled && (
          <button
            type="button"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition"
            onClick={() => choose('')}
            aria-label={`Quitar ${label.toLowerCase()} (todas las cuentas)`}
          >
            <AppIcon name="close" size={12} />
          </button>
        )}
      </div>

      {isOpen && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-[60] mt-1 left-0 right-0 sm:right-auto sm:min-w-[320px] max-w-[calc(100vw-32px)] max-h-64 overflow-y-auto overscroll-contain bg-white border border-slate-200 rounded-lg shadow-xl py-1 motion-safe:animate-[popoverSlideDown_.18s_cubic-bezier(0.16,1,0.3,1)]"
        >
          <li
            role="option"
            aria-selected={!value}
            className="px-3 py-2 text-xs cursor-pointer text-slate-600 hover:bg-slate-50 border-b border-slate-100"
            onMouseDown={(e) => {
              e.preventDefault()
              choose('')
            }}
          >
            Todas las cuentas (sin límite)
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-xs text-slate-500" role="presentation">
              {PUC_CODE_PATTERN.test(query.trim())
                ? `Sin coincidencias. Presione Enter para usar el código ${query.trim()}.`
                : 'No hay cuentas que coincidan con la búsqueda.'}
            </li>
          ) : (
            filtered.map((option, index) => {
              const isActive = index === highlighted
              const isSelected = option.code === value
              return (
                <li
                  key={option.code}
                  id={`${listId}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  className={`px-3 py-1.5 text-xs cursor-pointer flex items-baseline gap-2 transition-colors ${
                    isActive ? 'bg-blue-50 text-blue-950' : 'text-slate-800 hover:bg-slate-50'
                  } ${isSelected ? 'font-bold' : ''}`}
                  onMouseEnter={() => setHighlighted(index)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(option.code)
                  }}
                >
                  <span className="font-mono text-blue-900 shrink-0">{option.code}</span>
                  <span className="truncate">{option.name}</span>
                  <span className="ml-auto text-[10px] text-slate-400 shrink-0">{option.levelLabel}</span>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}

export interface AccountRangeValue {
  from: string
  to: string
}

interface AccountRangeFilterProps {
  accounts: AccountingAccount[]
  value: AccountRangeValue
  onChange: (value: AccountRangeValue) => void
  disabled?: boolean
  /** Muestra debajo el texto "Cuentas de X a Y". */
  showSummary?: boolean
  className?: string
}

/**
 * Cuenta inicial y cuenta final del PUC (por defecto todas). El rango es incluyente y la cuenta
 * final abarca sus subcuentas y auxiliares (orden PUC, ver utils/puc-code-range).
 */
export function AccountRangeFilter({
  accounts,
  value,
  onChange,
  disabled,
  showSummary = true,
  className = '',
}: AccountRangeFilterProps) {
  const options = useMemo<AccountOption[]>(() => {
    const seen = new Set<string>()
    return [...accounts]
      .filter((acc) => {
        if (!acc.code || seen.has(acc.code)) return false
        seen.add(acc.code)
        return true
      })
      .sort((a, b) => comparePucCodes(a.code, b.code))
      .map((acc) => ({ code: acc.code, name: acc.name, levelLabel: LEVEL_LABELS[acc.level] || '' }))
  }, [accounts])

  const normalized = normalizePucRange(value)
  const isInverted = Boolean(value.from && value.to && (normalized.from !== value.from || normalized.to !== value.to))

  return (
    <div className={className}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <AccountCodeCombobox
          label="Cuenta inicial"
          value={value.from}
          onChange={(code) => onChange({ ...value, from: code })}
          options={options}
          placeholder="Todas · código o nombre"
          disabled={disabled}
        />
        <AccountCodeCombobox
          label="Cuenta final"
          value={value.to}
          onChange={(code) => onChange({ ...value, to: code })}
          options={options}
          placeholder="Todas · código o nombre"
          disabled={disabled}
        />
      </div>
      {showSummary && (
        <p className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1.5" aria-live="polite">
          <AppIcon name="layers" size={12} />
          <span>
            {formatPucRangeLabel(value)}
            {isInverted ? ' (se ordenó el rango de menor a mayor)' : ''}
          </span>
        </p>
      )}
    </div>
  )
}
