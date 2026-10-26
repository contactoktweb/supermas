/**
 * POST /api/dian/invoices/:id/email — Envía (o reenvía) al cliente por correo un documento aceptado por la DIAN:
 * AttachedDocument (XML) + representación gráfica (PDF). Body opcional: { to?: string } para otro destinatario.
 * Permiso: invoices.create o dian.manage.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireServerUser, requireAnyPermission } from '@/lib/auth/server-auth'
import { InvoiceDeliveryService } from '@/features/invoices/services/delivery/invoice-delivery.service'
import { assertInvoiceVisible, dianErrorResponse, isUuid } from '../../../_shared'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await Promise.resolve(ctx.params)
    if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Id inválido.' }, { status: 400 })
    const user = await requireServerUser(req)
    await requireAnyPermission(user, ['invoices.create', 'dian.manage'])
    await assertInvoiceVisible(user, id)

    const body = await req.json().catch(() => ({}))
    const to = typeof body?.to === 'string' ? body.to.slice(0, 254) : null
    const result = await new InvoiceDeliveryService().deliver({ userId: user.userId, companyId: user.companyId }, id, 'MANUAL', to)
    const ok = result.outcome === 'SENT'
    return NextResponse.json({ success: ok, data: result, ...(ok ? {} : { error: result.message }) }, { status: ok ? 200 : 422 })
  } catch (e) {
    return dianErrorResponse(e)
  }
}
