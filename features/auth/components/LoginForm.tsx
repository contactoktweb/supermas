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
  const { signIn, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

      {/* Panel del formulario de inicio de sesión */}
      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand">
            <div className="brand">
              <img src="/super-mas-logo.svg" alt="Super Más" />
              <span>ERP / POS</span>
            </div>
          </div>

          <div className="login-heading">
            <span className="status-dot">● Conexión Segura</span>
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

            <div style={{ marginBottom: '18px' }}>
              <label htmlFor="auth-password" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>
                Contraseña
              </label>
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
