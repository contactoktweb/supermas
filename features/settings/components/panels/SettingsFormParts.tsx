'use client'

import React, { useId } from 'react'
import Link from 'next/link'
import { AppIcon, LightIconName } from '@/components/ui/Icon'

interface FieldProps {
  label: string
  required?: boolean
  hint?: string
  children: (id: string) => React.ReactNode
}

export function SettingsField({ label, required, hint, children }: FieldProps) {
  const id = useId()
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label} {required && <em>*</em>}
      </label>
      {children(id)}
      {hint && <small className="field-hint">{hint}</small>}
    </div>
  )
}

interface TextInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'email' | 'tel'
  maxLength?: number
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  mono?: boolean
}

export function SettingsTextInput({ id, value, onChange, placeholder, type = 'text', maxLength, inputMode, mono }: TextInputProps) {
  return (
    <div className="input-wrap">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        className={mono ? 'font-mono' : undefined}
      />
    </div>
  )
}

interface NumberInputProps {
  id: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  prefix?: string
  suffix?: string
}

export function SettingsNumberInput({ id, value, onChange, min = 0, max, prefix, suffix }: NumberInputProps) {
  return (
    <div className="input-wrap">
      {prefix && <span className="input-prefix">{prefix}</span>}
      <input
        id={id}
        type="number"
        step="any"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className="font-mono"
      />
      {suffix && <span className="input-suffix">{suffix}</span>}
    </div>
  )
}

interface ToggleRowProps {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function SettingsToggleRow({ title, description, checked, onChange }: ToggleRowProps) {
  const id = useId()
  return (
    <label htmlFor={id} className="settings-toggle-row">
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="settings-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export function SettingsSaveButton({ isSaving, label, onClick }: { isSaving?: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className="primary-button w-full justify-center" disabled={isSaving} onClick={onClick}>
      <AppIcon name={isSaving ? 'refresh' : 'save'} size={15} className={isSaving ? 'spin' : ''} />
      <span>{isSaving ? 'Guardando…' : label}</span>
    </button>
  )
}

export function SettingsReadOnlyList({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="settings-readonly-list">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function SettingsModuleLink({ href, icon, label }: { href: string; icon: LightIconName; label: string }) {
  return (
    <Link href={href} className="outline-button w-full justify-center">
      <AppIcon name={icon} size={15} />
      <span>{label}</span>
    </Link>
  )
}

export function SettingsNotice({ tone = 'info', children }: { tone?: 'info' | 'warning'; children: React.ReactNode }) {
  return (
    <p className={`settings-notice is-${tone}`}>
      <AppIcon name={tone === 'warning' ? 'warning' : 'info'} size={15} />
      <span>{children}</span>
    </p>
  )
}
