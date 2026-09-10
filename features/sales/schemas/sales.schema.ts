import { z } from 'zod'

export const saleStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'INVOICED',
  'CANCELLED',
  'RETURNED',
])

export const paymentMethodSchema = z.enum([
  'EFECTIVO',
  'TRANSFERENCIA',
  'TARJETA',
  'CREDITO',
  'MIXTO',
])

export const saleDocumentTypeSchema = z.enum([
  'FACTURA_ELECTRONICA',
  'FACTURA_POS',
  'REMISION',
  'NINGUNO',
])

export const createSaleItemSchema = z.object({
  productId: z.string().min(1, 'El ID del producto es requerido'),
  quantity: z
    .number()
    .positive('La cantidad a vender debe ser mayor a 0')
    .max(100000, 'La cantidad no puede superar 100,000 unidades'),
  unitPrice: z.number().nonnegative('El precio no puede ser negativo').optional(),
  discountPercent: z
    .number()
    .min(0, 'El descuento no puede ser negativo')
    .max(100, 'El descuento no puede exceder el 100%')
    .default(0),
  taxRatePercent: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
})

export const createSaleSchema = z.object({
  customerId: z.string().min(1, 'Debe seleccionar un cliente'),
  locationId: z.string().min(1, 'Debe seleccionar una bodega o punto de venta'),
  items: z
    .array(createSaleItemSchema)
    .min(1, 'Debe incluir al menos un producto en la venta'),
  paymentMethod: paymentMethodSchema.default('EFECTIVO'),
  documentTypeToGenerate: z
    .enum(['FACTURA_POS', 'FACTURA_ELECTRONICA', 'REMISION', 'NINGUNO'])
    .default('FACTURA_POS'),
  notes: z.string().optional(),
  discountReason: z.string().optional(),
})

export const cancelSaleSchema = z.object({
  saleId: z.string().min(1, 'El ID de la venta es requerido'),
  reason: z
    .string()
    .min(5, 'El motivo de anulación debe contener al menos 5 caracteres')
    .max(500, 'El motivo no puede exceder 500 caracteres'),
})

export const createInvoiceFromSaleSchema = z.object({
  saleId: z.string().min(1, 'El ID de la venta es requerido'),
  type: z.enum(['FACTURA_ELECTRONICA', 'FACTURA_POS']),
  paymentMethod: paymentMethodSchema.optional(),
})

export const createRemissionFromSaleSchema = z.object({
  saleId: z.string().min(1, 'El ID de la venta es requerido'),
  deliveredBy: z.string().optional(),
  driverName: z.string().optional(),
  receivedBy: z.string().optional(),
  notes: z.string().optional(),
})

export const saleReturnItemSchema = z.object({
  productId: z.string().min(1, 'El ID del producto es requerido'),
  quantity: z.number().positive('La cantidad a devolver debe ser mayor a 0'),
  reason: z.string().min(3, 'El motivo del ítem es requerido'),
})

export const saleReturnSchema = z.object({
  saleId: z.string().min(1, 'El ID de la venta es requerido'),
  items: z
    .array(saleReturnItemSchema)
    .min(1, 'Debe especificar al menos un producto a devolver'),
  reason: z.string().min(5, 'El motivo general de la devolución es requerido'),
})

export const saleFilterSchema = z.object({
  query: z.string().optional(),
  customerId: z.string().optional(),
  locationId: z.string().optional(),
  sellerName: z.string().optional(),
  status: z.union([saleStatusSchema, z.literal('ALL')]).optional(),
  paymentMethod: z.union([paymentMethodSchema, z.literal('ALL')]).optional(),
  documentType: z.union([saleDocumentTypeSchema, z.literal('ALL')]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
  sortBy: z
    .enum(['saleNumber', 'date', 'totalAmount', 'customerName', 'status'])
    .default('date'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
})
