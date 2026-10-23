/**
 * SUPER MÁS ERP/POS - Recepción de pedidos de la tienda web (Catálogo Super Más)
 *
 * Lo invoca solo POST /api/public/orders (servidor a servidor, con token compartido).
 * Precios, existencias, sede y número de pedido los decide la base de datos
 * (fn_create_public_web_order), nunca los datos que envía el navegador.
 */

import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { publicCatalogService } from '@/features/public-catalog/services/public-catalog.service'
import { getRuntimeSettings } from '@/features/settings/services/runtime-settings'

export const publicWebOrderSchema = z.object({
  idempotencyKey: z.string().uuid(),
  customer: z.object({
    firstName: z.string().trim().min(2).max(60),
    lastName: z.string().trim().min(2).max(60),
    document: z.string().trim().max(20).optional().or(z.literal('')),
    email: z.string().trim().email().max(150),
    phone: z.string().trim().regex(/^[0-9+\s()-]{7,20}$/),
    department: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    address: z.string().trim().min(5).max(250),
    complement: z.string().trim().max(120).optional().or(z.literal('')),
    neighborhood: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().max(12).optional().or(z.literal('')),
    notes: z.string().trim().max(400).optional().or(z.literal('')),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive().max(10000),
      })
    )
    .min(1)
    .max(100),
})

export type PublicWebOrderInput = z.infer<typeof publicWebOrderSchema>

export interface PublicWebOrderResult {
  webOrderId: string
  orderNumber: string
  total: number
  idempotentReplay: boolean
}

export class PublicWebOrderError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

/** Compara el token recibido con PUBLIC_ORDERS_API_TOKEN en tiempo constante. */
export function isValidOrdersToken(received: string | null): boolean {
  const expected = process.env.PUBLIC_ORDERS_API_TOKEN || ''
  if (!expected || !received) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Dirección y notas en texto, porque web_orders guarda la entrega en columnas planas. */
function buildDeliveryText(c: PublicWebOrderInput['customer']) {
  const address = [c.address, c.complement, `Barrio ${c.neighborhood}`].filter(Boolean).join(', ')
  const notes = [
    c.document ? `Documento: ${c.document}` : '',
    `Departamento: ${c.department}`,
    c.postalCode ? `Código postal: ${c.postalCode}` : '',
    c.notes ? `Notas del cliente: ${c.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  return { address, notes }
}

/** SQLSTATE de fn_create_public_web_order que llevan un mensaje apto para el cliente. */
const CLIENT_ERROR_CODES = new Set(['22023', '23502', 'P0002', '55000'])

export async function createPublicWebOrder(
  input: PublicWebOrderInput,
  preferredCompanyId?: string
): Promise<PublicWebOrderResult> {
  const [companyId, settings] = await Promise.all([
    publicCatalogService.resolveCompanyId(preferredCompanyId),
    getRuntimeSettings(supabaseAdmin),
  ])
  if (!companyId || !settings.storefront.superCatalogEnabled) {
    throw new PublicWebOrderError('La tienda no está recibiendo pedidos en este momento.', 503)
  }

  const { address, notes } = buildDeliveryText(input.customer)
  const { data, error } = await supabaseAdmin.rpc('fn_create_public_web_order', {
    p_company_id: companyId,
    p_customer: {
      name: `${input.customer.firstName} ${input.customer.lastName}`,
      phone: input.customer.phone,
      email: input.customer.email,
      address,
      city: input.customer.city,
      notes,
    },
    p_items: input.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_idempotency_key: input.idempotencyKey,
  })

  if (error) {
    if (error.code && CLIENT_ERROR_CODES.has(error.code)) {
      throw new PublicWebOrderError(error.message, 422)
    }
    if (error.code === '42501') {
      throw new PublicWebOrderError('La tienda no está recibiendo pedidos en este momento.', 503)
    }
    throw error
  }
  if (!data?.web_order_id) {
    throw new Error('fn_create_public_web_order no devolvió el pedido creado')
  }

  return {
    webOrderId: data.web_order_id,
    orderNumber: data.order_number,
    total: Number(data.total),
    idempotentReplay: Boolean(data.idempotent_replay),
  }
}
