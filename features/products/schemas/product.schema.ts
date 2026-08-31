import { z } from 'zod'

export const unitOfMeasureSchema = z.enum([
  'UND',
  'KG',
  'PAQ',
  'CAJA',
  'LT',
  'GR',
  'MT',
  'DOCENA',
])

export const taxProfileSchema = z.enum([
  'EXENTO',
  'EXCLUIDO',
  'IVA_0',
  'IVA_5',
  'IVA_19',
  'CUSTOM',
])

export const productStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED'])

export const priceTierSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, 'El código de lista de precios es requerido'),
  name: z.string().min(1, 'El nombre de lista de precios es requerido'),
  price: z.coerce
    .number()
    .min(0, 'El precio no puede ser negativo'),
  minQuantity: z.coerce.number().min(1).optional().default(1),
})

export const warehouseStockConfigSchema = z.object({
  locationId: z.string().min(1, 'La ubicación es requerida'),
  minStock: z.coerce.number().min(0, 'El stock mínimo no puede ser negativo').default(10),
  criticalStock: z.coerce.number().min(0, 'El stock crítico no puede ser negativo').default(5),
})

export const productFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'El nombre del producto debe tener al menos 2 caracteres')
      .max(120, 'El nombre del producto no puede exceder 120 caracteres'),
    sku: z
      .string()
      .trim()
      .min(2, 'El SKU debe tener al menos 2 caracteres')
      .max(30, 'El SKU no puede exceder 30 caracteres')
      .regex(
        /^[A-Za-z0-9\-_]+$/,
        'El SKU solo puede contener letras, números, guiones (-) y guiones bajos (_)'
      )
      .transform((val) => val.toUpperCase()),
    barcode: z
      .string()
      .trim()
      .max(48, 'El código de barras no puede exceder 48 caracteres')
      .default(''),
    description: z
      .string()
      .trim()
      .max(500, 'La descripción no puede exceder 500 caracteres')
      .optional()
      .default(''),
    category: z
      .string()
      .trim()
      .min(2, 'La categoría es obligatoria'),
    brand: z
      .string()
      .trim()
      .min(2, 'La marca es obligatoria'),
    unitOfMeasure: unitOfMeasureSchema.default('UND'),
    imageUrl: z.string().trim().default(''),
    images: z.array(z.string()).default([]),
    status: productStatusSchema.default('ACTIVE'),
    taxProfile: taxProfileSchema.default('IVA_19'),
    vatRatePercent: z.coerce
      .number()
      .min(0, 'El IVA no puede ser menor a 0%')
      .max(100, 'El IVA no puede ser mayor a 100%')
      .default(19),
    prices: z
      .array(priceTierSchema)
      .min(1, 'Debe registrar al menos un precio para el producto'),
    minStockThreshold: z.coerce
      .number()
      .min(0, 'El umbral mínimo no puede ser negativo')
      .default(15),
    criticalStockThreshold: z.coerce
      .number()
      .min(0, 'El umbral crítico no puede ser negativo')
      .default(5),
    webSuperMas: z.boolean().default(true),
    webDistribuidora: z.boolean().default(false),
    warehouseDistribution: z.array(warehouseStockConfigSchema).optional().default([]),
    auditReason: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      const normalPrice = data.prices.find((p) => p.code === 'NORMAL')?.price || 0
      return normalPrice > 0
    },
    {
      message: 'El Precio Normal de venta debe ser mayor a $0',
      path: ['prices'],
    }
  )

export type ProductFormValues = z.infer<typeof productFormSchema>
