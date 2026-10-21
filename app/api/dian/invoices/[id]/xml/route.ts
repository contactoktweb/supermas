/**
 * GET /api/dian/invoices/:id/xml?kind=signed|unsigned|response — Descarga el XML de la factura.
 * Permiso: invoices.read. Solo facturas de la empresa del usuario.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireServerUser, requireAnyPermission } from '@/lib/auth/server-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertInvoiceVisible, dianErrorResponse, isUuid } from '../../../_shared'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await Promise.resolve(ctx.params)
    if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Id inválido.' }, { status: 400 })
    const user = await requireServerUser(req)
    await requireAnyPermission(user, ['invoices.read', 'dian.manage'])
    await assertInvoiceVisible(user, id)

    const kind = new URL(req.url).searchParams.get('kind') || 'signed'
    const { data } = await createAdminClient()
      .from('electronic_invoices')
      .select('prefix, number, xml_file_name, xml_signed, xml_unsigned, application_response_xml')
      .eq('id', id)
      .eq('company_id', user.companyId)
      .maybeSingle()
    if (!data) return NextResponse.json({ success: false, error: 'Factura no encontrada.' }, { status: 404 })

    const xml = kind === 'response' ? data.application_response_xml : kind === 'unsigned' ? data.xml_unsigned : data.xml_signed || data.xml_unsigned
    if (!xml) return NextResponse.json({ success: false, error: 'La factura aún no tiene XML generado.' }, { status: 404 })

    const base = data.xml_file_name ? data.xml_file_name.replace(/\.xml$/, '') : `${data.prefix}${data.number}`
    const suffix = kind === 'response' ? '-respuesta-dian' : kind === 'unsigned' || !data.xml_signed ? '-sin-firma' : ''
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${base}${suffix}.xml"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return dianErrorResponse(e)
  }
}
