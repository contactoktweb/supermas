import { z } from 'zod'

export const stockHealthStatusSchema = z.enum([
  'AVAILABLE',
  'LOW_STOCK',
  'CRITICAL',
  'OUT_OF_STOCK',
])

export const inventoryFilterSchema = z.object({
  query: z.string().trim().optional().default(''),
  locationId: z.string().trim().optional().default('ALL'),
  category: z.string().trim().optional().default('ALL'),
  brand: z.string().trim().optional().default('ALL'),
  stockHealth: z.union([stockHealthStatusSchema, z.literal('ALL')]).optional().default('ALL'),
  hasStock: z.enum(['ALL', 'WITH_STOCK', 'ZERO_STOCK']).optional().default('ALL'),
  tab: z.enum(['ALL', 'LOW_STOCK', 'CRITICAL', 'OUT_OF_STOCK']).optional().default('ALL'),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(5).max(100).default(10),
  sortField: z
    .enum([
      'productName',
      'sku',
      'category',
      'currentStock',
      'totalStock',
      'stockHealth',
      'totalValueAtCost',
      'lastMovementAt',
      'locationName',
    ])
    .default('productName'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
  viewMode: z.enum(['CONSOLIDATED', 'BY_LOCATION']).default('CONSOLIDATED'),
})

export const stockAdjustmentSchema = z.object({
  locationId: z.string().min(1, 'La bodega es obligatoria'),
  productId: z.string().min(1, 'El producto es obligatorio'),
  type: z.enum(['IN', 'OUT']),
  quantity: z.coerce
    .number()
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad a ajustar debe ser mayor o igual a 1'),
  reason: z
    .string()
    .trim()
    .min(3, 'El motivo del ajuste debe tener al menos 3 caracteres')
    .max(120, 'El motivo no puede exceder 120 caracteres'),
  notes: z
    .string()
    .trim()
    .max(400, 'Las observaciones no pueden exceder 400 caracteres')
    .optional(),
  evidenceUrl: z.string().trim().optional(),
  responsibleUserId: z.string().optional(),
  responsibleUserName: z.string().optional(),
})

export const quickTransferSchema = z.object({
  productId: z.string().min(1, 'El producto es requerido'),
  productName: z.string().min(1),
  sku: z.string().min(1),
  originLocationId: z.string().min(1, 'La bodega de origen es obligatoria'),
  destinationLocationId: z.string().min(1, 'La bodega de destino es obligatoria'),
  quantity: z.coerce
    .number()
    .int()
    .min(1, 'Debes transferir al menos 1 unidad'),
  notes: z.string().trim().max(300).optional(),
}).refine((data) => data.originLocationId !== data.destinationLocationId, {
  message: 'La bodega de origen y destino no pueden ser la misma',
  path: ['destinationLocationId'],
})

export const physicalCountApplySchema = z.object({
  sessionId: z.string().min(1),
  locationId: z.string().min(1),
  items: z.array(
    z.object({
      productId: z.string(),
      difference: z.number(),
      reason: z.string().default('Ajuste por conteo físico verificado'),
    })
  ),
})

export const thresholdUpdateSchema = z.object({
  productId: z.string().min(1),
  locationId: z.string().min(1),
  minStock: z.coerce.number().min(0, 'El stock mínimo no puede ser negativo'),
  criticalStock: z.coerce.number().min(0, 'El stock crítico no puede ser negativo'),
  reorderPoint: z.coerce.number().min(0).optional(),
})

export type InventoryFilterInput = z.infer<typeof inventoryFilterSchema>
export type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>
export type QuickTransferFormData = z.infer<typeof quickTransferSchema>
