import { z } from 'zod'

export const AuditDiffFieldSchema = z.object({
  field: z.string().min(1),
  label: z.string().min(1),
  previousValue: z.string(),
  newValue: z.string(),
})

export const AuditLogInputSchema = z.object({
  action: z.string().min(1),
  level: z.enum(['INFO', 'WARNING', 'CRITICAL']).default('INFO'),
  module: z.enum([
    'INVENTORY',
    'TRANSFERS',
    'SALES',
    'PRODUCTS',
    'SECURITY',
    'CASH',
    'INVOICING',
    'PURCHASES',
    'TAXES',
    'WAREHOUSES',
    'USERS',
    'EXOGENA',
    'REPORTS',
    'WEB_ORDERS',
    'SYSTEM',
  ]),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  entityReference: z.string().optional(),
  userId: z.string().min(1),
  userName: z.string().min(1),
  userRole: z.string().min(1),
  locationId: z.string().optional(),
  locationName: z.string().optional(),
  result: z.enum(['SUCCESS', 'FAILED', 'REJECTED']).default('SUCCESS'),
  details: z.string().min(1),
  ipAddress: z.string().optional(),
  sessionId: z.string().optional(),
  changes: z.array(AuditDiffFieldSchema).optional(),
})

export const AuditFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  userId: z.string().optional(),
  userRole: z.string().optional(),
  module: z.string().optional(),
  action: z.string().optional(),
  level: z.enum(['ALL', 'INFO', 'WARNING', 'CRITICAL']).optional(),
  locationId: z.string().optional(),
  result: z.enum(['ALL', 'SUCCESS', 'FAILED', 'REJECTED']).optional(),
  onlyCritical: z.boolean().optional(),
  onlyWithChanges: z.boolean().optional(),
  searchQuery: z.string().optional(),
})
