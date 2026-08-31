// Super Más ERP/POS - Dashboard Domain Types

export type PeriodType = 'TODAY' | '7_DAYS' | '30_DAYS' | 'THIS_MONTH' | 'YEAR' | 'CUSTOM'

export interface DateRange {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

export type UserRole =
  | 'SUPERADMIN'
  | 'ADMIN'
  | 'WAREHOUSE_ADMIN'
  | 'POINT_ADMIN'
  | 'SELLER'
  | 'ACCOUNTANT'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: UserRole
  roleName: string
  locationId?: string
  locationName: string
  avatar: string
  lastLoginAt: string // ISO timestamp UTC
}

export interface MetricDelta {
  value: number
  deltaPct: number
  isPositive: boolean
  comparisonLabel: string
}

export interface DashboardMetrics {
  period: PeriodType
  // 1. Commercial metrics
  todaySales: {
    value: number
    count: number
    deltaYesterdayPct: number
    ticketAverage: number
  }
  periodSales: {
    value: number
    deltaPct: number
    count: number
  }
  // 2. Financial / Cost metrics (Permission-protected)
  grossProfit?: {
    value: number
    marginPct: number
    deltaPct: number
  }
  inventoryAtCost?: {
    value: number
    deltaPct: number
  }
  purchases?: {
    value: number
    count: number
    deltaPct: number
  }
  accountsPayable?: {
    pendingBalance: number
    dueSoonCount: number
    overdueCount: number
  }
  isFinancialRedacted: boolean

  // 3. Operational & Inventory metrics
  productsCount: {
    total: number
    active: number
    lowStock: number
    outOfStock: number
    critical: number
  }
  pendingTransfers: {
    pending: number
    inTransit: number
    total: number
  }
  webOrders: {
    newOrders: number
    preparing: number
    ready: number
    totalToday: number
  }
  activeAlerts: {
    inventory: number
    purchases: number
    billing: number
    system: number
    total: number
  }
  cashRegisters?: {
    openCount: number
    currentCash: number
    turnSales: number
  }
}

export interface WarehouseDashboardCard {
  id: string
  name: string
  code: string
  city: string
  type: 'WAREHOUSE' | 'STORE_POINT' | 'DISTRIBUTION_CENTER'
  status: 'ACTIVE' | 'INACTIVE'
  inventoryAtCost?: number
  inventoryUnits: number
  todaySales: number
  totalProducts: number
  lowStockCount: number
  outOfStockCount: number
  pendingTransfersCount: number
  occupancyPct: number
  isEcommerce: boolean
}

export interface SalesChartPoint {
  label: string
  sales: number
  purchases: number
  profit?: number
  transactions: number
}

export interface TopProductItem {
  productId: string
  name: string
  sku: string
  category: string
  unitsSold: number
  revenue: number
  percentage: number
  inStock: boolean
}

export interface InventoryDistributionItem {
  locationId: string
  locationName: string
  units: number
  value?: number
  percentage: number
  color: string
}

export interface QuickActionItem {
  id: string
  title: string
  subtitle: string
  icon: string
  targetView: string
  badge?: string
  requiredPermission: string
  highlight?: boolean
}

export type ActivityType =
  | 'SALE'
  | 'PURCHASE'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'INVOICE'
  | 'WEB_ORDER'
  | 'AUTH'

export interface ActivityFeedItem {
  id: string
  timestamp: string // ISO timestamp
  userName: string
  userAvatar: string
  userRole: string
  action: string
  module: string
  locationName: string
  detail: string
  amount?: number
  type: ActivityType
}

export interface LoginAuditItem {
  id: string
  userId: string
  userName: string
  userEmail: string
  roleSnapshot: UserRole
  locationId?: string
  locationName: string
  loginAt: string // ISO timestamp UTC
  logoutAt?: string
  status: 'SUCCESS' | 'FAILED'
  failureReason?: string
  ipAddress: string
  userAgent: string
  browser: string
  os: string
  sessionId: string
}

export interface PendingAttentionItem {
  id: string
  title: string
  description: string
  count: number
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  module: string
  targetView: string
  badgeLabel: string
  createdAt: string
}
