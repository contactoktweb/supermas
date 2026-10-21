import { isIP } from 'node:net'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireServerUser, AuthError } from '@/lib/auth/server-auth'

// Formato 8-4-4-4-12 sin exigir versión/variante RFC: los datos sembrados usan ids fijos.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuidSchema = z.string().regex(UUID_PATTERN)

/**
 * Solo se aceptan los datos descriptivos del evento. Empresa, usuario, nombre, IP y fecha
 * los fija el servidor: cualquier valor enviado por el navegador para esos campos se descarta.
 */
const auditEventSchema = z.object({
  id: uuidSchema.optional(),
  action: z.string().trim().min(1).max(50).optional(),
  module: z.string().trim().min(1).max(50).optional(),
  entity_name: z.string().trim().min(1).max(50).optional(),
  entity_id: z.union([z.string().trim().min(1).max(100), z.number()]).optional(),
  location_id: uuidSchema.nullish(),
  previous_value: z.unknown().optional(),
  new_value: z.unknown().optional(),
  details: z.string().max(2000).optional(),
})

/**
 * IP del cliente según el proxy de despliegue: x-real-ip, o el último salto de
 * x-forwarded-for (el que agrega el proxy; los anteriores los puede inventar el cliente).
 * Si no hay un valor IP válido se registra null.
 */
function getClientIp(request: NextRequest): string | null {
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp && isIP(realIp)) return realIp

  const forwardedHops = request.headers.get('x-forwarded-for')?.split(',') ?? []
  const lastHop = forwardedHops[forwardedHops.length - 1]?.trim()
  if (lastHop && isIP(lastHop)) return lastHop

  return null
}

async function resolveCompanyLocationId(companyId: string, locationId?: string | null): Promise<string | null> {
  if (!locationId) return null
  const { data, error } = await supabaseAdmin
    .from('locations')
    .select('id')
    .eq('id', locationId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (error || !data) return null
  return locationId
}

export async function POST(request: NextRequest) {
  let caller
  try {
    caller = await requireServerUser(request)
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status })
    }
    console.error('[api/audit] Error verificando la sesión:', e)
    return NextResponse.json({ success: false, error: 'No fue posible registrar el evento.' }, { status: 500 })
  }

  const parsed = auditEventSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Datos de auditoría inválidos.' }, { status: 400 })
  }

  try {
    const event = parsed.data
    const id = event.id ?? crypto.randomUUID()

    const rowToInsert = {
      id,
      company_id: caller.companyId,
      user_id: caller.userId,
      user_name: caller.fullName,
      action: event.action ?? 'GENERIC_ACTION',
      module: event.module ?? 'SYSTEM',
      entity_name: event.entity_name ?? 'audit_logs',
      entity_id: String(event.entity_id ?? id),
      location_id: await resolveCompanyLocationId(caller.companyId, event.location_id),
      previous_value: event.previous_value ?? null,
      new_value: event.new_value ?? { details: event.details ?? '' },
      ip_address: getClientIp(request),
    }

    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .insert(rowToInsert)
      .select()
      .maybeSingle()

    if (error) {
      console.error('[api/audit] Error insertando el evento de auditoría:', error.message)
      return NextResponse.json({ success: false, error: 'No fue posible registrar el evento.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || rowToInsert })
  } catch (err) {
    console.error('[api/audit] Excepción registrando el evento de auditoría:', err)
    return NextResponse.json({ success: false, error: 'No fue posible registrar el evento.' }, { status: 500 })
  }
}
