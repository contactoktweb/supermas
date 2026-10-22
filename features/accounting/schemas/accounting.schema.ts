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
    .max(20, 'El código no puede exceder 20 caracteres')
    .regex(/^[\d.]+$|^[\d]+(\.[\d]+)*$/, 'El código debe contener números y puntos para subcuentas (ej: 111005.01)'),
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

/** Tipos de comprobante que admite un asiento manual (la base valida lo mismo, migración 064). */
export const MANUAL_VOUCHER_TYPE_CODES = ['CC', 'AJ', 'CM', 'TR'] as const
export type ManualVoucherTypeCode = (typeof MANUAL_VOUCHER_TYPE_CODES)[number]
export const DEFAULT_MANUAL_VOUCHER_TYPE_CODE: ManualVoucherTypeCode = 'CC'

export const manualEntrySchema = z
  .object({
    date: z.string().min(1, 'La fecha es obligatoria'),
    /** Sin valor se registra como CC (Comprobante de contabilidad). */
    voucherTypeCode: z.enum(MANUAL_VOUCHER_TYPE_CODES).optional(),
    dueDate: z.string().optional(),
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

export const thirdPartySchema = z.object({
  documentType: z.enum(['CC', 'NIT', 'CE', 'PASSPORT', 'TI']).default('NIT'),
  documentNumber: z
    .string()
    .min(3, 'El número de identificación debe tener al menos 3 caracteres')
    .max(30, 'Máximo 30 caracteres'),
  verificationDigit: z.string().max(1).optional(),
  legalNature: z.enum(['NATURAL', 'JURIDICA']).default('JURIDICA'),
  firstName: z.string().max(100).optional(),
  otherNames: z.string().max(100).optional(),
  firstSurname: z.string().max(100).optional(),
  secondSurname: z.string().max(100).optional(),
  companyName: z
    .string()
    .min(2, 'La razón social o nombre completo es obligatorio')
    .max(200, 'Máximo 200 caracteres'),
  commercialName: z.string().max(200).optional(),
  thirdPartyType: z.enum(['CLIENTE', 'PROVEEDOR', 'EMPLEADO', 'ACREEDOR', 'OTRO']).default('OTRO'),
  email: z.string().email('Correo electrónico inválido').optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address: z.string().max(250).optional(),
  city: z.string().max(100).default('Medellín'),
  department: z.string().max(100).default('Antioquia'),
})

export type ThirdPartyFormData = z.infer<typeof thirdPartySchema>

export const reverseEntrySchema = z.object({
  reason: z
    .string()
    .min(5, 'El motivo de reversión debe tener al menos 5 caracteres')
    .max(300, 'El motivo no puede superar 300 caracteres'),
  authorizedBy: z.string().optional(),
})

export type ReverseEntryFormData = z.infer<typeof reverseEntrySchema>

// Cuentas por línea de inventario (migración 062). La base valida además que sean auxiliares activas.
export const inventoryLineAccountsSchema = z.object({
  inventoryAccountId: z.string().uuid('Cuenta de inventario (grupo 14) requerida'),
  costAccountId: z.string().uuid('Selecciona la cuenta de costo de ventas'),
  incomeAccountId: z.string().uuid('Selecciona la cuenta de ingreso'),
})

export type InventoryLineAccountsFormData = z.infer<typeof inventoryLineAccountsSchema>

// Tipos de comprobante (migración 064): un administrador solo renombra o activa/desactiva los no-system.
export const voucherTypeUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(80, 'El nombre no puede exceder 80 caracteres')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.name !== undefined || data.isActive !== undefined, {
    message: 'No hay cambios para guardar.',
  })

export type VoucherTypeUpdateData = z.infer<typeof voucherTypeUpdateSchema>
