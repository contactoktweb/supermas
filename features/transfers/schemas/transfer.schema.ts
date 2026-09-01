import { z } from 'zod'

export const transferItemInputSchema = z.object({
  productId: z.string().min(1, 'El producto es obligatorio'),
  units: z
    .number()
    .int('Las unidades deben ser números enteros')
    .positive('La cantidad a transferir debe ser mayor a 0'),
})

export const transferCreateSchema = z
  .object({
    originLocationId: z.string().min(1, 'La bodega de origen es obligatoria'),
    destinationLocationId: z.string().min(1, 'La bodega de destino es obligatoria'),
    items: z
      .array(transferItemInputSchema)
      .min(1, 'Debe incluir al menos un producto en la transferencia'),
    reason: z.string().max(200).optional(),
    internalReference: z.string().max(100).optional(),
    notes: z.string().max(500, 'Las observaciones no pueden exceder 500 caracteres').optional(),
    idempotencyKey: z.string().optional(),
  })
  .refine((data) => data.originLocationId !== data.destinationLocationId, {
    message: 'La bodega de origen y destino no pueden ser la misma ubicación',
    path: ['destinationLocationId'],
  })

export const transferDispatchSchema = z.object({
  transferId: z.string().min(1, 'ID de transferencia obligatorio'),
  notes: z.string().max(500).optional(),
})

export const transferReceiveItemSchema = z.object({
  productId: z.string().min(1),
  receivedUnits: z.number().int().min(0, 'Las unidades recibidas no pueden ser negativas'),
  notes: z.string().max(300).optional(),
})

export const transferReceiveSchema = z.object({
  transferId: z.string().min(1, 'ID de transferencia obligatorio'),
  receivedItems: z.array(transferReceiveItemSchema).optional(),
  notes: z.string().max(500).optional(),
  evidenceUrl: z.string().url('URL de evidencia inválida').optional().or(z.literal('')),
})

export const transferRejectSchema = z.object({
  transferId: z.string().min(1, 'ID de transferencia obligatorio'),
  reason: z.string().min(5, 'Debe especificar el motivo del rechazo (mínimo 5 caracteres)').max(500),
})

export const transferFilterSchema = z.object({
  query: z.string().optional(),
  code: z.string().optional(),
  originLocationId: z.string().optional(),
  destinationLocationId: z.string().optional(),
  direction: z.enum(['ALL', 'INBOUND', 'OUTBOUND']).optional().default('ALL'),
  activeLocationId: z.string().optional(),
  status: z.enum(['ALL', 'PENDING', 'IN_TRANSIT', 'RECEIVED', 'REJECTED']).optional().default('ALL'),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  productId: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().optional().default(10),
  sortField: z
    .enum(['createdAt', 'code', 'origin', 'destination', 'units', 'status', 'updatedAt'])
    .optional()
    .default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
})
