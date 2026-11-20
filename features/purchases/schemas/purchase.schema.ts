import { z } from 'zod'

export const purchaseItemInputSchema = z.object({
  productId: z.string().min(1, 'El producto es obligatorio'),
  productName: z.string().optional(),
  sku: z.string().optional(),
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
  supplierInvoiceNumber: z.string().trim().max(60, 'El número de factura no puede superar 60 caracteres').optional(),
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

export const updatePurchaseSchema = createPurchaseSchema

/** purchases.supplier_invoice_number es VARCHAR(50). */
export const SUPPLIER_INVOICE_NUMBER_MAX_LENGTH = 50
export const NO_ORDER_REASON_MIN_LENGTH = 10
export const NO_ORDER_REASON_MAX_LENGTH = 200
/** Encabezado con el que queda marcada en observaciones una compra registrada sin orden. */
export const NO_ORDER_NOTES_PREFIX = 'Factura sin orden de compra. Motivo:'

export const directInvoiceSchema = z.object({
  supplierInvoiceNumber: z
    .string()
    .trim()
    .min(2, 'Escriba el número de la factura del proveedor.')
    .max(SUPPLIER_INVOICE_NUMBER_MAX_LENGTH, `El número de factura no puede superar ${SUPPLIER_INVOICE_NUMBER_MAX_LENGTH} caracteres`),
  noOrderReason: z
    .string()
    .trim()
    .min(NO_ORDER_REASON_MIN_LENGTH, `Explique por qué la factura llegó sin orden de compra (mínimo ${NO_ORDER_REASON_MIN_LENGTH} caracteres).`)
    .max(NO_ORDER_REASON_MAX_LENGTH, `El motivo no puede superar ${NO_ORDER_REASON_MAX_LENGTH} caracteres.`),
})

/** Observaciones de la compra sin orden: el motivo primero y luego las notas del usuario. */
export function buildNoOrderNotes(reason: string, notes?: string): string {
  const header = `${NO_ORDER_NOTES_PREFIX} ${reason.trim()}`
  const extra = (notes || '').trim()
  return extra ? `${header}\n${extra}` : header
}

export const registerPaymentSchema = z.object({
  purchaseId: z.string().min(1, 'El ID de compra es obligatorio'),
  amount: z.number().positive('El monto del abono debe ser mayor a 0'),
  paymentMethod: z.string().min(1, 'El medio de pago es obligatorio'),
  bankAccountId: z.string().optional(),
  cashRegisterId: z.string().optional(),
  cashSessionId: z.string().optional(),
  reference: z.string().min(2, 'La referencia o comprobante de pago es obligatoria').trim(),
  date: z.string().optional(),
  notes: z.string().max(300).optional(),
})

export const receivePurchaseItemSchema = z.object({
  itemId: z.string().min(1, 'El ID del ítem es obligatorio'),
  productId: z.string().optional(),
  quantityReceived: z.number().positive('La cantidad a recibir debe ser mayor a 0'),
})

export const receivePurchaseSchema = z.object({
  purchaseId: z.string().min(1, 'El ID de la compra es obligatorio'),
  notes: z.string().max(500).optional(),
  supplierRemissionNumber: z.string().max(100).optional(),
  receivedItems: z.array(receivePurchaseItemSchema).optional(),
})

export const cancelPurchaseSchema = z.object({
  purchaseId: z.string().min(1, 'El ID de la compra es obligatorio'),
  reason: z.string().min(5, 'Debe indicar un motivo de anulación de al menos 5 caracteres').trim(),
})

export type CreatePurchaseFormData = z.infer<typeof createPurchaseSchema>
export type UpdatePurchaseFormData = z.infer<typeof updatePurchaseSchema>
export type RegisterPaymentFormData = z.infer<typeof registerPaymentSchema>
export type ReceivePurchaseFormData = z.infer<typeof receivePurchaseSchema>
export type CancelPurchaseFormData = z.infer<typeof cancelPurchaseSchema>

export const registerSupplierInvoiceSchema = z.object({
  purchaseId: z.string().min(1),
  supplierInvoiceNumber: z
    .string()
    .trim()
    .min(2, 'El número de factura del proveedor debe tener al menos 2 caracteres')
    .max(60, 'El número de factura no puede superar 60 caracteres'),
})
