'use client'

import React from 'react'
import { AppIcon } from './Icon'

interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  /** Nombre accesible del campo (ej. "Cantidad a recibir de Aceite"). */
  label: string
}

/** Campo de cantidad con botones − / + (táctil y teclado). El valor siempre queda entre min y max. */
export function QuantityStepper({ value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, step = 1, disabled = false, label }: QuantityStepperProps) {
  const clamp = (n: number) => Math.min(Math.max(min, n), max)

  return (
    <div className="qty-stepper" data-disabled={disabled}>
      <button
        type="button"
        className="qty-stepper-btn"
        onClick={() => onChange(clamp(value - step))}
        disabled={disabled || value <= min}
        aria-label={`Restar a ${label}`}
      >
        <AppIcon name="minus" size={14} />
      </button>
      <input
        type="number"
        inputMode="decimal"
        className="qty-stepper-input"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const n = parseFloat(e.target.value)
          onChange(Number.isNaN(n) ? min : clamp(n))
        }}
      />
      <button
        type="button"
        className="qty-stepper-btn"
        onClick={() => onChange(clamp(value + step))}
        disabled={disabled || value >= max}
        aria-label={`Sumar a ${label}`}
      >
        <AppIcon name="plus" size={14} />
      </button>
    </div>
  )
}
