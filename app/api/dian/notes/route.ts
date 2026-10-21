/**
 * POST /api/dian/notes — Emite una nota crédito o débito electrónica sobre una factura aceptada (habilitación).
 * Body: {
 *   originalInvoiceId: uuid, documentType: 'CREDIT_NOTE' | 'DEBIT_NOTE', conceptCode: '1'..'6',
 *   reason: string, lines?: [...], returnId?: uuid, idempotencyKey: string
 * }
 * Permiso: invoices.cancel (notas crédito/débito). Lo valida también la función SQL con el JWT del usuario.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireServerUser, requireAnyPermission } from '@/lib/auth/server-auth'
import { DianOrchestratorService } from '@/features/invoices/services/dian/dian-orchestrator.service'
import { assertInvoiceVisible, dianErrorResponse, isUuid } from '../_shared'

export const runtime = 'nodejs'

const bad = (error: string) => NextResponse.json({ success: false, error }, { status: 400 })

export async function POST(req: NextRequest) {
  try {
    const user = await requireServerUser(req)
    await requireAnyPermission(user, ['invoices.cancel'])

    const body = await req.json().catch(() => ({}))
    const originalInvoiceId = body?.originalInvoiceId
    const documentType = body?.documentType
    const conceptCode = String(body?.conceptCode ?? '')
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
    const returnId = body?.returnId ?? null
    const lines = Array.isArray(body?.lines) ? body.lines : []

    if (!isUuid(originalInvoiceId)) return bad('originalInvoiceId inválido.')
    if (documentType !== 'CREDIT_NOTE' && documentType !== 'DEBIT_NOTE') return bad('documentType debe ser CREDIT_NOTE o DEBIT_NOTE.')
    if (!/^[1-6]$/.test(conceptCode)) return bad('Concepto de corrección inválido.')
    if (reason.length < 5 || reason.length > 500) return bad('El motivo debe tener entre 5 y 500 caracteres.')
    if (idempotencyKey.length < 8 || idempotencyKey.length > 120) return bad('idempotencyKey inválida.')
    if (returnId !== null && !isUuid(returnId)) return bad('returnId inválido.')
    if (lines.length > 500) return bad('Demasiadas líneas.')
    const itemIds = lines.map((l: any) => l?.sale_item_id).filter(Boolean)
    if (new Set(itemIds).size !== itemIds.length) return bad('Una misma línea de la factura aparece repetida en la nota.')
    for (const l of lines) {
      if (!l || typeof l !== 'object' || Array.isArray(l)) return bad('Formato de línea inválido.')
      if (l.sale_item_id !== undefined && !isUuid(l.sale_item_id)) return bad('sale_item_id inválido.')
      if (l.product_id !== undefined && l.product_id !== null && !isUuid(l.product_id)) return bad('product_id inválido.')
      for (const k of ['quantity', 'net_amount', 'unit_price']) {
        if (l[k] !== undefined && (typeof l[k] !== 'number' || !Number.isFinite(l[k]) || l[k] <= 0)) return bad(`${k} inválido.`)
      }
      if (l.description !== undefined && (typeof l.description !== 'string' || l.description.length > 300)) return bad('Descripción inválida.')
    }

    // La factura debe ser visible para el usuario (empresa y sede) antes de que el servidor actúe con service_role.
    await assertInvoiceVisible(user, originalInvoiceId)

    const orchestrator = new DianOrchestratorService()
    const result = await orchestrator.emitNote(
      user.userClient,
      { userId: user.userId, companyId: user.companyId },
      { originalInvoiceId, documentType, conceptCode, reason, lines, returnId },
      idempotencyKey
    )
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    return dianErrorResponse(e)
  }
}
