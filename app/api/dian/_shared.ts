/**
 * Utilidades comunes de las rutas /api/dian (solo servidor).
 */
import { after, NextResponse } from 'next/server'
import { AuthError, ServerUser } from '@/lib/auth/server-auth'
import { DianOrchestratorError, DianProcessResult } from '@/features/invoices/services/dian/dian-orchestrator.service'
import { InvoiceDeliveryService } from '@/features/invoices/services/delivery/invoice-delivery.service'


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

export function dianErrorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ success: false, error: e.message }, { status: e.status })
  if (e instanceof DianOrchestratorError) return NextResponse.json({ success: false, error: e.message }, { status: e.status })
  const message = e instanceof Error ? e.message : String(e)
  // Nunca devolver trazas internas: pueden contener rutas o datos de configuración.
  console.error('[DIAN] Error no controlado:', message)
  return NextResponse.json({ success: false, error: 'Error interno procesando la facturación electrónica.' }, { status: 500 })
}

/**
 * Verifica con el cliente del USUARIO (RLS: empresa y sedes asignadas) que la factura le sea visible.
 * El orquestador usa service_role, así que esta comprobación evita saltarse el aislamiento por sede.
 */
export async function assertInvoiceVisible(user: ServerUser, invoiceId: string): Promise<void> {
  const { data } = await user.userClient.from('electronic_invoices').select('id').eq('id', invoiceId).maybeSingle()
  if (!data) throw new AuthError('Factura no encontrada o sin acceso desde su sede.', 403)
}

/**
 * Cuando la DIAN acepta un documento, se entrega al cliente por correo después de responder
 * (no retrasa la respuesta). La entrega automática ocurre una sola vez por documento.
 */
export function scheduleCustomerDelivery(user: ServerUser, result: DianProcessResult): void {
  if (result.dianStatus !== 'ACCEPTED') return
  after(async () => {
    try {
      await new InvoiceDeliveryService().deliver({ userId: user.userId, companyId: user.companyId }, result.invoiceId, 'AUTO')
    } catch (e) {
      console.error('[DIAN] Entrega automática al cliente:', e instanceof Error ? e.message : String(e))
    }
  })
}
