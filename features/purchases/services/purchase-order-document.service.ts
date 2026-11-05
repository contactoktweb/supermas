/**
 * Reúne los datos de la orden de compra en PDF con el cliente del usuario (RLS: empresa y sedes asignadas).
 * Solo servidor.
 */
import { SupabaseClient } from '@supabase/supabase-js'
import { getAuthenticatedCompany } from '@/lib/supabase/tenant'
import { PurchaseRepository } from '../repositories/purchase.repository'
import { isCancelledPurchase } from '../utils/purchase-status'
import { PurchaseOrderPdfParams } from './purchase-order-pdf.builder'

export class PurchaseOrderDocumentError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

export async function loadPurchaseOrderDocument(client: SupabaseClient, purchaseId: string): Promise<PurchaseOrderPdfParams> {
  const purchase = await new PurchaseRepository(client).findById(purchaseId)
  if (!purchase) throw new PurchaseOrderDocumentError('Orden de compra no encontrada o sin acceso desde su sede.', 404)
  if (isCancelledPurchase(purchase.status)) {
    throw new PurchaseOrderDocumentError('La orden está anulada: no se puede enviar al proveedor.', 409)
  }
  if (purchase.items.length === 0) throw new PurchaseOrderDocumentError('La orden no tiene productos.', 409)

  const [company, supplierResult, locationResult] = await Promise.all([
    getAuthenticatedCompany(client),
    client.from('suppliers').select('contact_name, address, city').eq('id', purchase.supplierId).maybeSingle(),
    client.from('locations').select('address, city, phone').eq('id', purchase.destinationLocationId).maybeSingle(),
  ])
  if (!company) throw new PurchaseOrderDocumentError('No se encontraron los datos de la empresa.', 404)

  const supplier = supplierResult.data || {}
  const location = locationResult.data || {}

  return {
    purchase,
    issuer: {
      legalName: text(company.business_name) || text(company.trade_name),
      tradeName: text(company.trade_name),
      taxId: text(String(company.tax_id ?? '')),
      verificationDigit: text(String(company.verification_digit ?? '')),
      address: text(company.address),
      city: text(company.city),
      phone: text(company.phone),
      email: text(company.email),
    },
    supplier: {
      contactName: text((supplier as Record<string, unknown>).contact_name),
      address: text((supplier as Record<string, unknown>).address),
      city: text((supplier as Record<string, unknown>).city),
    },
    delivery: {
      address: text((location as Record<string, unknown>).address),
      city: text((location as Record<string, unknown>).city),
      phone: text((location as Record<string, unknown>).phone),
    },
  }
}
