/**
 * POST /api/dian/invoices/:id/send — Genera/firma/transmite (o reintenta) una factura ya numerada.
 * Sirve para facturas y notas. Permiso: invoices.create (facturas), invoices.cancel (notas) o dian.manage.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireServerUser, requireAnyPermission } from '@/lib/auth/server-auth'
import { DianOrchestratorService } from '@/features/invoices/services/dian/dian-orchestrator.service'
import { assertInvoiceVisible, dianErrorResponse, isUuid } from '../../../_shared'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await Promise.resolve(ctx.params)
    if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Id inválido.' }, { status: 400 })
    const user = await requireServerUser(req)
    await assertInvoiceVisible(user, id)
    const { data: doc } = await user.userClient.from('electronic_invoices').select('document_type').eq('id', id).maybeSingle()
    const isNote = doc?.document_type === 'CREDIT_NOTE' || doc?.document_type === 'DEBIT_NOTE'
    await requireAnyPermission(user, isNote ? ['invoices.cancel', 'dian.manage'] : ['invoices.create', 'dian.manage'])
    const result = await new DianOrchestratorService().process({ userId: user.userId, companyId: user.companyId }, id)
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    return dianErrorResponse(e)
  }
}
