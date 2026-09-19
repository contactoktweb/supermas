import { z } from 'zod'

/**
 * Esquema de validación para filtros de consulta del catálogo distribuidora.
 */
export const distributorCatalogFiltersSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  availability: z.enum(['ALL', 'AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK']).optional(),
  distributorStatus: z.enum(['ALL', 'PUBLISHED', 'HIDDEN']).optional(),
  superMasStatus: z.enum(['ALL', 'PUBLISHED', 'HIDDEN']).optional(),
  directPurchase: z.enum(['ALL', 'ENABLED', 'DISABLED']).optional(),
  sortBy: z.enum(['name', 'price', 'sku', 'category', 'brand', 'availability']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
})

/**
 * Esquema base sin refinamientos para permitir .partial().
 */
export const productCatalogConfigBaseSchema = z.object({
  webDistribuidora: z.boolean(),
  webSuperMas: z.boolean(),
  webDirectPurchaseEnabled: z.boolean(),
  webWhatsAppInquiryEnabled: z.boolean(),
  webWhatsAppPhone: z
    .string()
    .min(7, 'El número de WhatsApp debe tener al menos 7 dígitos.')
    .optional(),
})

/**
 * Esquema de validación para la configuración comercial completa de un producto.
 */
export const productCatalogConfigSchema = productCatalogConfigBaseSchema.refine(
  (data) => !data.webDirectPurchaseEnabled || data.webSuperMas,
  {
    message: 'Para habilitar compra directa, el producto debe estar activo en Catálogo Super Más.',
    path: ['webDirectPurchaseEnabled'],
  }
)

/**
 * Esquema de validación para actualizaciones parciales de configuración comercial.
 */
export const productCatalogConfigUpdateSchema = productCatalogConfigBaseSchema
  .partial()
  .refine(
    (data) => {
      if (data.webDirectPurchaseEnabled === true && data.webSuperMas === false) {
        return false
      }
      return true
    },
    {
      message: 'Para habilitar compra directa, el producto debe estar activo en Catálogo Super Más.',
      path: ['webDirectPurchaseEnabled'],
    }
  )

/**
 * Esquema de validación para acciones masivas sobre lote de productos.
 */
export const bulkActionSchema = z.object({
  action: z.enum([
    'PUBLISH',
    'HIDE',
    'ENABLE_WHATSAPP',
    'DISABLE_WHATSAPP',
    'ENABLE_DIRECT_PURCHASE',
    'DISABLE_DIRECT_PURCHASE',
  ]),
  productIds: z
    .array(z.string())
    .min(1, 'Debe seleccionar al menos un producto para la acción masiva.'),
})

export type DistributorCatalogFiltersInput = z.infer<typeof distributorCatalogFiltersSchema>
export type ProductCatalogConfigInput = z.infer<typeof productCatalogConfigSchema>
export type BulkActionInput = z.infer<typeof bulkActionSchema>
