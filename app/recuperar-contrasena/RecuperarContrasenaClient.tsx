'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase/client'
import { authService } from '@/features/auth/services/auth.service'
import { AppIcon } from '@/components/ui/Icon'

export function RecuperarContrasenaClient() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [hasValidSession, setHasValidSession] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function checkRecoverySession() {
      try {
        // 1. Escuchar eventos de autenticación (evento PASSWORD_RECOVERY de Supabase)
        const { data: authListener } = supabaseClient.auth.onAuthStateChange(
          async (event, session) => {
            if (!isMounted) return
            if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
              setHasValidSession(true)
              setIsVerifying(false)
            }
          }
        )

        // 2. Verificar si ya existe una sesión en el cliente o tokens en el hash
        const { data: sessionData } = await supabaseClient.auth.getSession()
        if (sessionData?.session) {
          if (isMounted) {
            setHasValidSession(true)
            setIsVerifying(false)
          }
        } else {
          // Si hay hash en la URL con access_token de recovery, Supabase lo procesará
          if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
            // Dar tiempo breve al cliente de Supabase para parsear el hash
            setTimeout(async () => {
              if (!isMounted) return
              const { data: rechecked } = await supabaseClient.auth.getSession()
              if (rechecked?.session) {
                setHasValidSession(true)
              } else {
                setHasValidSession(false)
              }
              setIsVerifying(false)
            }, 600)
          } else {
            // No hay sesión ni tokens en el hash
            if (isMounted) {
              setHasValidSession(false)
              setIsVerifying(false)
            }
          }
        }

        return () => {
          authListener?.subscription?.unsubscribe()
        }
      } catch (err: any) {
        if (isMounted) {
          setHasValidSession(false)
          setIsVerifying(false)
        }
      }
    }

    checkRecoverySession()

    return () => {
      isMounted = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!password) {
      setErrorMessage('Por favor ingrese una nueva contraseña.')
      return
    }

    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener un mínimo de 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden. Verifique e intente de nuevo.')
      return
    }

    setIsSubmitting(true)
    try {
      await authService.updatePassword(password)
      // Cerrar sesión fiduciaria para forzar login limpio con las nuevas credenciales
      try {
        await supabaseClient.auth.signOut()
      } catch (_) {}

      setIsSuccess(true)
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          'No fue posible actualizar la contraseña. El enlace puede haber expirado.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isVerifying) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#001b5c',
          color: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255, 255, 255, 0.2)',
            borderTopColor: '#ffffff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{ fontSize: '14px', letterSpacing: '0.5px' }}>
          Validando enlace de recuperación fiduciario...
        </span>
      </div>
    )
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
          <p className="eyebrow">Seguridad y Recuperación</p>
          <h1>
            Protección de acceso
            <br />
            <em>y control fiduciario.</em>
          </h1>
          <p className="visual-description">
            Actualiza tus credenciales de forma segura mediante el protocolo de autenticación
            fiduciaria con token cifrado y vencimiento temporal.
          </p>
          <div className="visual-metrics">
            <div>
              <strong>Seguro</strong>
              <span>Cifrado bcrypt / JWT</span>
            </div>
            <div>
              <strong>Auditable</strong>
              <span>Trazabilidad completa</span>
            </div>
          </div>
        </div>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
      </section>

      {/* Panel del formulario */}
      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand">
            <div className="brand">
              <img src="/super-mas-logo.svg" alt="Super Más" />
              <span>ERP / POS</span>
            </div>
          </div>

          {isSuccess ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px auto',
                }}
              >
                <AppIcon name="check" size={32} color="#059669" />
              </div>

              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: 'var(--navy)',
                  marginBottom: '10px',
                }}
              >
                ¡Contraseña Actualizada!
              </h2>

              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--muted)',
                  lineHeight: '1.6',
                  marginBottom: '28px',
                }}
              >
                Tu contraseña ha sido modificada con éxito en el sistema fiduciario. Ahora puedes
                iniciar sesión con tus nuevas credenciales.
              </p>

              <button
                className="primary-button"
                type="button"
                onClick={() => router.push('/login')}
                style={{
                  width: '100%',
                  height: '46px',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                Ir al Inicio de Sesión
              </button>
            </div>
          ) : !hasValidSession ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px auto',
                }}
              >
                <AppIcon name="warning" size={32} color="#dc2626" />
              </div>

              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--navy)',
                  marginBottom: '10px',
                }}
              >
                Enlace Expirado o Inválido
              </h2>

              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--muted)',
                  lineHeight: '1.6',
                  marginBottom: '24px',
                }}
              >
                El enlace de recuperación no es válido o ha caducado por motivos de seguridad. Por
                favor solicita un nuevo enlace desde la pantalla de acceso.
              </p>

              <button
                className="primary-button"
                type="button"
                onClick={() => router.push('/login')}
                style={{
                  width: '100%',
                  height: '46px',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                Volver a Iniciar Sesión
              </button>
            </div>
          ) : (
            <>
              <div className="login-heading">
                <div className="login-status-pill">
                  <span className="login-status-indicator" />
                  <span>Sesión de Recuperación Activa</span>
                </div>
                <h2>Nueva Contraseña</h2>
                <p>Establece tus nuevas credenciales de acceso para el ERP/POS</p>
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
                  <label
                    htmlFor="reset-password"
                    style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--navy)',
                    }}
                  >
                    Nueva Contraseña
                  </label>
                  <div
                    className="input-wrap"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      position: 'relative',
                    }}
                  >
                    <AppIcon name="lock" size={18} />
                    <input
                      id="reset-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      autoComplete="new-password"
                      disabled={isSubmitting}
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

                <div style={{ marginBottom: '18px' }}>
                  <label
                    htmlFor="reset-confirm-password"
                    style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--navy)',
                    }}
                  >
                    Confirmar Nueva Contraseña
                  </label>
                  <div
                    className="input-wrap"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      position: 'relative',
                    }}
                  >
                    <AppIcon name="lock" size={18} />
                    <input
                      id="reset-confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite la contraseña"
                      required
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      style={{ width: '100%', paddingRight: '36px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Ocultar contraseña' : 'Ver contraseña'}
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
                      <AppIcon name={showConfirm ? 'eyeOff' : 'eye'} size={18} />
                    </button>
                  </div>
                </div>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    height: '46px',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <span
                        className="spinner"
                        style={{
                          display: 'inline-block',
                          width: '14px',
                          height: '14px',
                          border: '2px solid #fff',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                      Guardando nueva contraseña...
                    </>
                  ) : (
                    'Guardar Contraseña'
                  )}
                </button>

                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    disabled={isSubmitting}
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
                    ← Cancelar y volver al inicio
                  </button>
                </div>
              </form>
            </>
          )}

          <div
            style={{
              marginTop: '28px',
              paddingTop: '16px',
              borderTop: '1px solid var(--line)',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--muted)',
            }}
          >
            Distribuidora Super Más S.A.S. — Acceso administrativo seguro
          </div>
        </div>
      </section>
    </main>
  )
}
