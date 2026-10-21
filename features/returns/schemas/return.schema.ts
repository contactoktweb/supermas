import { z } from 'zod'
import { MIN_PRODUCTION_NOTES_LENGTH } from '../constants'

export const returnItemInputSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  quantity: z.number().positive('La cantidad debe ser mayor a cero'),
  reason: z.string().optional(),
})

/**
 * Línea de devolución de cliente: BUENO reingresa al inventario vendible; MAL_ESTADO exige destino
 * (PROVEEDOR con proveedor, o PRODUCCION con sede o nota). El servidor repite estas reglas.
 */
export const customerReturnItemSchema = returnItemInputSchema
  .extend({
    condition: z.enum(['BUENO', 'MAL_ESTADO']),
    destination: z.enum(['PRODUCCION', 'PROVEEDOR']).optional(),
    supplierId: z.string().uuid('Proveedor inválido').optional(),
    productionLocationId: z.string().uuid('Sede de producción inválida').optional(),
    dispositionNotes: z.string().trim().optional(),
  })
  .superRefine((item, ctx) => {
    if (item.condition === 'BUENO') {
      if (item.destination || item.supplierId || item.productionLocationId) {
        ctx.addIssue({ code: 'custom', message: 'Una línea en buen estado no lleva destino.', path: ['destination'] })
      }
      return
    }
    if (!item.destination) {
      ctx.addIssue({ code: 'custom', message: 'Elija el destino del producto en mal estado (producción o proveedor).', path: ['destination'] })
      return
    }
    if (item.destination === 'PROVEEDOR' && !item.supplierId) {
      ctx.addIssue({ code: 'custom', message: 'Seleccione el proveedor al que se devuelve el producto en mal estado.', path: ['supplierId'] })
    }
    if (
      item.destination === 'PRODUCCION' &&
      !item.productionLocationId &&
      (item.dispositionNotes ?? '').length < MIN_PRODUCTION_NOTES_LENGTH
    ) {
      ctx.addIssue({
        code: 'custom',
        message: `Seleccione la sede de producción o escriba una nota del área o responsable (mínimo ${MIN_PRODUCTION_NOTES_LENGTH} caracteres).`,
        path: ['dispositionNotes'],
      })
    }
  })

export const customerReturnSchema = z.object({
  saleId: z.string().uuid('ID de venta inválido'),
  items: z.array(customerReturnItemSchema).min(1, 'Debe incluir al menos un producto'),
  reason: z.string().min(3, 'El motivo de devolución es obligatorio'),
  notes: z.string().optional(),
})

export const supplierReturnSchema = z.object({
  purchaseId: z.string().uuid('ID de compra inválido'),
  items: z.array(returnItemInputSchema).min(1, 'Debe incluir al menos un producto'),
  reason: z.string().min(3, 'El motivo de devolución es obligatorio'),
  notes: z.string().optional(),
})

export const dispatchDamagedItemSchema = z.object({
  returnItemId: z.string().uuid('Línea de devolución inválida'),
  dispatchReference: z.string().trim().max(100, 'La referencia admite máximo 100 caracteres').optional(),
  notes: z.string().trim().max(500, 'Las observaciones admiten máximo 500 caracteres').optional(),
})
