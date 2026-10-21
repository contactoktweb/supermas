'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: 'new-password' | 'current-password'
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  autoFocus?: boolean
}

/** Campo de contraseña con botón accesible para mostrar u ocultar el valor. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete = 'new-password',
  disabled = false,
  invalid = false,
  describedBy,
  autoFocus = false,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="password-field">
      <label htmlFor={id} className="password-field-label">
        {label}
      </label>
      <div className={`input-wrap password-field-wrap${invalid ? ' is-invalid' : ''}`}>
        <AppIcon name="lock" size={18} aria-hidden="true" />
        <input
          id={id}
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required
          autoFocus={autoFocus}
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="password-visibility-toggle"
          onClick={() => setIsVisible((visible) => !visible)}
          aria-label={isVisible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={isVisible}
          aria-controls={id}
          disabled={disabled}
        >
          <AppIcon name={isVisible ? 'eyeOff' : 'eye'} size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
