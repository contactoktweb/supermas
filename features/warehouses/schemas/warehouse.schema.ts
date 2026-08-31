import { z } from 'zod'

export const locationTypeSchema = z.enum(['WAREHOUSE', 'STORE_POINT', 'DISTRIBUTION_CENTER'], {
  message: 'Selecciona un tipo de ubicación válido',
})

export const locationStatusSchema = z.enum(['ACTIVE', 'INACTIVE'])

export const warehouseSettingsSchema = z.object({
  allowInventoryOperations: z.boolean().default(true),
  allowSales: z.boolean().default(true),
  allowPurchases: z.boolean().default(true),
  allowTransfers: z.boolean().default(true),
  isStorePoint: z.boolean().default(false),
  isEcommerceProcessingSource: z.boolean().default(false),
  lowStockAlertThresholdPercent: z.number().min(1).max(100).default(15),
  autoBlockOnZeroStock: z.boolean().default(false),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export const warehouseFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(80, 'El nombre no puede exceder 80 caracteres'),
  code: z
    .string()
    .trim()
    .min(2, 'El código debe tener al menos 2 caracteres')
    .max(20, 'El código no puede exceder 20 caracteres')
    .transform((val) => val.toUpperCase().replace(/\s+/g, '-'))
    .refine((val) => /^[A-Z0-9_-]+$/.test(val), {
      message: 'El código solo puede contener letras mayúsculas, números, guiones y guiones bajos',
    }),
  type: locationTypeSchema,
  status: locationStatusSchema.default('ACTIVE'),
  address: z
    .string()
    .trim()
    .min(4, 'La dirección debe tener al menos 4 caracteres')
    .max(120, 'La dirección no puede exceder 120 caracteres'),
  city: z
    .string()
    .trim()
    .min(2, 'La ciudad debe tener al menos 2 caracteres')
    .max(60, 'La ciudad no puede exceder 60 caracteres'),
  department: z.string().trim().max(60).optional().or(z.literal('')),
  phone: z
    .string()
    .trim()
    .max(25)
    .optional()
    .or(z.literal('')),
  email: z
    .string()
    .trim()
    .email('Ingresa un correo electrónico válido')
    .optional()
    .or(z.literal('')),
  managerName: z.string().trim().max(80).optional().or(z.literal('')),
  managerEmail: z
    .string()
    .trim()
    .email('Correo del responsable no válido')
    .optional()
    .or(z.literal('')),
  managerPhone: z.string().trim().max(25).optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  settings: warehouseSettingsSchema,
})

export type WarehouseFormData = z.infer<typeof warehouseFormSchema>

export const stockAdjustmentSchema = z.object({
  locationId: z.string().min(1, 'La bodega es obligatoria'),
  productId: z.string().min(1, 'El producto es obligatorio'),
  type: z.enum(['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'], {
    message: 'Tipo de ajuste inválido',
  }),
  quantity: z
    .number({ message: 'La cantidad debe ser un número' })
    .positive('La cantidad debe ser mayor a 0')
    .int('La cantidad debe ser un número entero'),
  reason: z.enum(
    [
      'CONTEO_FISICO',
      'MERMA_ROTURA',
      'PRODUCTO_VENCIDO',
      'ERROR_REGISTRO',
      'DEVOLUCION_INTERNA',
      'OTRO',
    ],
    { message: 'Selecciona el motivo del ajuste' }
  ),
  documentRef: z.string().trim().max(30).optional().or(z.literal('')),
  notes: z
    .string()
    .trim()
    .min(5, 'La justificación u observación debe tener al menos 5 caracteres')
    .max(300, 'Las notas no pueden exceder 300 caracteres'),
})

export type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>

export const createTransferSchema = z
  .object({
    originLocationId: z.string().min(1, 'Selecciona la bodega de origen'),
    destinationLocationId: z.string().min(1, 'Selecciona la bodega de destino'),
    items: z
      .array(
        z.object({
          productId: z.string().min(1, 'Producto requerido'),
          units: z.number().positive('Las unidades deben ser mayor a 0').int(),
        })
      )
      .min(1, 'Debes incluir al menos un producto en la transferencia'),
    notes: z.string().max(300).optional().or(z.literal('')),
  })
  .refine((data) => data.originLocationId !== data.destinationLocationId, {
    message: 'La bodega de origen y destino no pueden ser la misma',
    path: ['destinationLocationId'],
  })

export type CreateTransferFormData = z.infer<typeof createTransferSchema>
