/**
 * POST /api/dian/notes — Emite una nota crédito o débito electrónica sobre una factura aceptada (habilitación).
 * Body: {
 *   originalInvoiceId: uuid, documentType: 'CREDIT_NOTE' | 'DEBIT_NOTE', conceptCode: '1'..'6',
 *   reason: string, lines?: [...], returnId?: uuid, idempotencyKey: string
 * }
 * Permiso: invoices.cancel (notas crédito/débito). Lo valida también la función SQL con el JWT del usuario.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireServerUser, requireAnyPermission } from '@/lib/auth/server-auth'
import { DianOrchestratorService } from '@/features/invoices/services/dian/dian-orchestrator.service'
import { assertInvoiceVisible, dianErrorResponse, isUuid, scheduleCustomerDelivery } from '../_shared'

export const runtime = 'nodejs'

const bad = (error: string) => NextResponse.json({ success: false, error }, { status: 400 })

const uuidField = (message: string) => z.string().refine((v) => isUuid(v), { message })
const positiveAmount = (field: string) => z.number({ message: `${field} inválido.` }).finite(`${field} inválido.`).positive(`${field} inválido.`)

const noteLineSchema = z.object(
  {
    sale_item_id: uuidField('sale_item_id inválido.').optional(),
    product_id: uuidField('product_id inválido.').nullable().optional(),
    quantity: positiveAmount('quantity').optional(),
    net_amount: positiveAmount('net_amount').optional(),
    unit_price: positiveAmount('unit_price').optional(),
    description: z.string({ message: 'Descripción inválida.' }).max(300, 'Descripción inválida.').optional(),
  },
  { message: 'Formato de línea inválido.' }
).passthrough()

const emitNoteSchema = z
  .object({
    originalInvoiceId: uuidField('originalInvoiceId inválido.'),
    documentType: z.enum(['CREDIT_NOTE', 'DEBIT_NOTE'], { message: 'documentType debe ser CREDIT_NOTE o DEBIT_NOTE.' }),
    conceptCode: z.preprocess((v) => String(v ?? ''), z.string().regex(/^[1-6]$/, 'Concepto de corrección inválido.')),
    reason: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim() : ''),
      z.string().min(5, 'El motivo debe tener entre 5 y 500 caracteres.').max(500, 'El motivo debe tener entre 5 y 500 caracteres.')
    ),
    idempotencyKey: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim() : ''),
      z.string().min(8, 'idempotencyKey inválida.').max(120, 'idempotencyKey inválida.')
    ),
    returnId: uuidField('returnId inválido.').nullable().optional().transform((v) => v ?? null),
    lines: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(noteLineSchema).max(500, 'Demasiadas líneas.')),
  })
  // Nota crédito por devolución (concepto 1): la base de datos exige la devolución COMPLETED vinculada (p_return_id).
  .refine((b) => !(b.documentType === 'CREDIT_NOTE' && b.conceptCode === '1' && !b.returnId), {
    message: 'La nota crédito por devolución (concepto 1) requiere seleccionar la devolución completada de la venta.',
    path: ['returnId'],
  })
  .refine(
    (b) => {
      const itemIds = b.lines.map((l) => l.sale_item_id).filter(Boolean)
      return new Set(itemIds).size === itemIds.length
    },
    { message: 'Una misma línea de la factura aparece repetida en la nota.', path: ['lines'] }
  )

export async function POST(req: NextRequest) {
  try {
    const user = await requireServerUser(req)
    await requireAnyPermission(user, ['invoices.cancel'])

    const parsed = emitNoteSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Solicitud inválida.')
    const { originalInvoiceId, documentType, conceptCode, reason, idempotencyKey, returnId, lines } = parsed.data

    // La factura debe ser visible para el usuario (empresa y sede) antes de que el servidor actúe con service_role.
    await assertInvoiceVisible(user, originalInvoiceId)

    const orchestrator = new DianOrchestratorService()
    const result = await orchestrator.emitNote(
      user.userClient,
      { userId: user.userId, companyId: user.companyId },
      { originalInvoiceId, documentType, conceptCode, reason, lines, returnId },
      idempotencyKey
    )
    scheduleCustomerDelivery(user, result)
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    return dianErrorResponse(e)
  }
}
