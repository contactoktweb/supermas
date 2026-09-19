/**
 * SUPER MÁS ERP/POS - Tipos del Módulo de Auditoría y Trazabilidad Inmutable
 */

export type AuditLevel = 'INFO' | 'WARNING' | 'CRITICAL'

export type AuditResult = 'SUCCESS' | 'FAILED' | 'REJECTED'

export type AuditModule =
  | 'INVENTORY'
  | 'TRANSFERS'
  | 'SALES'
  | 'PRODUCTS'
  | 'SECURITY'
  | 'CASH'
  | 'INVOICING'
  | 'PURCHASES'
  | 'TAXES'
  | 'WAREHOUSES'
  | 'USERS'
  | 'EXOGENA'
  | 'REPORTS'
  | 'WEB_ORDERS'
  | 'ALERTS'
  | 'SETTINGS'
  | 'SYSTEM'

export type AuditActionType =
  | 'STOCK_ADJUSTED'
  | 'TRANSFER_APPROVED'
  | 'TRANSFER_CREATED'
  | 'SALE_CREATED'
  | 'SALE_CANCELLED'
  | 'PRICE_MODIFIED'
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'CASH_REGISTER_OPENED'
  | 'CASH_REGISTER_CLOSED'
  | 'INVOICE_ISSUED'
  | 'INVOICE_CANCELLED'
  | 'INVOICE_DIAN_REJECTED'
  | 'PURCHASE_CREATED'
  | 'TAX_CONFIG_MODIFIED'
  | 'LOCATION_UPDATED'
  | 'LOCATION_CREATED'
  | 'USER_CREATED'
  | 'USER_ROLE_UPDATED'
  | 'EXOGENA_GENERATED'
  | 'EXPORT_EXECUTED'
  | 'CONFIG_CHANGED'
  | 'SETTING_UPDATED'
  | 'SETTING_BATCH_UPDATED'
  | 'CRITICAL_CONFIG_CHANGED'
  | 'WEB_ORDER_CONFIRMED'
  | 'WEB_ORDER_PREPARED'
  | 'WEB_ORDER_DISPATCHED'
  | 'WEB_ORDER_DELIVERED'
  | 'WEB_ORDER_CANCELLED'
  | 'CATALOG_PRODUCT_UPDATED'
  | 'CATALOG_BULK_UPDATED'
  | 'SUPER_CATALOG_PRODUCT_UPDATED'
  | 'SUPER_CATALOG_BULK_UPDATED'
  | 'REPORT_GENERATED'
  | 'REPORT_EXPORTED'
  | 'REPORT_SENSITIVE_ACCESSED'
  | 'ALERT_CREATED'
  | 'ALERT_READ'
  | 'ALERT_ATTENDED'
  | 'ALERT_RESOLVED'
  | 'ALERT_RULE_MODIFIED'
  | 'OTHER'

export interface AuditDiffField {
  field: string
  label: string
  previousValue: string
  newValue: string
}

export interface AuditLogEntry {
  id: string
  timestamp: string // Formato ISO UTC
  action: AuditActionType
  level: AuditLevel
  module: AuditModule
  entityType: string
  entityId: string
  entityReference?: string
  userId: string
  userName: string
  userRole: string
  locationId?: string
  locationName?: string
  result: AuditResult
  details: string
  ipAddress?: string
  sessionId?: string
  changes?: AuditDiffField[]
}

export interface AuditStats {
  todayEventsCount: number
  periodEventsCount: number
  activeUsersCount: number
  criticalActionsCount: number
  topActiveModule: string
  pendingReviewsCount: number
}

export interface AuditFilters {
  dateFrom?: string
  dateTo?: string
  userId?: string
  userRole?: string
  module?: string
  action?: string
  level?: 'ALL' | 'INFO' | 'WARNING' | 'CRITICAL'
  locationId?: string
  result?: 'ALL' | 'SUCCESS' | 'FAILED' | 'REJECTED'
  onlyCritical?: boolean
  onlyWithChanges?: boolean
  searchQuery?: string
}

export type AuditPermission =
  | 'audit.read'
  | 'audit.export'
  | 'audit.critical'
  | 'audit.security'
  | 'audit.config'
