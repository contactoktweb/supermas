/**
 * POST /api/auth/cambiar-contrasena — Cambio obligatorio de la contraseña inicial.
 *
 * Solo aplica a cuentas con `app_metadata.must_change_password === true` (creadas por un
 * administrador). Flujo:
 *   1. Sesión verificada contra Supabase Auth (se permite la bandera pendiente solo aquí).
 *   2. Política de contraseña validada con Zod en el servidor.
 *   3. La contraseña se cambia COMO el usuario (ver lib/auth/own-password).
 *   4. Se quita la bandera de app_metadata con service role, se registra auditoría y se avisa por correo.
 * El cliente debe refrescar la sesión después para obtener un JWT sin la bandera.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AuthError, requireServerUser, ServerUser } from '@/lib/auth/server-auth'
import { createAttemptLimiter } from '@/lib/auth/attempt-limiter'
import { MUST_CHANGE_PASSWORD_KEY } from '@/lib/auth/password-change-flag'
import { changePasswordSchema } from '@/features/auth/schemas/password-policy.schema'
import { updateOwnPassword } from '@/lib/auth/own-password'
import { sendPasswordChangedEmail } from '@/features/auth/services/account-email.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AUDIT_ACTION = 'PASSWORD_CHANGED_FIRST_LOGIN'
const AUDIT_MODULE = 'USERS'
const MAX_ATTEMPTS_PER_WINDOW = 5
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000

const changeAttempts = createAttemptLimiter({ maxAttempts: MAX_ATTEMPTS_PER_WINDOW, windowMs: ATTEMPT_WINDOW_MS })

type JsonBody = { success: boolean; error?: string; code?: string }

function jsonError(error: string, status: number, code?: string) {
  return NextResponse.json<JsonBody>({ success: false, error, ...(code ? { code } : {}) }, { status })
}

export async function POST(request: NextRequest) {
  let user: ServerUser
  try {
    user = await requireServerUser(request, { allowPendingPasswordChange: true })
  } catch (e) {
    if (e instanceof AuthError) return jsonError(e.message, e.status, e.code)
    console.error('[cambiar-contrasena] Error validando la sesión:', e instanceof Error ? e.message : e)
    return jsonError('No fue posible validar la sesión.', 500)
  }

  if (!user.mustChangePassword) {
    return jsonError('Su cuenta no tiene un cambio de contraseña pendiente.', 409)
  }

  const retryAfterSeconds = changeAttempts.consume(user.userId)
  if (retryAfterSeconds > 0) {
    return NextResponse.json<JsonBody>(
      { success: false, error: 'Demasiados intentos. Espere unos minutos e intente de nuevo.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = changePasswordSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || 'Datos de contraseña inválidos.', 400)
  }

  const admin = createAdminClient()

  // Copia de los campos que el trigger de auth.users (016) resincroniza desde los metadatos.
  // Si la migración 063 aún no está aplicada, quitar la bandera dispararía ese trigger.
  const { data: profileBefore } = await admin
    .from('users')
    .select('role_id, full_name')
    .eq('id', user.userId)
    .maybeSingle()

  const updateError = await updateOwnPassword(user, parsed.data.newPassword)
  if (updateError) return jsonError(updateError.message, updateError.status)

  const { error: flagError } = await admin.auth.admin.updateUserById(user.userId, {
    app_metadata: { [MUST_CHANGE_PASSWORD_KEY]: false },
  })
  if (flagError) {
    console.error('[cambiar-contrasena] La contraseña cambió pero no se pudo liberar la cuenta:', flagError.message)
    return jsonError(
      'Su contraseña fue actualizada, pero no se pudo completar la activación de la cuenta. Intente de nuevo con otra contraseña o contacte al administrador.',
      500
    )
  }

  if (profileBefore) {
    const { data: profileAfter } = await admin
      .from('users')
      .select('role_id, full_name')
      .eq('id', user.userId)
      .maybeSingle()
    if (
      profileAfter &&
      (profileAfter.role_id !== profileBefore.role_id || profileAfter.full_name !== profileBefore.full_name)
    ) {
      await admin
        .from('users')
        .update({ role_id: profileBefore.role_id, full_name: profileBefore.full_name })
        .eq('id', user.userId)
    }
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
  const { error: auditError } = await admin.from('audit_logs').insert({
    user_id: user.userId,
    user_name: user.fullName || user.email,
    action: AUDIT_ACTION,
    module: AUDIT_MODULE,
    entity_name: 'users',
    entity_id: user.userId,
    company_id: user.companyId,
    previous_value: { [MUST_CHANGE_PASSWORD_KEY]: true },
    new_value: { [MUST_CHANGE_PASSWORD_KEY]: false, details: 'Cambio de contraseña inicial en el primer ingreso.' },
    ip_address: ip,
  })
  if (auditError) {
    console.error('[cambiar-contrasena] No se pudo registrar la auditoría:', auditError.message)
  }

  await sendPasswordChangedEmail({ to: user.email, userName: user.fullName, companyId: user.companyId, ip })

  changeAttempts.reset(user.userId)
  return NextResponse.json<JsonBody>({ success: true })
}
