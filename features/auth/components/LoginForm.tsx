'use client'

/**
 * SUPER MÁS ERP/POS - Componente de Inicio de Sesión Fiduciario
 *
 * Conecta exclusivamente con Supabase Auth real.
 * No incluye botones de bypass, usuarios simulados ni atajos ficticios.
 */

import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { AppIcon } from '@/components/ui/Icon'

interface LoginFormProps {
  onSuccess?: () => void
  redirectTo?: string
}

export function LoginForm({ onSuccess, redirectTo }: LoginFormProps) {
  const { signIn, requestPasswordReset, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Estados para recuperación de contraseña
  const [authMode, setAuthMode] = useState<'LOGIN' | 'FORGOT' | 'FORGOT_SENT'>('LOGIN')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [forgotSubmitting, setForgotSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim() || !password) {
      setErrorMessage('Por favor ingrese su correo electrónico y contraseña.')
      return
    }

    setIsSubmitting(true)
    try {
      await signIn({ email: email.trim(), password })
      if (onSuccess) {
        onSuccess()
      } else if (typeof window !== 'undefined') {
        const dest = redirectTo || '/'
        window.location.href = dest
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al autenticar credenciales.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError(null)

    const targetEmail = forgotEmail.trim().toLowerCase()
    if (!targetEmail || !targetEmail.includes('@')) {
      setForgotError('Por favor ingrese un correo electrónico válido.')
      return
    }

    setForgotSubmitting(true)
    try {
      await requestPasswordReset(targetEmail)
      setAuthMode('FORGOT_SENT')
    } catch (err: any) {
      setForgotError(err?.message || 'Error al procesar la solicitud de restablecimiento.')
    } finally {
      setForgotSubmitting(false)
    }
  }

  const switchToForgot = () => {
    setForgotEmail(email.trim())
    setForgotError(null)
    setAuthMode('FORGOT')
  }

  const switchToLogin = () => {
    setErrorMessage(null)
    setAuthMode('LOGIN')
  }

  return (
    <main className="login-shell">
      {/* Sección visual izquierda */}
      <section className="login-visual">
        <div className="visual-grid" />
        <div className="visual-copy">
          <div className="brand">
            <img src="/super-mas-logo.svg" alt="Super Más" />
            <span>ERP / POS</span>
          </div>
          <p className="eyebrow">Sistema de Administración General</p>
          <h1>
            Toda la operación de Super Más,
            <br />
            <em>en un solo lugar.</em>
          </h1>
          <p className="visual-description">
            Plataforma centralizada de gestión fiduciaria para bodegas, catálogo,
            compras, inventario, ventas, caja, contabilidad y auditoría.
          </p>
          <div className="visual-metrics">
            <div>
              <strong>Multi-sede</strong>
              <span>Operación en tiempo real</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>Seguridad RLS PostgreSQL</span>
            </div>
          </div>
        </div>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
      </section>

      {/* Panel del formulario de inicio de sesión o recuperación */}
      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand">
            <div className="brand">
              <img src="/super-mas-logo.svg" alt="Super Más" />
              <span>ERP / POS</span>
            </div>
          </div>

          {authMode === 'LOGIN' && (
            <>
              <div className="login-heading">
                <div className="login-status-pill">
                  <span className="login-status-indicator" />
                  <span>Conexión Fiduciaria Segura</span>
                </div>
                <h2>Bienvenido</h2>
                <p>Ingresa tus credenciales fiduciarias para acceder al sistema</p>
              </div>

              {errorMessage && (
                <div
                  className="login-error-alert"
                  role="alert"
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #f87171',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    color: '#991b1b',
                    fontSize: '13px',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AppIcon name="warning" size={18} color="#dc2626" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="auth-email" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>
                    Correo electrónico
                  </label>
                  <div className="input-wrap" style={{ display: 'flex', alignItems: 'center' }}>
                    <AppIcon name="mail" size={18} />
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="usuario@supermas.com.co"
                      required
                      autoComplete="email"
                      disabled={isSubmitting || isLoading}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label htmlFor="auth-password" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>
                      Contraseña
                    </label>
                    <button
                      type="button"
                      onClick={switchToForgot}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary, #0047ba)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="input-wrap" style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <AppIcon name="lock" size={18} />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      autoComplete="current-password"
                      disabled={isSubmitting || isLoading}
                      style={{ width: '100%', paddingRight: '36px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--muted)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <AppIcon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                    </button>
                  </div>
                </div>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    height: '44px',
                    fontSize: '14px',
                    fontWeight: 700,
                    marginTop: '18px',
                  }}
                >
                  {isSubmitting || isLoading ? (
                    <>
                      <span className="spinner" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Verificando credenciales...
                    </>
                  ) : (
                    <>
                      Ingresar al sistema <AppIcon name="chevronRight" size={15} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {authMode === 'FORGOT' && (
            <>
              <div className="login-heading">
                <div className="login-status-pill">
                  <span className="login-status-indicator" />
                  <span>Recuperación de Contraseña</span>
                </div>
                <h2>Restablecer Contraseña</h2>
                <p>Ingresa tu correo electrónico registrado para enviarte un enlace de recuperación</p>
              </div>

              {forgotError && (
                <div
                  className="login-error-alert"
                  role="alert"
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #f87171',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    color: '#991b1b',
                    fontSize: '13px',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AppIcon name="warning" size={18} color="#dc2626" />
                  <span>{forgotError}</span>
                </div>
              )}

              <form onSubmit={handleForgotPassword} noValidate>
                <div style={{ marginBottom: '18px' }}>
                  <label htmlFor="forgot-email" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>
                    Correo electrónico
                  </label>
                  <div className="input-wrap" style={{ display: 'flex', alignItems: 'center' }}>
                    <AppIcon name="mail" size={18} />
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="usuario@supermas.com.co"
                      required
                      autoComplete="email"
                      disabled={forgotSubmitting}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={forgotSubmitting}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    height: '44px',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  {forgotSubmitting ? (
                    <>
                      <span className="spinner" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Enviando enlace...
                    </>
                  ) : (
                    'Enviar enlace de recuperación'
                  )}
                </button>

                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={switchToLogin}
                    disabled={forgotSubmitting}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--muted)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    ← Volver al inicio de sesión
                  </button>
                </div>
              </form>
            </>
          )}

          {authMode === 'FORGOT_SENT' && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                }}
              >
                <AppIcon name="check" size={28} color="#059669" />
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
                ¡Enlace Enviado!
              </h2>

              <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.5', marginBottom: '20px' }}>
                Hemos enviado un correo a <strong style={{ color: 'var(--navy)' }}>{forgotEmail}</strong> con las instrucciones y el enlace para definir tu nueva contraseña.
              </p>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '12px',
                  color: '#64748b',
                  marginBottom: '24px',
                  textAlign: 'left',
                }}
              >
                ℹ️ Si no recibes el mensaje en unos minutos, revisa tu carpeta de correo no deseado (Spam) o solicita un nuevo enlace.
              </div>

              <button
                className="primary-button"
                type="button"
                onClick={switchToLogin}
                style={{
                  width: '100%',
                  height: '44px',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                Volver a Iniciar Sesión
              </button>
            </div>
          )}

          <div
            style={{
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid var(--line)',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--muted)',
            }}
          >
            Distribuidora Super Más S.A.S. — Acceso administrativo restringido
          </div>
        </div>
      </section>
    </main>
  )
}
