import { z } from 'zod'

export const purchaseItemInputSchema = z.object({
  productId: z.string().min(1, 'El producto es obligatorio'),
  productName: z.string().min(1, 'El nombre del producto es obligatorio'),
  sku: z.string().min(1, 'El SKU es obligatorio'),
  barcode: z.string().optional(),
  unitOfMeasure: z.string().default('UND'),
  imageUrl: z.string().optional(),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unitCost: z.number().nonnegative('El costo unitario no puede ser negativo'),
  discountPercent: z.number().min(0).max(100).default(0),
  taxCode: z.string().default('IVA_19'),
  taxRatePercent: z.number().min(0).max(100).default(19),
})

export const createPurchaseSchema = z.object({
  supplierId: z.string().min(1, 'Debe seleccionar un proveedor'),
  supplierInvoiceNumber: z
    .string()
    .min(2, 'El número de factura del proveedor debe tener al menos 2 caracteres')
    .trim(),
  destinationLocationId: z.string().min(1, 'Debe seleccionar una bodega de destino'),
  date: z.string().min(1, 'La fecha de compra es obligatoria'),
  paymentType: z.enum(['CONTADO', 'CREDITO']),
  dueDate: z.string().optional(),
  notes: z.string().max(500, 'Las observaciones no pueden superar 500 caracteres').optional(),
  items: z.array(purchaseItemInputSchema).min(1, 'Debe agregar al menos un producto a la compra'),
  saveAsDraft: z.boolean().default(false),
  attachment: z
    .object({
      fileName: z.string(),
      fileType: z.string(),
      fileSize: z.number(),
      url: z.string(),
    })
    .optional(),
}).refine(
  (data) => {
    if (data.paymentType === 'CREDITO') {
      return Boolean(data.dueDate && data.dueDate.trim().length > 0)
    }
    return true
  },
  {
    message: 'La fecha de vencimiento es obligatoria para compras a crédito',
    path: ['dueDate'],
  }
)

export const registerPaymentSchema = z.object({
  purchaseId: z.string().min(1, 'El ID de compra es obligatorio'),
  amount: z.number().positive('El monto del abono debe ser mayor a 0'),
  paymentMethod: z.enum(['TRANSFERENCIA', 'EFECTIVO', 'CONSIGNACION', 'CHEQUE', 'OTRO']),
  reference: z.string().min(2, 'La referencia o comprobante de pago es obligatoria').trim(),
  notes: z.string().max(300).optional(),
})

export const receivePurchaseSchema = z.object({
  purchaseId: z.string().min(1, 'El ID de la compra es obligatorio'),
  notes: z.string().max(500).optional(),
})

export const cancelPurchaseSchema = z.object({
  purchaseId: z.string().min(1, 'El ID de la compra es obligatorio'),
  reason: z.string().min(5, 'Debe indicar un motivo de anulación de al menos 5 caracteres').trim(),
})

export type CreatePurchaseFormData = z.infer<typeof createPurchaseSchema>
export type RegisterPaymentFormData = z.infer<typeof registerPaymentSchema>
export type ReceivePurchaseFormData = z.infer<typeof receivePurchaseSchema>
export type CancelPurchaseFormData = z.infer<typeof cancelPurchaseSchema>
