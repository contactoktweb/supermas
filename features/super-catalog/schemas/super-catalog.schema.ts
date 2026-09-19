import { z } from 'zod'

/**
 * Esquema de validación para filtros de consulta del Catálogo Super Más.
 */
export const superCatalogFiltersSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  availability: z.enum(['ALL', 'AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK']).optional(),
  catalogStatus: z.enum(['ALL', 'PUBLISHED', 'HIDDEN']).optional(),
  purchaseStatus: z.enum(['ALL', 'ENABLED', 'DISABLED']).optional(),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  sortBy: z
    .enum(['name', 'price', 'sku', 'category', 'brand', 'availability', 'sales', 'views'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
})

/**
 * Esquema base para la configuración de venta web de un producto.
 */
export const superProductConfigBaseSchema = z.object({
  webSuperMas: z.boolean(),
  webDirectPurchaseEnabled: z.boolean(),
  price: z.number().positive('El precio de venta web debe ser mayor a 0.'),
  showPrice: z.boolean().default(true),
  webLowStockThreshold: z
    .number()
    .int()
    .min(1, 'El umbral de pocas unidades debe ser al menos 1.'),
  taxConfigId: z.string().optional(),
  imageUrl: z.string().url('La URL de imagen principal debe ser válida.').optional().or(z.literal('')),
  images: z.array(z.string().url('Cada imagen adicional debe tener una URL válida.')).optional(),
})

/**
 * Esquema completo con validación cruzada: Si la compra directa está activa, el catálogo debe estar publicado.
 */
export const superProductConfigSchema = superProductConfigBaseSchema.refine(
  (data) => !data.webDirectPurchaseEnabled || data.webSuperMas,
  {
    message: 'Para activar la compra directa, el producto debe estar publicado en el Catálogo Super Más.',
    path: ['webDirectPurchaseEnabled'],
  }
)

/**
 * Esquema para actualización parcial.
 */
export const superProductConfigUpdateSchema = superProductConfigBaseSchema
  .partial()
  .refine(
    (data) => {
      if (data.webDirectPurchaseEnabled === true && data.webSuperMas === false) {
        return false
      }
      return true
    },
    {
      message: 'Para activar la compra directa, el producto debe estar publicado en el Catálogo Super Más.',
      path: ['webDirectPurchaseEnabled'],
    }
  )

/**
 * Esquema para actualización rápida de precio e impuesto.
 */
export const superProductPriceSchema = z.object({
  price: z.number().positive('El precio debe ser un valor numérico positivo.'),
  showPrice: z.boolean().default(true),
  taxConfigId: z.string().min(1, 'Debe seleccionar un perfil impositivo válido.'),
})

/**
 * Esquema para administración de galería fotográfica.
 */
export const superProductImagesSchema = z.object({
  imageUrl: z.string().url('La URL principal debe ser válida.').optional().or(z.literal('')),
  images: z.array(z.string().url('Cada URL de galería debe ser válida.')).default([]),
})

/**
 * Esquema para acciones masivas sobre lote de productos.
 */
export const superBulkActionSchema = z.object({
  action: z.enum(['PUBLISH', 'HIDE', 'ENABLE_PURCHASE', 'DISABLE_PURCHASE']),
  productIds: z
    .array(z.string())
    .min(1, 'Debe seleccionar al menos un producto para la acción en lote.'),
})

export type SuperCatalogFiltersInput = z.infer<typeof superCatalogFiltersSchema>
export type SuperProductConfigInput = z.infer<typeof superProductConfigSchema>
export type SuperProductPriceInput = z.infer<typeof superProductPriceSchema>
export type SuperProductImagesInput = z.infer<typeof superProductImagesSchema>
export type SuperBulkActionInput = z.infer<typeof superBulkActionSchema>
