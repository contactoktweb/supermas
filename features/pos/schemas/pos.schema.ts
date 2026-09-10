import { z } from 'zod'

export const posPaymentMethodSchema = z.enum([
  'EFECTIVO',
  'TARJETA',
  'TRANSFERENCIA',
  'MIXTO',
])

export const posCartItemSchema = z.object({
  productId: z.string().min(1, 'El ID del producto es requerido'),
  quantity: z
    .number()
    .positive('La cantidad debe ser mayor a 0')
    .max(5000, 'La cantidad máxima en POS es de 5,000 unidades'),
  discountPercent: z.number().min(0).max(100).default(0),
  discountReason: z.string().optional(),
})

export const posSalePayloadSchema = z.object({
  customerId: z.string().min(1, 'Debe seleccionar un cliente'),
  locationId: z.string().min(1, 'La bodega o punto de venta es requerido'),
  paymentMethod: posPaymentMethodSchema.default('EFECTIVO'),
  amountPaid: z.number().nonnegative('El valor recibido no puede ser negativo'),
  items: z
    .array(posCartItemSchema)
    .min(1, 'Debe haber al menos un producto en la venta POS'),
  notes: z.string().optional(),
})
