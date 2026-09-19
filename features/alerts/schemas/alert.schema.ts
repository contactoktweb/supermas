/**
 * SUPER MÁS ERP/POS - Esquemas de Validación Zod (Módulo Alertas)
 */

import { z } from 'zod'

export const alertPrioritySchema = z.enum(['CRITICA', 'ALTA', 'MEDIA', 'BAJA'])

export const alertStatusSchema = z.enum(['NEW', 'READ', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])

export const alertModuleSchema = z.enum([
  'INVENTORY',
  'PURCHASES',
  'SALES',
  'INVOICING',
  'CASH',
  'WEB_ORDERS',
  'TRANSFERS',
  'ACCOUNTING',
])

export const alertFilterCriteriaSchema = z.object({
  searchQuery: z.string().optional(),
  priority: z.union([alertPrioritySchema, z.literal('ALL')]).default('ALL'),
  module: z.union([alertModuleSchema, z.literal('ALL')]).default('ALL'),
  status: z.union([alertStatusSchema, z.literal('ALL')]).default('ALL'),
  locationId: z.string().default('ALL'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  onlyCritical: z.boolean().default(false),
  onlyUnread: z.boolean().default(false),
  assignedUserId: z.string().default('ALL'),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(15),
})

export const attendAlertSchema = z.object({
  comment: z
    .string()
    .min(3, 'El comentario debe contener al menos 3 caracteres')
    .max(500, 'El comentario no puede superar los 500 caracteres'),
})

export const resolveAlertSchema = z.object({
  solutionNotes: z
    .string()
    .min(5, 'Las notas de solución deben contener al menos 5 caracteres')
    .max(1000, 'Las notas de solución no pueden superar los 1000 caracteres'),
})

export const closeAlertSchema = z.object({
  closeNotes: z.string().max(500).optional(),
})

export const alertRuleConfigSchema = z.object({
  ruleId: z.string().min(1, 'El ID de regla es requerido'),
  enabled: z.boolean(),
  priority: alertPrioritySchema,
  thresholds: z.record(z.string(), z.any()).default({}),
})

export type AlertFilterCriteriaInput = z.infer<typeof alertFilterCriteriaSchema>
export type AttendAlertInput = z.infer<typeof attendAlertSchema>
export type ResolveAlertInput = z.infer<typeof resolveAlertSchema>
export type AlertRuleConfigInput = z.infer<typeof alertRuleConfigSchema>
