import { z } from 'zod'

export const invoiceTypeEnum = z.enum([
  'ELECTRONICA',
  'POS',
  'NOTA_CREDITO',
  'NOTA_DEBITO',
  'DOCUMENTO_EQUIVALENTE',
])

export const invoiceStatusEnum = z.enum([
  'DRAFT',
  'ISSUED',
  'PAID',
  'PARTIALLY_PAID',
  'PAYMENT_PENDING',
  'CANCELLED',
])

export const dianStatusEnum = z.enum([
  'PENDIENTE',
  'ACEPTADA',
  'RECHAZADA',
  'VALIDADA_DIAN',
  'NO_APLICA',
])

export const invoicePaymentMethodEnum = z.enum([
  'EFECTIVO',
  'TARJETA',
  'TRANSFERENCIA',
  'CREDITO',
  'MIXTO',
])

export const generateInvoiceSchema = z.object({
  saleId: z.string().min(1, 'El ID de la venta es requerido'),
  type: invoiceTypeEnum.default('ELECTRONICA'),
  prefix: z.string().optional(),
  resolutionNumber: z.string().optional(),
  paymentMethod: invoicePaymentMethodEnum.default('EFECTIVO'),
  paymentTerms: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  sendToDianImmediately: z.boolean().default(true),
})

export const creditNoteSchema = z.object({
  invoiceId: z.string().min(1, 'El ID de la factura original es requerido'),
  reason: z.enum([
    'DEVOLUCION_TOTAL',
    'DEVOLUCION_PARCIAL',
    'AJUSTE_PRECIO',
    'DESCUENTO_POSTERIOR',
    'ERROR_FACTURACION',
  ]),
  notes: z.string().min(5, 'El motivo detallado debe contener al menos 5 caracteres'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().positive('La cantidad debe ser mayor a 0'),
        unitPrice: z.number().nonnegative('El precio no puede ser negativo'),
        taxRatePercent: z.number().default(19),
      })
    )
    .min(1, 'Debe incluir al menos un ítem a acreditar'),
  adjustInventory: z.boolean().default(true),
  sendToDianImmediately: z.boolean().default(true),
})

export const cancelInvoiceSchema = z.object({
  invoiceId: z.string().min(1, 'El ID de la factura es requerido'),
  reason: z.string().min(5, 'El motivo de anulación debe contener al menos 5 caracteres'),
})
