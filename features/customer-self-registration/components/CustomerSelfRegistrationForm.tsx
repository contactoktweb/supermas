'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import {
  SELF_REGISTRATION_DOCUMENT_TYPES,
  selfRegistrationSchema,
  type SelfRegistrationInput,
} from '../schemas/self-registration.schema'

type FormState = Omit<SelfRegistrationInput, 'acceptsDataPolicy'> & { acceptsDataPolicy: boolean }
type FieldErrors = Partial<Record<keyof FormState, string>>

const EMPTY_FORM: FormState = {
  personType: 'NATURAL',
  documentType: 'CC',
  documentNumber: '',
  verificationDigit: '',
  firstName: '',
  lastName: '',
  businessName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  department: '',
  acceptsDataPolicy: false,
  website: '',
}

const REGISTRATION_ENDPOINT = '/api/public/customer-registration'

export function CustomerSelfRegistrationForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const isCompany = form.personType === 'COMPANY'
  const isNit = form.documentType === 'NIT'

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const parsed = selfRegistrationSchema.safeParse(form)
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState
        if (key && !next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(REGISTRATION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const body = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!res.ok || !body?.success) {
        setSubmitError(body?.error || 'No se pudieron guardar los datos. Intenta de nuevo.')
        return
      }
      setDone(true)
    } catch {
      setSubmitError('No hay conexión. Revisa tu internet e intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="self-registration-done" role="status">
        <span className="self-registration-done-icon">
          <AppIcon name="check" size={30} color="#059669" />
        </span>
        <h2>¡Datos recibidos!</h2>
        <p>Avísale al cajero que ya te registraste: buscará tu documento para emitir tu factura electrónica.</p>
      </div>
    )
  }

  const field = (key: keyof FormState) => ({
    'aria-invalid': Boolean(errors[key]) || undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
  })
  const errorText = (key: keyof FormState) =>
    errors[key] ? (
      <span id={`${key}-error`} className="self-registration-error">
        {errors[key]}
      </span>
    ) : null

  return (
    <form className="self-registration-form" onSubmit={handleSubmit} noValidate>
      <fieldset className="self-registration-segment">
        <legend>Tipo de persona</legend>
        {(
          [
            ['NATURAL', 'Persona natural'],
            ['COMPANY', 'Empresa'],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className={form.personType === value ? 'is-active' : undefined}>
            <input
              type="radio"
              name="personType"
              value={value}
              checked={form.personType === value}
              onChange={() => {
                set('personType', value)
                set('documentType', value === 'COMPANY' ? 'NIT' : 'CC')
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="self-registration-grid">
        <div className="self-registration-field">
          <label htmlFor="sr-document-type">Tipo de documento</label>
          <select id="sr-document-type" value={form.documentType} onChange={(e) => set('documentType', e.target.value as FormState['documentType'])}>
            {SELF_REGISTRATION_DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className={`self-registration-field${isNit ? ' has-dv' : ''}`}>
          <label htmlFor="sr-document-number">Número de documento</label>
          <div className="self-registration-document">
            <input
              id="sr-document-number"
              inputMode={isNit || form.documentType === 'CC' ? 'numeric' : 'text'}
              autoComplete="off"
              value={form.documentNumber}
              onChange={(e) => set('documentNumber', e.target.value.replace(/[\s.-]/g, ''))}
              {...field('documentNumber')}
            />
            {isNit && (
              <input
                id="sr-dv"
                aria-label="Dígito de verificación"
                inputMode="numeric"
                maxLength={1}
                placeholder="DV"
                value={form.verificationDigit}
                onChange={(e) => set('verificationDigit', e.target.value.replace(/\D/g, ''))}
                {...field('verificationDigit')}
              />
            )}
          </div>
          {errorText('documentNumber')}
          {errorText('verificationDigit')}
        </div>
      </div>

      {isCompany ? (
        <div className="self-registration-field">
          <label htmlFor="sr-business-name">Razón social</label>
          <input id="sr-business-name" autoComplete="organization" value={form.businessName} onChange={(e) => set('businessName', e.target.value)} {...field('businessName')} />
          {errorText('businessName')}
        </div>
      ) : (
        <div className="self-registration-grid">
          <div className="self-registration-field">
            <label htmlFor="sr-first-name">Nombres</label>
            <input id="sr-first-name" autoComplete="given-name" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} {...field('firstName')} />
            {errorText('firstName')}
          </div>
          <div className="self-registration-field">
            <label htmlFor="sr-last-name">Apellidos</label>
            <input id="sr-last-name" autoComplete="family-name" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} {...field('lastName')} />
            {errorText('lastName')}
          </div>
        </div>
      )}

      <div className="self-registration-grid">
        <div className="self-registration-field">
          <label htmlFor="sr-email">Correo para la factura electrónica</label>
          <input id="sr-email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} {...field('email')} />
          {errorText('email')}
        </div>
        <div className="self-registration-field">
          <label htmlFor="sr-phone">Teléfono</label>
          <input id="sr-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} {...field('phone')} />
          {errorText('phone')}
        </div>
      </div>

      <div className="self-registration-field">
        <label htmlFor="sr-address">Dirección</label>
        <input id="sr-address" autoComplete="street-address" value={form.address} onChange={(e) => set('address', e.target.value)} {...field('address')} />
        {errorText('address')}
      </div>

      <div className="self-registration-grid">
        <div className="self-registration-field">
          <label htmlFor="sr-city">Ciudad</label>
          <input id="sr-city" autoComplete="address-level2" value={form.city} onChange={(e) => set('city', e.target.value)} {...field('city')} />
          {errorText('city')}
        </div>
        <div className="self-registration-field">
          <label htmlFor="sr-department">Departamento</label>
          <input id="sr-department" autoComplete="address-level1" value={form.department} onChange={(e) => set('department', e.target.value)} {...field('department')} />
          {errorText('department')}
        </div>
      </div>

      <div className="self-registration-trap" aria-hidden="true">
        <label htmlFor="sr-website">Sitio web</label>
        <input id="sr-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} />
      </div>

      <label className="self-registration-consent">
        <input type="checkbox" checked={form.acceptsDataPolicy} onChange={(e) => set('acceptsDataPolicy', e.target.checked)} {...field('acceptsDataPolicy')} />
        <span>Autorizo a Super Más a usar estos datos para emitir mis facturas electrónicas y enviarlas a mi correo.</span>
      </label>
      {errorText('acceptsDataPolicy')}

      {submitError && (
        <p className="self-registration-alert" role="alert">
          <AppIcon name="warning" size={16} color="#b91c1c" />
          <span>{submitError}</span>
        </p>
      )}

      <button type="submit" className="primary-button self-registration-submit" disabled={submitting}>
        {submitting ? 'Guardando…' : 'Enviar mis datos'}
      </button>
    </form>
  )
}
