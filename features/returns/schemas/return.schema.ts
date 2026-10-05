import { z } from 'zod'

export const returnItemInputSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  quantity: z.number().positive('La cantidad debe ser mayor a cero'),
  reason: z.string().optional(),
})

export const customerReturnSchema = z.object({
  saleId: z.string().uuid('ID de venta inválido'),
  items: z.array(returnItemInputSchema).min(1, 'Debe incluir al menos un producto'),
  reason: z.string().min(3, 'El motivo de devolución es obligatorio'),
  notes: z.string().optional(),
})

export const supplierReturnSchema = z.object({
  purchaseId: z.string().uuid('ID de compra inválido'),
  items: z.array(returnItemInputSchema).min(1, 'Debe incluir al menos un producto'),
  reason: z.string().min(3, 'El motivo de devolución es obligatorio'),
  notes: z.string().optional(),
})
