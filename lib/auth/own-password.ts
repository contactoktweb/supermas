/**
 * Cambio de la contraseña propia COMO el usuario (PUT /auth/v1/user con su JWT).
 * Supabase rechaza una contraseña igual a la actual y conserva la sesión en curso
 * (el admin API cerraría todas las sesiones y el cliente no podría refrescar el token).
 */
import type { ServerUser } from '@/lib/auth/server-auth'

/** Mensajes de Supabase Auth traducidos; nunca se reenvía el texto crudo del proveedor. */
function mapAuthUpdateError(errorCode: string | undefined, status: number): { message: string; status: number } {
  switch (errorCode) {
    case 'same_password':
      return { message: 'La nueva contraseña debe ser diferente de la contraseña actual.', status: 422 }
    case 'weak_password':
      return { message: 'La contraseña no cumple la política de seguridad. Elija una más robusta.', status: 422 }
    case 'reauthentication_needed':
    case 'session_not_found':
    case 'bad_jwt':
      return { message: 'Su sesión ya no es válida. Cierre sesión e ingrese de nuevo para continuar.', status: 401 }
    case 'over_request_rate_limit':
      return { message: 'Demasiados intentos. Espere unos minutos e intente de nuevo.', status: 429 }
    default:
      return {
        message: 'No fue posible actualizar la contraseña. Intente de nuevo en unos momentos.',
        status: status >= 500 ? 502 : 400,
      }
  }
}

/** Devuelve null si se cambió, o el mensaje y estado HTTP a responder. */
export async function updateOwnPassword(user: ServerUser, newPassword: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${user.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: newPassword }),
    cache: 'no-store',
  })
  if (response.ok) return null

  const payload = (await response.json().catch(() => null)) as { error_code?: string; code?: string | number } | null
  const errorCode = payload?.error_code || (typeof payload?.code === 'string' ? payload.code : undefined)
  return mapAuthUpdateError(errorCode, response.status)
}
