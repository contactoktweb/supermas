/**
 * SUPER MÁS ERP/POS - Tipos del módulo Configuración General.
 *
 * Cada categoría edita una fuente real (companies, system_settings, locations) o muestra en solo
 * lectura la fuente oficial que se administra en su propio módulo (DIAN, contabilidad, roles).
 */

export type SettingsCategory =
  | 'COMPANY'
  | 'INVENTORY'
  | 'POS'
  | 'CASH'
  | 'ECOMMERCE'
  | 'BILLING'
  | 'TAX'
  | 'ACCOUNTING'
  | 'EXOGENA'
  | 'SECURITY'
  | 'ROLES'

export interface CompanySettings {
  id?: string
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
  country: string
  postalCode: string
  phone: string
  email: string
  billingEmail: string
  currency: string
  status: 'ACTIVE' | 'INACTIVE'
  /** Datos fiscales que usa la facturación electrónica DIAN (UBL 2.1). */
  dianDepartmentCode: string
  dianMunicipalityCode: string
  dianOrganizationType: '1' | '2'
  rutResponsibilities: string
  dianTaxLevelCodes: string
  dianTaxSchemeCode: string
  updatedAt: string
}

export interface InventorySettings {
  defaultMinStockThreshold: number
  criticalLowStockThreshold: number
}

export interface POSSettings {
  defaultLocationId: string
  autoPrintReceipt: boolean
}

export interface CashSettings {
  recommendedInitialFloat: number
  maxAllowedInitialFloat: number
  maxDifferenceToleranceAmount: number
}

export interface EcommerceSettings {
  dispatchLocationId: string
  superCatalogEnabled: boolean
  distributorCatalogEnabled: boolean
  whatsappPhone: string
  whatsappQuoteTemplate: string
}

export interface GeneralSettings {
  exogenaDefaultYear: number
  sessionTimeoutMinutes: number
}

export interface LocationOption {
  id: string
  code: string
  name: string
  isEcommerceSource: boolean
}

export interface FiscalOverview {
  resolution: {
    prefix: string
    resolutionNumber: string
    validFrom: string | null
    validTo: string | null
    initialRange: number
    finalRange: number
    lastAssignedNumber: number
    environment: string
  } | null
  software: {
    softwareName: string
    environment: string
    operationMode: string
    certificateExpiration: string | null
  } | null
}

export interface AccountingOverview {
  openPeriods: Array<{ code: string; label: string }>
  defaultAccounts: Array<{ purpose: string; code: string; name: string }>
}

export interface RoleSummary {
  id: string
  code: string
  name: string
  description: string
  scope: string
  permissions: string[]
}

export interface SettingsStats {
  editableSettingsCount: number
  lastModifiedAt: string | null
  lastModifiedBy: string | null
  rolesCount: number
  activeLocationsCount: number
}

export interface CategoryCardInfo {
  id: SettingsCategory
  title: string
  description: string
  iconName: string
  badgeText: string
  badgeTone: 'blue' | 'teal' | 'amber' | 'purple' | 'red' | 'slate'
  isReadOnly?: boolean
}

export type SettingsPermission = 'settings.manage' | 'settings.read' | 'settings.update'

export interface UserSettingsContext {
  userId: string
  companyId?: string
  name: string
  role: string
  permissions: string[]
}
