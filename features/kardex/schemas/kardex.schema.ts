import { z } from 'zod'

export const movementTypeSchema = z.enum([
  'COMPRA',
  'VENTA',
  'TRANSFERENCIA_ENTRADA',
  'TRANSFERENCIA_SALIDA',
  'AJUSTE_ENTRADA',
  'AJUSTE_SALIDA',
  'DEVOLUCION',
  'REMISION',
  'REVERSION',
])

export const kardexFilterSchema = z.object({
  query: z.string().trim().optional().default(''),
  productId: z.string().trim().optional(),
  sku: z.string().trim().optional(),
  locationId: z.string().trim().optional(),
  movementType: z.union([movementTypeSchema, z.literal('ALL')]).optional().default('ALL'),
  userId: z.string().trim().optional().default('ALL'),
  documentQuery: z.string().trim().optional().default(''),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(5).max(100).default(10),
  sortField: z
    .enum([
      'createdAt',
      'productName',
      'sku',
      'locationName',
      'type',
      'quantityIn',
      'quantityOut',
      'resultingStock',
      'totalValue',
    ])
    .default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
})

export const createReversionMovementSchema = z.object({
  originalMovementId: z.string().min(1, 'El ID de movimiento original es requerido'),
  reason: z
    .string()
    .trim()
    .min(5, 'El motivo de la reversión debe tener al menos 5 caracteres')
    .max(300, 'El motivo no puede exceder 300 caracteres'),
})

export type KardexFilterInput = z.infer<typeof kardexFilterSchema>
export type CreateReversionMovementInput = z.infer<typeof createReversionMovementSchema>
