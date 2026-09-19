/**
 * SUPER MÁS ERP/POS - Tipos del Módulo Configuración y Parámetros Globales
 *
 * Define las interfaces para las 16 categorías de configuración, variables dinámicas
 * del sistema, estadísticas consolidadas, trazabilidad de cambios y permisos RBAC.
 */

export type SettingsCategory =
  | 'COMPANY'
  | 'WAREHOUSES'
  | 'INVENTORY'
  | 'PRODUCTS'
  | 'PRICING'
  | 'POS'
  | 'CASH'
  | 'ECOMMERCE'
  | 'CATALOGS'
  | 'BILLING'
  | 'TAX'
  | 'ACCOUNTING'
  | 'EXOGENA'
  | 'ALERTS'
  | 'SECURITY'
  | 'ROLES'

export type SettingValueType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON'

export interface CompanySettings {
  companyName: string
  legalName: string
  nit: string
  dv: string
  fiscalRegime: string
  economicActivityCode: string
  legalRepresentative: string
  legalRepresentativeDoc: string
  address: string
  city: string
  department: string
  postalCode: string
  phone: string
  mobile: string
  email: string
  billingEmail: string
  website: string
  logoUrl: string
  currency: string
  timezone: string
  commercialDescription: string
  updatedAt: string
  updatedBy: string
}

export interface InventorySettings {
  defaultMinStockThreshold: number
  criticalLowStockThreshold: number
  valuationMethod: 'WEIGHTED_AVERAGE' | 'PEPS_FIFO'
  allowNegativeStock: boolean
  requireReasonForManualAdjustments: boolean
  autoGenerateKardexMovement: boolean
  stockCheckFrequencyHours: number
  webAvailability: {
    showAvailableBadge: boolean
    showLowStockBadge: boolean
    showOutOfStockBadge: boolean
    lowStockWarningThreshold: number
    hideOutOfStockAfterDays: number
  }
  transferRules: {
    requireDualApproval: boolean
    autoBlockTransitAfterHours: number
    defaultOriginLocationId: string
  }
  updatedAt: string
  updatedBy: string
}

export interface POSSettings {
  defaultLocationId: string
  defaultLocationName: string
  defaultCashRegisterId: string
  genericCustomerId: string
  genericCustomerName: string
  genericCustomerDoc: string
  autoPrintReceipt: boolean
  allowQuickSaleWithoutCustomer: boolean
  defaultReceiptTemplate: string
  enableSoundFeedback: boolean
  enabledPaymentMethods: Array<'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT'>
  cashRegisterRules: {
    recommendedInitialFloat: number
    maxAllowedInitialFloat: number
    requireDailyClose: boolean
    maxOpenHoursBeforeAlert: number
    maxDifferenceToleranceAmount: number
    requireDualSignatureOnDiscrepancy: boolean
  }
  salesPriceList: string
  updatedAt: string
  updatedBy: string
}

export interface EcommerceSettings {
  dispatchWarehouseId: string
  dispatchWarehouseName: string
  superCatalogEnabled: boolean
  distributorCatalogEnabled: boolean
  publicShowPrices: boolean
  publicShowAvailability: boolean
  defaultLowStockThreshold: number
  outOfStockBehavior: string
  webPriceList: string
  distributorPriceList: string
  whatsapp: {
    phoneNumber: string
    displayPhoneNumber: string
    defaultQuoteTemplate: string
    defaultSupportTemplate: string
    allowDirectWhatsAppPurchase: boolean
  }
  cartRules: {
    minOrderAmount: number
    maxOrderAmount: number
    autoReserveStockMinutes: number
  }
  updatedAt: string
  updatedBy: string
}

export interface SystemSettingItem {
  id: string
  key: string
  value: any
  category: SettingsCategory
  description: string
  type: SettingValueType
  isCritical: boolean
  updatedAt: string
  updatedBy: string
}

export interface SettingChangeHistory {
  id: string
  timestamp: string
  actor: string
  category: SettingsCategory
  key: string
  fieldLabel: string
  previousValue: any
  newValue: any
  isCritical: boolean
  notes?: string
}

export interface SettingsStats {
  totalActiveSettings: number
  lastModifiedAt: string
  lastModifiedBy: string
  totalCriticalSettings: number
  categoriesCount: number
  activeModulesCount: number
}

export interface CategoryCardInfo {
  id: SettingsCategory
  title: string
  description: string
  iconName: string
  badgeText: string
  badgeTone: 'blue' | 'teal' | 'amber' | 'purple' | 'red' | 'slate'
  isCritical: boolean
  isReadOnly?: boolean
}

export type SettingsPermission =
  | 'settings.read'
  | 'settings.update'
  | 'settings.company'
  | 'settings.inventory'
  | 'settings.ecommerce'
  | 'settings.billing'
  | 'settings.tax'
  | 'settings.accounting'
  | 'settings.alerts'
  | 'settings.security'

export interface UserSettingsContext {
  userId: string
  name: string
  role: 'SUPERADMIN' | 'WAREHOUSE_ADMIN' | 'POINT_ADMIN' | 'ACCOUNTANT' | 'CASHIER' | string
  permissions: SettingsPermission[]
}
