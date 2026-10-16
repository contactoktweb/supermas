import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUUID(id?: string | null): boolean {
  if (!id) return false
  return UUID_REGEX.test(id)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 1. Resolver company_id si no viene especificado
    let companyId = body.company_id || body.companyId
    if (!companyId || !isValidUUID(companyId)) {
      const { data: comp } = await supabaseAdmin
        .from('companies')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      companyId = comp?.id
    }

    const id = isValidUUID(body.id) ? body.id : crypto.randomUUID()
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      body.ip_address ||
      body.ipAddress ||
      '127.0.0.1'

    const rowToInsert = {
      id,
      user_id: isValidUUID(body.user_id || body.userId) ? (body.user_id || body.userId) : null,
      user_name: body.user_name || body.userName || 'Sistema',
      action: body.action || 'GENERIC_ACTION',
      module: body.module || 'SYSTEM',
      entity_name: body.entity_name || body.entityType || 'audit_logs',
      entity_id: String(body.entity_id || body.entityId || id),
      location_id: isValidUUID(body.location_id || body.locationId) ? (body.location_id || body.locationId) : null,
      company_id: companyId,
      previous_value: body.previous_value || null,
      new_value: body.new_value || { details: body.details || '' },
      ip_address: ip,
      created_at: body.created_at || new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .insert(rowToInsert)
      .select()
      .maybeSingle()

    if (error) {
      console.error('❌ Error insertando audit_log vía API con supabaseAdmin:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || rowToInsert })
  } catch (err: any) {
    console.error('❌ Excepción en endpoint POST /api/audit:', err)
    return NextResponse.json({ success: false, error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}
