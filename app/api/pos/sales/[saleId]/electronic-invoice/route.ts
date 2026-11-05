/**
 * POST /api/pos/sales/:saleId/electronic-invoice — Emite la factura electrónica de una venta del POS.
 *
 * Cada venta del POS se factura electrónicamente al cobrar. El cajero no tiene invoices.create,
 * así que aquí se valida que la venta sea del POS (tiene caja), que la vea por RLS (empresa y sede)
 * y que la haya hecho él; luego se emite en contexto de servidor de confianza.
 * La clave de idempotencia es fija por venta: repetir la llamada devuelve la misma factura.
 */
import { NextRequest, NextResponse } from 'next/server'
import { AuthError, requireServerUser, requireAnyPermission } from '@/lib/auth/server-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { DianOrchestratorService } from '@/features/invoices/services/dian/dian-orchestrator.service'
import { dianErrorResponse, isUuid, scheduleCustomerDelivery } from '../../../../dian/_shared'

export const runtime = 'nodejs'

const POS_INVOICE_PERMISSIONS = ['pos.sell', 'pos.create_sale', 'invoices.create']

export async function POST(req: NextRequest, { params }: { params: Promise<{ saleId: string }> }) {
  try {
    const user = await requireServerUser(req)
    await requireAnyPermission(user, POS_INVOICE_PERMISSIONS)

    const { saleId } = await params
    if (!isUuid(saleId)) return NextResponse.json({ success: false, error: 'Venta inválida.' }, { status: 400 })

    const { data: sale } = await user.userClient
      .from('sales')
      .select('id, seller_user_id, cash_session_id')
      .eq('id', saleId)
      .maybeSingle()
    if (!sale) throw new AuthError('Venta no encontrada o sin acceso desde su sede.', 403)
    if (!sale.cash_session_id) {
      return NextResponse.json({ success: false, error: 'La venta no se hizo en el POS.' }, { status: 400 })
    }
    if (sale.seller_user_id !== user.userId && !user.isAdmin && !(await user.can('invoices.create'))) {
      throw new AuthError('Solo quien hizo la venta puede facturarla desde el POS.', 403)
    }

    const admin = createAdminClient()
    const orchestrator = new DianOrchestratorService()
    const actor = { userId: user.userId, companyId: user.companyId }

    // Si la venta ya tiene factura (emitida desde Facturación o en un intento anterior), se retoma esa.
    const { data: existing } = await admin
      .from('electronic_invoices')
      .select('id')
      .eq('sale_id', saleId)
      .eq('document_type', 'INVOICE')
      .maybeSingle()
    if (existing) {
      const result = await orchestrator.process(actor, existing.id)
      scheduleCustomerDelivery(user, result)
      return NextResponse.json({ success: true, data: result })
    }

    const result = await orchestrator.emitFromSale(
      admin,
      actor,
      saleId,
      `POS-FE-${saleId}`
    )
    // En contexto de servidor la función SQL no conoce al usuario: se deja constancia de quién facturó.
    if (!result.idempotentReplay) {
      await admin
        .from('electronic_invoices')
        .update({ created_by_user_id: user.userId })
        .eq('id', result.invoiceId)
        .is('created_by_user_id', null)
    }
    scheduleCustomerDelivery(user, result)
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    return dianErrorResponse(e)
  }
}
