import { z } from 'zod'

/**
 * Esquema de validación para filtros de consulta de pedidos web.
 */
export const webOrderFiltersSchema = z.object({
  search: z.string().optional(),
  orderNumber: z.string().optional(),
  customer: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z
    .enum([
      'ALL',
      'PENDING',
      'CONFIRMED',
      'PREPARING',
      'READY_TO_DISPATCH',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ])
    .optional(),
  channel: z
    .enum(['ALL', 'CATALOGO_SUPERMAS', 'CATALOGO_DISTRIBUIDORA'])
    .optional(),
  paymentMethod: z.string().optional(),
  locationId: z.string().optional(),
  invoiceStatus: z.enum(['ALL', 'INVOICED', 'PENDING']).optional(),
  sortBy: z.enum(['date', 'total', 'orderNumber', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
})

/**
 * Esquema de validación para checklist de alistamiento / preparación.
 */
export const webOrderChecklistSchema = z.object({
  itemsReviewed: z.boolean().refine((val) => val === true, {
    message: 'Debe revisar todos los productos del pedido.',
  }),
  quantitiesVerified: z.boolean().refine((val) => val === true, {
    message: 'Debe verificar las cantidades exactas.',
  }),
  customerConfirmed: z.boolean().refine((val) => val === true, {
    message: 'Debe confirmar los datos del cliente.',
  }),
  addressConfirmed: z.boolean().refine((val) => val === true, {
    message: 'Debe validar la dirección y ciudad de entrega.',
  }),
  paymentVerified: z.boolean().refine((val) => val === true, {
    message: 'Debe verificar el pago o soporte de transferencia.',
  }),
})

/**
 * Esquema de validación para el despacho de mercancía al transportador.
 */
export const webOrderDispatchSchema = z.object({
  courier: z.string().min(2, 'La empresa transportadora es obligatoria.'),
  trackingNumber: z.string().min(3, 'El número de guía o tracking es obligatorio.'),
  deliveryNotes: z.string().optional(),
})

/**
 * Esquema de validación para cancelación de un pedido web.
 * Motivo obligatorio para auditoría y trazabilidad.
 */
export const webOrderCancellationSchema = z.object({
  reason: z.string().min(5, 'El motivo de cancelación debe tener al menos 5 caracteres.'),
})

export type WebOrderFiltersInput = z.infer<typeof webOrderFiltersSchema>
export type WebOrderChecklistInput = z.infer<typeof webOrderChecklistSchema>
export type WebOrderDispatchInput = z.infer<typeof webOrderDispatchSchema>
export type WebOrderCancellationInput = z.infer<typeof webOrderCancellationSchema>
