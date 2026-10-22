/**
 * POST /api/dian/invoices — Emite la factura electrónica de una venta (habilitación).
 * Body: { saleId: uuid, idempotencyKey: string }
 * Permiso: invoices.create (lo valida también la función SQL con el JWT del usuario).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireServerUser, requireAnyPermission } from '@/lib/auth/server-auth'
import { DianOrchestratorService } from '@/features/invoices/services/dian/dian-orchestrator.service'
import { dianErrorResponse, isUuid } from '../_shared'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await requireServerUser(req)
    await requireAnyPermission(user, ['invoices.create'])

    const body = await req.json().catch(() => ({}))
    const saleId = body?.saleId
    const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
    if (!isUuid(saleId)) return NextResponse.json({ success: false, error: 'saleId inválido.' }, { status: 400 })
    if (idempotencyKey.length < 8 || idempotencyKey.length > 120) {
      return NextResponse.json({ success: false, error: 'idempotencyKey inválida.' }, { status: 400 })
    }

    const orchestrator = new DianOrchestratorService()
    const result = await orchestrator.emitFromSale(user.userClient, { userId: user.userId, companyId: user.companyId }, saleId, idempotencyKey)
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    return dianErrorResponse(e)
  }
}
