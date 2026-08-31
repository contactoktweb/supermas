'use client'

import React, { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  description?: string
  icon?: React.ReactNode
  badge?: string
}

export interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  error?: boolean | string
  id?: string
  name?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar opción...',
  disabled = false,
  error,
  id,
  name,
  className = '',
  size = 'md',
  icon,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const generatedId = useId()
  const selectId = id || generatedId

  const selectedOption = options.find((opt) => opt.value === value)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Scroll to highlighted item
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const itemElement = listRef.current.children[highlightedIndex] as HTMLElement
      if (itemElement) {
        itemElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, isOpen])

  const handleToggle = () => {
    if (disabled) return
    const nextState = !isOpen
    setIsOpen(nextState)
    if (nextState) {
      const currentIndex = options.findIndex((opt) => opt.value === value)
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0)
    }
  }

  const handleSelect = (val: string) => {
    onChange(val)
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (isOpen) {
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          handleSelect(options[highlightedIndex].value)
        }
      } else {
        setIsOpen(true)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        setHighlightedIndex(0)
      } else {
        setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : prev))
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        setHighlightedIndex(options.length - 1)
      } else {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setIsOpen(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`custom-select-container size-${size} ${isOpen ? 'is-open' : ''} ${
        disabled ? 'is-disabled' : ''
      } ${error ? 'has-error' : ''} ${className}`}
    >
      {/* Hidden input for form integrations if needed */}
      {name && <input type="hidden" name={name} value={value} />}

      <button
        type="button"
        id={selectId}
        className="custom-select-trigger"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="select-trigger-content">
          {icon && <span className="select-trigger-prefix-icon">{icon}</span>}
          {selectedOption ? (
            <div className="select-selected-value">
              {selectedOption.icon && (
                <span className="option-icon">{selectedOption.icon}</span>
              )}
              <span className="option-label">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="option-badge">{selectedOption.badge}</span>
              )}
            </div>
          ) : (
            <span className="select-placeholder">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          size={16}
          className={`select-chevron ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          className="custom-select-dropdown"
          role="listbox"
          aria-labelledby={selectId}
        >
          {options.length === 0 ? (
            <li className="custom-select-empty">No hay opciones disponibles</li>
          ) : (
            options.map((opt, idx) => {
              const isSelected = opt.value === value
              const isHighlighted = idx === highlightedIndex

              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`custom-select-option ${isSelected ? 'is-selected' : ''} ${
                    isHighlighted ? 'is-highlighted' : ''
                  }`}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <div className="option-content">
                    {opt.icon && <span className="option-icon">{opt.icon}</span>}
                    <div className="option-text-group">
                      <span className="option-label">{opt.label}</span>
                      {opt.description && (
                        <small className="option-description">{opt.description}</small>
                      )}
                    </div>
                    {opt.badge && <span className="option-badge">{opt.badge}</span>}
                  </div>

                  {isSelected && (
                    <Check size={16} className="option-check-icon" />
                  )}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
