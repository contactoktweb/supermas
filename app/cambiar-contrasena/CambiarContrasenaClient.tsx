'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { Footer } from '@/components/Footer'
import { useAuth } from '@/features/auth'
import { authService, InitialPasswordChangeOutcome } from '@/features/auth/services/auth.service'
import { PasswordField } from '@/features/auth/components/PasswordField'
import { PasswordStrengthMeter } from '@/features/auth/components/PasswordStrengthMeter'
import { changePasswordSchema, evaluatePasswordStrength } from '@/features/auth/schemas/password-policy.schema'

type ViewState = 'verifying' | 'load-error' | 'form' | 'success'
type FieldErrors = Partial<Record<'newPassword' | 'confirmPassword', string>>

/** Pausa breve para que el mensaje de éxito sea legible antes de entrar al ERP. */
const SUCCESS_REDIRECT_DELAY_MS = 1400
const STRENGTH_METER_ID = 'new-password-strength'
const CONFIRM_ERROR_ID = 'confirm-password-error'
const NEW_PASSWORD_ERROR_ID = 'new-password-error'

export function CambiarContrasenaClient() {
  const { user, signOut } = useAuth()
  const [view, setView] = useState<ViewState>('verifying')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [outcome, setOutcome] = useState<InitialPasswordChangeOutcome | null>(null)
  const [verifyAttempt, setVerifyAttempt] = useState(0)

  const strength = useMemo(() => evaluatePasswordStrength(newPassword), [newPassword])

  useEffect(() => {
    let isMounted = true
    authService
      .getPendingPasswordChangeStatus()
      .then((status) => {
        if (!isMounted) return
        if (status === 'NO_SESSION') window.location.replace('/login')
        else if (status === 'NOT_REQUIRED') window.location.replace('/')
        else setView('form')
      })
      .catch(() => {
        if (isMounted) setView('load-error')
      })
    return () => {
      isMounted = false
    }
  }, [verifyAttempt])

  useEffect(() => {
    if (outcome !== 'SESSION_REFRESHED') return
    const timer = window.setTimeout(() => window.location.assign('/'), SUCCESS_REDIRECT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [outcome])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const parsed = changePasswordSchema.safeParse({ newPassword, confirmPassword })
    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldErrors
        if (field && !errors[field]) errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})

    setIsSubmitting(true)
    try {
      const result = await authService.changeInitialPassword(parsed.data)
      setNewPassword('')
      setConfirmPassword('')
      setOutcome(result)
      setView('success')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No fue posible actualizar la contraseña.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    await signOut()
    window.location.assign('/login')
  }

  const firstName = user?.fullName?.trim().split(/\s+/)[0]
  const isBusy = isSubmitting || isSigningOut

  return (
    <main className="login-shell">
      <section className="login-visual" aria-labelledby="change-password-title">
        <div className="visual-grid" />
        <div className="visual-copy">
          <div className="brand">
            <img src="/super-mas-logo.svg" alt="Super Más ERP/POS" width={155} height={40} />
            <span>ERP / POS</span>
          </div>
          <p className="eyebrow">Primer ingreso</p>
          <h1 id="change-password-title">
            Cambio de contraseña
            <br />
            <em>obligatorio.</em>
          </h1>
          <p className="visual-description">
            Tu cuenta fue creada por un administrador con una contraseña temporal. Define ahora una
            contraseña personal que solo tú conozcas para empezar a usar el ERP.
          </p>
          <div className="visual-metrics">
            <div>
              <strong>Personal</strong>
              <span>Solo tú la conoces</span>
            </div>
            <div>
              <strong>Auditable</strong>
              <span>Cambio registrado</span>
            </div>
          </div>
        </div>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand">
            <div className="brand">
              <img src="/super-mas-logo.svg" alt="" width={155} height={40} />
              <span>ERP / POS</span>
            </div>
          </div>

          {view === 'verifying' && (
            <div className="password-change-status" role="status" aria-live="polite">
              <span className="password-change-spinner" aria-hidden="true" />
              <span>Verificando tu sesión...</span>
            </div>
          )}

          {view === 'load-error' && (
            <div className="password-change-result">
              <div className="password-change-result-icon is-error">
                <AppIcon name="warning" size={30} aria-hidden="true" />
              </div>
              <h2>No pudimos verificar tu sesión</h2>
              <p>Revisa tu conexión e intenta de nuevo.</p>
              <button
                className="primary-button password-change-full"
                type="button"
                onClick={() => {
                  setView('verifying')
                  setVerifyAttempt((attempt) => attempt + 1)
                }}
              >
                <AppIcon name="refresh" size={18} aria-hidden="true" />
                Reintentar
              </button>
            </div>
          )}

          {view === 'success' && (
            <div className="password-change-result" role="status" aria-live="polite">
              <div className="password-change-result-icon is-success">
                <AppIcon name="check" size={30} aria-hidden="true" />
              </div>
              <h2>Contraseña actualizada</h2>
              {outcome === 'SESSION_REFRESHED' ? (
                <>
                  <p>Tu nueva contraseña quedó guardada. Te estamos llevando al panel principal.</p>
                  <a className="primary-button password-change-full" href="/">
                    Ir al panel principal
                    <AppIcon name="arrowRight" size={18} aria-hidden="true" />
                  </a>
                </>
              ) : (
                <>
                  <p>Tu nueva contraseña quedó guardada. Inicia sesión de nuevo con ella para continuar.</p>
                  <a className="primary-button password-change-full" href="/login">
                    Ir al inicio de sesión
                    <AppIcon name="arrowRight" size={18} aria-hidden="true" />
                  </a>
                </>
              )}
            </div>
          )}

          {view === 'form' && (
            <>
              <header className="login-heading">
                <div className="login-status-pill password-change-pill">
                  <AppIcon name="shield" size={14} aria-hidden="true" />
                  <span>Acción requerida</span>
                </div>
                <h2>{firstName ? `Hola, ${firstName}` : 'Define tu contraseña'}</h2>
                <p>Antes de continuar debes reemplazar la contraseña temporal por una nueva.</p>
              </header>

              {formError && (
                <div className="password-change-alert" role="alert">
                  <AppIcon name="warning" size={18} aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}

              <form className="password-change-form" onSubmit={handleSubmit} noValidate>
                <PasswordField
                  id="new-password"
                  label="Nueva contraseña"
                  value={newPassword}
                  onChange={(value) => {
                    setNewPassword(value)
                    if (fieldErrors.newPassword) setFieldErrors((prev) => ({ ...prev, newPassword: undefined }))
                  }}
                  placeholder="Escribe tu nueva contraseña"
                  disabled={isBusy}
                  invalid={Boolean(fieldErrors.newPassword)}
                  describedBy={`${STRENGTH_METER_ID}${fieldErrors.newPassword ? ` ${NEW_PASSWORD_ERROR_ID}` : ''}`}
                  autoFocus
                />
                {fieldErrors.newPassword && (
                  <p id={NEW_PASSWORD_ERROR_ID} className="password-field-error">
                    {fieldErrors.newPassword}
                  </p>
                )}

                <PasswordStrengthMeter id={STRENGTH_METER_ID} strength={strength} />

                <PasswordField
                  id="confirm-password"
                  label="Confirmar nueva contraseña"
                  value={confirmPassword}
                  onChange={(value) => {
                    setConfirmPassword(value)
                    if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                  }}
                  placeholder="Repite la nueva contraseña"
                  disabled={isBusy}
                  invalid={Boolean(fieldErrors.confirmPassword)}
                  describedBy={fieldErrors.confirmPassword ? CONFIRM_ERROR_ID : undefined}
                />
                {fieldErrors.confirmPassword && (
                  <p id={CONFIRM_ERROR_ID} className="password-field-error">
                    {fieldErrors.confirmPassword}
                  </p>
                )}

                <button className="primary-button password-change-submit" type="submit" disabled={isBusy}>
                  {isSubmitting ? (
                    <>
                      <span className="password-change-spinner is-small" aria-hidden="true" />
                      Guardando contraseña...
                    </>
                  ) : (
                    <>
                      <AppIcon name="save" size={18} aria-hidden="true" />
                      Guardar y continuar
                    </>
                  )}
                </button>

                <button
                  className="password-change-signout"
                  type="button"
                  onClick={handleSignOut}
                  disabled={isBusy}
                >
                  <AppIcon name="logout" size={16} aria-hidden="true" />
                  {isSigningOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
                </button>
              </form>
            </>
          )}

        </div>
        <div className="password-change-footer">
          <Footer isDark={false} />
        </div>
      </section>
    </main>
  )
}
