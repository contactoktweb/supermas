/**
 * POST /api/auth/restablecer-contrasena — Guarda la nueva contraseña tras abrir el enlace de recuperación.
 *
 * La sesión viene del enlace (verifyOtp de tipo recovery). La política se valida en el servidor,
 * se libera la bandera de cambio obligatorio si estaba pendiente (la persona ya eligió su propia
 * contraseña), se registra auditoría y se avisa al correo de la cuenta.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AuthError, requireServerUser, ServerUser } from '@/lib/auth/server-auth'
import { createAttemptLimiter } from '@/lib/auth/attempt-limiter'
import { MUST_CHANGE_PASSWORD_KEY } from '@/lib/auth/password-change-flag'
import { updateOwnPassword } from '@/lib/auth/own-password'
import { changePasswordSchema } from '@/features/auth/schemas/password-policy.schema'
import { sendPasswordChangedEmail } from '@/features/auth/services/account-email.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const resetAttempts = createAttemptLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 })

type JsonBody = { success: boolean; error?: string }

function jsonError(error: string, status: number) {
  return NextResponse.json<JsonBody>({ success: false, error }, { status })
}

export async function POST(request: NextRequest) {
  let user: ServerUser
  try {
    user = await requireServerUser(request, { allowPendingPasswordChange: true })
  } catch (e) {
    if (e instanceof AuthError) return jsonError('El enlace de recuperación expiró o ya se usó. Solicite uno nuevo.', 401)
    console.error('[restablecer-contrasena] Error validando la sesión:', e instanceof Error ? e.message : e)
    return jsonError('No fue posible validar el enlace de recuperación.', 500)
  }

  const retryAfterSeconds = resetAttempts.consume(user.userId)
  if (retryAfterSeconds > 0) {
    return NextResponse.json<JsonBody>(
      { success: false, error: 'Demasiados intentos. Espere unos minutos e intente de nuevo.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    )
  }

  const parsed = changePasswordSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || 'Datos de contraseña inválidos.', 400)
  }

  const updateError = await updateOwnPassword(user, parsed.data.newPassword)
  if (updateError) return jsonError(updateError.message, updateError.status)

  const admin = createAdminClient()
  if (user.mustChangePassword) {
    const { error: flagError } = await admin.auth.admin.updateUserById(user.userId, {
      app_metadata: { [MUST_CHANGE_PASSWORD_KEY]: false },
    })
    if (flagError) console.error('[restablecer-contrasena] No se pudo liberar la bandera de cambio:', flagError.message)
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
  const { error: auditError } = await admin.from('audit_logs').insert({
    user_id: user.userId,
    user_name: user.fullName || user.email,
    action: 'PASSWORD_RESET',
    module: 'USERS',
    entity_name: 'users',
    entity_id: user.userId,
    company_id: user.companyId,
    new_value: { details: 'Contraseña restablecida con el enlace de recuperación enviado al correo.' },
    ip_address: ip,
  })
  if (auditError) console.error('[restablecer-contrasena] No se pudo registrar la auditoría:', auditError.message)

  await sendPasswordChangedEmail({ to: user.email, userName: user.fullName, companyId: user.companyId, ip })

  resetAttempts.reset(user.userId)
  return NextResponse.json<JsonBody>({ success: true })
}
