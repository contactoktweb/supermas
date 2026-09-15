/**
 * SUPER MÁS ERP/POS - Tipos del Módulo de Impuestos
 */

export type TaxType = 'IVA' | 'EXCLUIDO' | 'NO_GRAVADO' | 'OTRO'

export type TaxStatus = 'ACTIVE' | 'INACTIVE'

export interface TaxConfig {
  id: string
  name: string
  code: string
  type: TaxType
  ratePercent: number
  status: TaxStatus
  validFrom: string // YYYY-MM-DD
  validUntil: string | null // YYYY-MM-DD | null
  description?: string
  isDefault?: boolean
  generatedTaxAccountId?: string
  generatedTaxAccountName?: string
  deductibleTaxAccountId?: string
  deductibleTaxAccountName?: string
  version: number
  createdAt: string
  updatedAt: string
  // Métricas agregadas de uso
  associatedProductsCount?: number
  totalSalesTaxAmount?: number
  totalPurchasesTaxAmount?: number
  salesCount?: number
  purchasesCount?: number
}

export interface TaxStats {
  activeConfigsCount: number
  taxedProductsCount: number
  exemptProductsCount: number
  salesWithTaxesCount: number
  purchasesWithTaxesCount: number
  generatedTaxPeriod: number // IVA generado (Ventas)
  deductibleTaxPeriod: number // IVA descontable (Compras)
  netTaxPayable: number // Saldo a pagar / favor
}

export interface TaxFilters {
  query?: string
  type?: TaxType | 'ALL'
  status?: TaxStatus | 'ALL'
  vigencia?: 'ALL' | 'ACTIVE' | 'EXPIRED' | 'FUTURE'
  sortBy?: 'NAME_ASC' | 'NAME_DESC' | 'RATE_ASC' | 'RATE_DESC' | 'CODE_ASC' | 'PRODUCTS_DESC'
  page: number
  pageSize: number
}

export interface TaxAssociatedProduct {
  id: string
  sku: string
  barcode: string
  name: string
  category: string
  brand: string
  normalPrice: number
  wholesalePrice: number
  unitOfMeasure: string
  status: string
  taxProfile: string
  taxConfigId: string
  taxConfigName: string
  ratePercent: number
  totalStock: number
}

export interface TaxCalculationLineInput {
  productId?: string
  productName?: string
  quantity: number
  unitPrice: number
  discountPercent?: number
  discountAmount?: number
  taxConfigId?: string
  customRatePercent?: number
}

export interface TaxCalculationLineResult {
  productId?: string
  productName?: string
  quantity: number
  unitPrice: number
  grossAmount: number
  discountPercent: number
  discountAmount: number
  baseAmount: number
  ratePercent: number
  taxAmount: number
  totalAmount: number
  taxCode: string
  taxType: TaxType
}

export interface TaxBreakdownItem {
  taxConfigId: string
  taxCode: string
  taxName: string
  ratePercent: number
  base: number
  taxAmount: number
}

export interface TaxDocumentCalculationResult {
  lines: TaxCalculationLineResult[]
  grossTotal: number
  discountTotal: number
  baseTotal: number
  taxTotal: number
  grandTotal: number
  taxBreakdown: TaxBreakdownItem[]
}

export interface TaxReportItem {
  id: string
  documentNumber: string
  documentType: 'SALE' | 'PURCHASE' | 'INVOICE'
  date: string
  locationId?: string
  locationName?: string
  thirdPartyDoc: string
  thirdPartyName: string
  taxConfigCode: string
  taxConfigName: string
  ratePercent: number
  baseAmount: number
  taxAmount: number
  totalAmount: number
  operationType: 'GENERATED' | 'DEDUCTIBLE'
}

export interface TaxReportSummary {
  generatedTaxes: number
  deductibleTaxes: number
  netBalance: number
  totalBaseSales: number
  totalBasePurchases: number
  recordsCount: number
  byLocation: Array<{ locationName: string; generated: number; deductible: number }>
  byRate: Array<{ ratePercent: number; label: string; generated: number; deductible: number }>
}

export interface TaxReportFilters {
  dateFrom?: string
  dateUntil?: string
  taxConfigId?: string | 'ALL'
  locationId?: string | 'ALL'
  documentType?: 'ALL' | 'SALE' | 'PURCHASE' | 'INVOICE'
}

export interface TaxAuditLogEntry {
  id: string
  action: 'TAX_CONFIG_CREATED' | 'TAX_CONFIG_UPDATED' | 'TAX_CONFIG_DEACTIVATED' | 'TAX_CONFIG_ACTIVATED' | 'TAX_RATE_CHANGED'
  taxConfigId: string
  taxConfigCode: string
  taxConfigName: string
  userId: string
  userName: string
  timestamp: string
  changes: {
    field?: string
    previousValue?: unknown
    newValue?: unknown
    details: string
  }
}

export type TaxPermission =
  | 'tax.read'
  | 'tax.create'
  | 'tax.update'
  | 'tax.deactivate'
  | 'tax.assign'
  | 'tax.report'
  | 'tax.export'
