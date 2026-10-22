/**
 * POST /api/dian/invoices/:id/status — Consulta en la DIAN el resultado de un envío (GetStatusZip).
 * Permiso: invoices.read.
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
    await requireAnyPermission(user, ['invoices.read', 'dian.manage'])
    await assertInvoiceVisible(user, id)
    const result = await new DianOrchestratorService().checkStatus({ userId: user.userId, companyId: user.companyId }, id)
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    return dianErrorResponse(e)
  }
}
