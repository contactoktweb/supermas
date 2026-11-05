/**
 * POST /api/public/customer-registration — Datos de facturación electrónica que el cliente
 * diligencia al escanear el QR del punto de venta. Es público: valida todo en el servidor,
 * limita intentos por IP y por documento, descarta envíos automáticos (campo trampa) y
 * responde igual exista o no el cliente, para no revelar quién está registrado.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAttemptLimiter } from '@/lib/auth/attempt-limiter'
import { selfRegistrationSchema } from '@/features/customer-self-registration/schemas/self-registration.schema'
import {
  registerCustomerFromQr,
  SelfRegistrationError,
} from '@/features/customer-self-registration/services/self-registration.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const MAX_BODY_BYTES = 8 * 1024
const ipAttempts = createAttemptLimiter({ maxAttempts: 8, windowMs: ATTEMPT_WINDOW_MS })
const documentAttempts = createAttemptLimiter({ maxAttempts: 3, windowMs: ATTEMPT_WINDOW_MS })

type JsonBody = { success: boolean; error?: string }

function json(body: JsonBody, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json<JsonBody>(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

function tooManyAttempts(retryAfterSeconds: number) {
  return json(
    { success: false, error: 'Demasiados envíos. Espera unos minutos e intenta de nuevo.' },
    429,
    { 'Retry-After': String(retryAfterSeconds) }
  )
}

/** Solo se aceptan envíos desde el formulario de este mismo sitio. */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  return Boolean(origin) && origin === request.nextUrl.origin
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ success: false, error: 'Solicitud no permitida.' }, 403)

  const ip = request.headers.get('x-real-ip')?.trim() || request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'desconocida'
  const ipWait = ipAttempts.consume(ip)
  if (ipWait > 0) return tooManyAttempts(ipWait)

  const raw = await request.text().catch(() => '')
  if (!raw || raw.length > MAX_BODY_BYTES) return json({ success: false, error: 'Datos inválidos.' }, 400)

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ success: false, error: 'Datos inválidos.' }, 400)
  }

  const parsed = selfRegistrationSchema.safeParse(body)
  if (!parsed.success) {
    // El campo trampa lleno indica un envío automático: se responde como si se hubiera guardado.
    const isBot = typeof (body as { website?: unknown })?.website === 'string' && (body as { website: string }).website.length > 0
    if (isBot) return json({ success: true })
    return json({ success: false, error: parsed.error.issues[0]?.message || 'Revisa los datos del formulario.' }, 400)
  }

  const documentWait = documentAttempts.consume(parsed.data.documentNumber)
  if (documentWait > 0) return tooManyAttempts(documentWait)

  try {
    await registerCustomerFromQr(parsed.data)
    return json({ success: true })
  } catch (error) {
    if (error instanceof SelfRegistrationError) {
      return json({ success: false, error: error.message }, error.status)
    }
    console.error('[registro-cliente] Error inesperado:', error instanceof Error ? error.message : String(error))
    return json({ success: false, error: 'No se pudieron guardar los datos. Intenta de nuevo.' }, 500)
  }
}
