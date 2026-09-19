/**
 * SUPER MÁS ERP/POS - Tipos del Módulo de Alertas y Supervisión
 *
 * Define las estructuras de datos, enumeraciones de estado, niveles de prioridad,
 * roles, criterios de filtrado y permisos granulares para el sistema de alertas.
 */

export type AlertPriority = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA'

export type AlertStatus = 'NEW' | 'READ' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

export type AlertModule =
  | 'INVENTORY'
  | 'PURCHASES'
  | 'SALES'
  | 'INVOICING'
  | 'CASH'
  | 'WEB_ORDERS'
  | 'TRANSFERS'
  | 'ACCOUNTING'

export type AlertEntityType =
  | 'PRODUCT'
  | 'PURCHASE_INVOICE'
  | 'SALE'
  | 'INVOICE'
  | 'CASH_REGISTER'
  | 'WEB_ORDER'
  | 'TRANSFER'
  | 'ACCOUNTING_ENTRY'

export interface AlertHistoryEntry {
  timestamp: string
  actor: string
  action: 'CREATED' | 'READ' | 'ATTENDED' | 'RESOLVED' | 'CLOSED' | 'NOTE_ADDED'
  notes?: string
}

export interface AlertItem {
  id: string
  ruleId: string
  code: string
  title: string
  description: string
  module: AlertModule
  priority: AlertPriority
  status: AlertStatus
  entityType: AlertEntityType
  entityId: string
  entityReference: string
  locationId?: string | null
  locationName?: string | null
  assignedRole?: string | null
  assignedUserId?: string | null
  assignedUserName?: string | null
  readAt?: string | null
  readByUserId?: string | null
  attendedAt?: string | null
  attendedByUserId?: string | null
  attendedByUserName?: string | null
  attendedComment?: string | null
  resolvedAt?: string | null
  resolvedByUserId?: string | null
  resolvedByUserName?: string | null
  solutionNotes?: string | null
  closedAt?: string | null
  closedByUserId?: string | null
  metadata?: Record<string, any>
  history: AlertHistoryEntry[]
  createdAt: string
  updatedAt: string
}

export interface AlertRule {
  id: string
  code: string
  name: string
  description: string
  module: AlertModule
  defaultPriority: AlertPriority
  enabled: boolean
  thresholds: Record<string, any>
  targetRoles: string[]
  autoResolve: boolean
  updatedAt: string
  updatedBy: string
}

export interface AlertStats {
  totalNew: number
  totalCritical: number
  totalPending: number // NEW + READ + IN_PROGRESS
  totalResolved: number // RESOLVED + CLOSED
  totalCount: number
  byModule: Record<AlertModule, number>
  byPriority: Record<AlertPriority, number>
  byStatus: Record<AlertStatus, number>
  byLocation: Array<{
    locationId: string
    locationName: string
    count: number
    criticalCount: number
  }>
}

export interface AlertFilterCriteria {
  searchQuery?: string
  priority?: AlertPriority | 'ALL'
  module?: AlertModule | 'ALL'
  status?: AlertStatus | 'ALL'
  locationId?: string | 'ALL'
  startDate?: string
  endDate?: string
  onlyCritical?: boolean
  onlyUnread?: boolean
  assignedUserId?: string | 'ALL'
  page?: number
  pageSize?: number
}

export interface UserAlertContext {
  userId: string
  name: string
  role: 'SUPERADMIN' | 'WAREHOUSE_ADMIN' | 'POINT_ADMIN' | 'CASHIER' | 'ACCOUNTANT' | string
  locationId?: string
  permissions: AlertPermission[]
}

export type AlertPermission =
  | 'alerts.read'
  | 'alerts.manage'
  | 'alerts.resolve'
  | 'alerts.configure'
  | 'alerts.audit'

export interface RuleEvaluationResult {
  evaluatedRules: number
  newAlertsCreated: number
  activeAlertsCount: number
  timestamp: string
}
