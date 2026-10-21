'use client'

import React, { useId } from 'react'
import { CustomSelect, type SelectOption } from '@/components/ui/CustomSelect'
import { AppIcon } from '@/components/ui/Icon'

interface FieldShellProps {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}

function FieldShell({ id, label, required, error, hint, children, className = '' }: FieldShellProps) {
  return (
    <div className={`form-field ${className}`}>
      <label htmlFor={id}>
        {label} {required && <em>*</em>}
      </label>
      {children}
      {error ? (
        <span id={`${id}-error`} className="field-error-text">
          {error}
        </span>
      ) : hint ? (
        <small id={`${id}-hint`} className="field-hint">
          {hint}
        </small>
      ) : null}
    </div>
  )
}

const describedBy = (id: string, error?: string, hint?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined

interface HrTextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'tel' | 'date' | 'number'
  required?: boolean
  error?: string
  hint?: string
  placeholder?: string
  maxLength?: number
  min?: string
  max?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
  disabled?: boolean
  className?: string
  prefix?: string
}

export function HrTextField({
  label,
  value,
  onChange,
  type = 'text',
  required,
  error,
  hint,
  placeholder,
  maxLength,
  min,
  max,
  inputMode,
  autoComplete = 'off',
  disabled,
  className,
  prefix,
}: HrTextFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <div className={`input-wrap ${error ? 'is-invalid' : ''}`}>
        {prefix && <span className="input-prefix">{prefix}</span>}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          min={min}
          max={max}
          inputMode={inputMode}
          autoComplete={autoComplete}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(id, error, hint)}
        />
      </div>
    </FieldShell>
  )
}

interface HrSelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  required?: boolean
  error?: string
  hint?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function HrSelectField({ label, value, onChange, options, required, error, hint, placeholder, disabled, className }: HrSelectFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <CustomSelect id={id} value={value} onChange={onChange} options={options} placeholder={placeholder} disabled={disabled} error={error} />
    </FieldShell>
  )
}

interface HrTextAreaFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  error?: string
  hint?: string
  placeholder?: string
  maxLength?: number
  rows?: number
}

export function HrTextAreaField({ label, value, onChange, required, error, hint, placeholder, maxLength, rows = 3 }: HrTextAreaFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="custom-form-textarea"
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
      />
    </FieldShell>
  )
}

interface HrCheckboxFieldProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  error?: string
  description?: string
}

export function HrCheckboxField({ label, checked, onChange, error, description }: HrCheckboxFieldProps) {
  const id = useId()
  return (
    <div className="form-field">
      <label htmlFor={id} className="toggle-row-simple catalog-form-toggle flex items-start gap-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5"
        />
        <span>
          {label}
          {description && <small className="block text-[11px] text-[var(--muted)]">{description}</small>}
        </span>
      </label>
      {error && (
        <span id={`${id}-error`} className="field-error-text">
          {error}
        </span>
      )}
    </div>
  )
}

/** Sección de formulario con título (H3 bajo el H2 del drawer/modal). */
export function HrFormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 last:border-b-0">
      <h3 className="m-0 text-[13px] font-bold text-[var(--navy)]">{title}</h3>
      {children}
    </section>
  )
}

interface HrFormFooterProps {
  onCancel: () => void
  isSubmitting: boolean
  submitLabel: string
  submittingLabel?: string
  tone?: 'primary' | 'danger'
  className?: string
}

export function HrFormFooter({ onCancel, isSubmitting, submitLabel, submittingLabel = 'Guardando...', tone = 'primary', className = 'modal-footer' }: HrFormFooterProps) {
  return (
    <footer className={`${className} flex-wrap`}>
      <button type="button" className="outline-button compact" onClick={onCancel} disabled={isSubmitting}>
        Cancelar
      </button>
      <button
        type="submit"
        className={`${tone === 'danger' ? 'danger-button' : 'primary-button'} compact disabled:opacity-50`}
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        <AppIcon name={isSubmitting ? 'refresh' : 'save'} size={16} className={isSubmitting ? 'spin-animation' : ''} />
        <span>{isSubmitting ? submittingLabel : submitLabel}</span>
      </button>
    </footer>
  )
}

/** Mensaje de error general del formulario. */
export function HrFormError({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <div className="form-error-banner page-enter" role="alert">
      <AppIcon name="warning" size={16} />
      <span>{message}</span>
    </div>
  )
}
