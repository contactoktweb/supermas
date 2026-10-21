'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { PASSWORD_RULES, PasswordStrength } from '../schemas/password-policy.schema'

interface PasswordStrengthMeterProps {
  id: string
  strength: PasswordStrength
}

const METER_SEGMENTS = 4

/** Medidor de fortaleza y lista de requisitos de la política de contraseñas. */
export function PasswordStrengthMeter({ id, strength }: PasswordStrengthMeterProps) {
  const satisfied = new Set(strength.satisfiedRules)

  return (
    <div id={id} className="password-strength" data-level={strength.level}>
      <div className="password-strength-header">
        <span className="password-strength-caption">Fortaleza</span>
        <span className="password-strength-label" aria-live="polite">
          {strength.label}
        </span>
      </div>
      <div
        className="password-strength-track"
        role="meter"
        aria-label="Fortaleza de la contraseña"
        aria-valuemin={0}
        aria-valuemax={METER_SEGMENTS}
        aria-valuenow={strength.level}
        aria-valuetext={strength.label}
      >
        {Array.from({ length: METER_SEGMENTS }, (_, index) => (
          <span key={index} className={`password-strength-segment${index < strength.level ? ' is-filled' : ''}`} />
        ))}
      </div>
      <ul className="password-rules" aria-label="Requisitos de la contraseña">
        {PASSWORD_RULES.map((rule) => {
          const isMet = satisfied.has(rule.id)
          return (
            <li key={rule.id} className={isMet ? 'is-met' : undefined}>
              <AppIcon name={isMet ? 'check' : 'close'} size={15} aria-hidden="true" />
              <span>{rule.label}</span>
              <span className="sr-only">{isMet ? '(cumplido)' : '(pendiente)'}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
