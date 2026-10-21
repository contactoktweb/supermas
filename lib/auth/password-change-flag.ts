/**
 * SUPER MÁS ERP/POS — Bandera de cambio obligatorio de contraseña
 *
 * Los usuarios creados por un administrador reciben `must_change_password: true` en
 * `auth.users.app_metadata`. Solo el servidor (service role) puede escribir app_metadata y el
 * valor viaja dentro del JWT, así el middleware puede redirigir sin consultar la base de datos.
 *
 * Este módulo no importa nada de Node ni de Supabase: se usa desde el middleware (Edge),
 * Route Handlers y componentes cliente.
 */

export const MUST_CHANGE_PASSWORD_KEY = 'must_change_password'

/** Pantalla donde el usuario fija su contraseña definitiva. */
export const CHANGE_PASSWORD_PATH = '/cambiar-contrasena'

/** API que aplica el cambio (excluida del bloqueo; valida la sesión por sí misma). */
export const CHANGE_PASSWORD_API_PATH = '/api/auth/cambiar-contrasena'

export const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED'

export const PASSWORD_CHANGE_REQUIRED_MESSAGE =
  'Debe cambiar su contraseña inicial antes de continuar usando el ERP.'

export function isPasswordChangeRequired(appMetadata: unknown): boolean {
  if (!appMetadata || typeof appMetadata !== 'object') return false
  return (appMetadata as Record<string, unknown>)[MUST_CHANGE_PASSWORD_KEY] === true
}

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * Lee los claims del JWT SIN verificar la firma. Solo sirve para decisiones de navegación
 * (redirigir o bloquear de forma restrictiva); la autorización real la hace
 * `requireServerUser`, que valida el token contra Supabase Auth.
 */
export function readUnverifiedJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null
  try {
    const claims = JSON.parse(decodeBase64Url(parts[1]))
    return claims && typeof claims === 'object' ? (claims as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * true si el JWT de la cookie de sesión indica que la contraseña inicial sigue pendiente.
 * Acepta el valor de la cookie tal cual (puede venir codificado con encodeURIComponent).
 */
export function tokenRequiresPasswordChange(cookieToken: string): boolean {
  let token = cookieToken
  try {
    token = decodeURIComponent(cookieToken)
  } catch {
    // Cookie mal formada: se analiza tal cual y, si no es un JWT, no hay bandera que leer.
  }
  const claims = readUnverifiedJwtClaims(token)
  return isPasswordChangeRequired(claims?.app_metadata)
}
