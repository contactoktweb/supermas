import { z } from 'zod'

export const reportPeriodEnum = z.enum([
  'TODAY',
  'YESTERDAY',
  'THIS_WEEK',
  'THIS_MONTH',
  'LAST_MONTH',
  'THIS_QUARTER',
  'THIS_YEAR',
  'ALL_TIME',
  'CUSTOM',
])

export const reportTypeEnum = z.enum([
  'OVERVIEW',
  'SALES',
  'PURCHASES',
  'INVENTORY',
  'KARDEX',
  'COSTS',
  'WAREHOUSES',
  'CUSTOMERS',
  'SUPPLIERS',
  'CASH',
  'BILLING',
  'ACCOUNTING',
  'ECOMMERCE',
])

export const exportFormatEnum = z.enum(['EXCEL', 'CSV', 'PDF'])

export const reportFilterCriteriaSchema = z.object({
  reportType: reportTypeEnum.optional(),
  period: reportPeriodEnum.default('THIS_MONTH'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  locationId: z.string().optional(),
  secondLocationId: z.string().optional(),
  userId: z.string().optional(),
  categoryId: z.string().optional(),
  productId: z.string().optional(),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  paymentMethod: z.string().optional(),
  movementType: z.string().optional(),
  cashRegisterId: z.string().optional(),
  searchQuery: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0),
})

export const reportExportSchema = z.object({
  reportType: reportTypeEnum,
  format: exportFormatEnum,
  title: z.string().min(1).max(120),
  criteria: reportFilterCriteriaSchema.optional(),
  includeFinancials: z.boolean().default(false),
})

/**
 * Esquema de preparación arquitectónica para Reportes Personalizados
 */
export const customReportConfigSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(3).max(80),
  description: z.string().max(200).optional(),
  reportType: reportTypeEnum,
  criteria: reportFilterCriteriaSchema,
  visibleColumns: z.array(z.string()).min(1),
  createdByUserId: z.string(),
  createdAt: z.string().optional(),
})

export type ReportFilterInput = z.infer<typeof reportFilterCriteriaSchema>
export type ReportExportInput = z.infer<typeof reportExportSchema>
export type CustomReportConfigInput = z.infer<typeof customReportConfigSchema>
