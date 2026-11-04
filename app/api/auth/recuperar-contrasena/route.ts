/**
 * POST /api/auth/recuperar-contrasena — Envía el enlace para crear una nueva contraseña.
 *
 * El enlace se genera con la Admin API de Supabase (no envía correo por sí misma) y se entrega
 * con Resend usando la plantilla de la empresa. La respuesta es siempre la misma exista o no el
 * correo, para no revelar qué cuentas hay registradas. Solo se envía a usuarios activos.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAttemptLimiter } from '@/lib/auth/attempt-limiter'
import { getAppBaseUrl, sendPasswordRecoveryEmail } from '@/features/auth/services/account-email.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const ipAttempts = createAttemptLimiter({ maxAttempts: 10, windowMs: ATTEMPT_WINDOW_MS })
const emailAttempts = createAttemptLimiter({ maxAttempts: 3, windowMs: ATTEMPT_WINDOW_MS })

const RequestSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) })

type JsonBody = { success: boolean; error?: string }

const genericOk = () => NextResponse.json<JsonBody>({ success: true })

function tooManyAttempts(retryAfterSeconds: number) {
  return NextResponse.json<JsonBody>(
    { success: false, error: 'Demasiadas solicitudes. Espere unos minutos e intente de nuevo.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  )
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'desconocida'
  const ipWait = ipAttempts.consume(ip)
  if (ipWait > 0) return tooManyAttempts(ipWait)

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json<JsonBody>({ success: false, error: 'Ingrese un correo electrónico válido.' }, { status: 400 })
  }
  const { email } = parsed.data

  const emailWait = emailAttempts.consume(email)
  if (emailWait > 0) return tooManyAttempts(emailWait)

  try {
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('users')
      .select('id, full_name, company_id, is_active')
      .eq('email', email)
      .maybeSingle()
    if (!profile?.is_active) return genericOk()

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: 'recovery', email })
    const tokenHash = linkData?.properties?.hashed_token
    if (linkError || !tokenHash) {
      console.error('[recuperar-contrasena] No se pudo generar el enlace:', linkError?.message)
      return genericOk()
    }

    const link = `${getAppBaseUrl()}/recuperar-contrasena?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
    await sendPasswordRecoveryEmail({
      to: email,
      userName: profile.full_name || email,
      companyId: profile.company_id,
      link,
    })
  } catch (e) {
    console.error('[recuperar-contrasena] Error inesperado:', e instanceof Error ? e.message : e)
  }

  return genericOk()
}
