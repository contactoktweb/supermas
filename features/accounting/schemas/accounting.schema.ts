/**
 * SUPER MÁS ERP/POS - Esquemas de Validación Zod del Módulo de Contabilidad
 *
 * Aplica validaciones estrictas en cliente y servidor para la creación de cuentas PUC,
 * asientos contables con partida doble obligatoria (Total Debe == Total Haber) y reversiones.
 */

import { z } from 'zod'

export const accountSchema = z.object({
  code: z
    .string()
    .min(1, 'El código de cuenta es obligatorio')
    .max(10, 'El código no puede exceder 10 caracteres')
    .regex(/^\d+$/, 'El código debe contener únicamente números'),
  name: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(150, 'El nombre no puede exceder 150 caracteres'),
  accountClass: z.coerce.number().min(1).max(7) as z.ZodType<1 | 2 | 3 | 4 | 5 | 6 | 7>,
  type: z.enum([
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'REVENUE',
    'EXPENSE',
    'COST',
    'PRODUCTION_COST',
  ]),
  nature: z.enum(['DEBIT', 'CREDIT']),
  level: z.enum(['CLASS', 'GROUP', 'ACCOUNT', 'SUBACCOUNT', 'AUXILIARY']),
  parentId: z.string().nullable().optional(),
  requiresThirdParty: z.boolean().default(false),
  requiresCostCenter: z.boolean().default(false),
  description: z.string().max(300, 'La descripción no puede exceder 300 caracteres').optional(),
})

export type AccountFormData = z.infer<typeof accountSchema>

export const manualEntryLineSchema = z.object({
  id: z.string().optional(),
  accountId: z.string().min(1, 'Selecciona una cuenta contable'),
  accountCode: z.string().min(1, 'Código requerido'),
  accountName: z.string().min(1, 'Nombre de cuenta requerido'),
  debit: z.coerce.number().min(0, 'El débito no puede ser negativo'),
  credit: z.coerce.number().min(0, 'El crédito no puede ser negativo'),
  description: z.string().min(2, 'Descripción de la línea obligatoria'),
  costCenterId: z.string().optional(),
  costCenterName: z.string().optional(),
})

export const manualEntrySchema = z
  .object({
    date: z.string().min(1, 'La fecha es obligatoria'),
    description: z
      .string()
      .min(5, 'La descripción general debe tener al menos 5 caracteres')
      .max(300, 'Máximo 300 caracteres'),
    locationId: z.string().optional(),
    thirdPartyId: z.string().optional(),
    thirdPartyName: z.string().optional(),
    thirdPartyDoc: z.string().optional(),
    observation: z.string().max(500, 'Máximo 500 caracteres').optional(),
    lines: z
      .array(manualEntryLineSchema)
      .min(2, 'Un asiento contable requiere al menos dos líneas (partida doble)'),
  })
  .refine(
    (data) => {
      const totalDebit = data.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0)
      const totalCredit = data.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0)
      // Redondeo a centavos para evitar discrepancias de punto flotante
      return Math.abs(totalDebit - totalCredit) < 0.01
    },
    {
      message: 'Partida doble descuadrada: El Total Debe debe ser estrictamente igual al Total Haber.',
      path: ['lines'],
    }
  )
  .refine(
    (data) => {
      const totalDebit = data.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0)
      return totalDebit > 0
    },
    {
      message: 'El valor total del asiento debe ser mayor a cero.',
      path: ['lines'],
    }
  )

export type ManualEntryFormData = z.infer<typeof manualEntrySchema>

export const reverseEntrySchema = z.object({
  reason: z
    .string()
    .min(5, 'El motivo de reversión debe tener al menos 5 caracteres')
    .max(300, 'El motivo no puede superar 300 caracteres'),
  authorizedBy: z.string().optional(),
})

export type ReverseEntryFormData = z.infer<typeof reverseEntrySchema>

export const inventoryAccountMappingSchema = z.object({
  categoryId: z.string().min(1, 'Categoría requerida'),
  inventoryAccountId: z.string().min(1, 'Cuenta de inventario (Clase 14) requerida'),
  costAccountId: z.string().min(1, 'Cuenta de costo de ventas (Clase 6) requerida'),
  revenueAccountId: z.string().min(1, 'Cuenta de ingreso (Clase 4) requerida'),
})

export type InventoryAccountMappingFormData = z.infer<typeof inventoryAccountMappingSchema>
