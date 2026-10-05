/**
 * SUPER MÁS ERP/POS — Tipos para Importación Masiva de Productos (Excel / CSV)
 */

export interface RawProductCsvRow {
  [key: string]: string | number | boolean | undefined | null
}

export interface ProductImportRow {
  sku: string
  name: string
  barcode?: string
  categoryName?: string
  brandName?: string
  unitOfMeasure?: string
  costPrice?: number
  publicSalePrice?: number
  wholesalePrice?: number
  minWholesaleQuantity?: number
  taxRatePercent?: number
  isTaxExempt?: boolean
  initialStock?: number
  locationCodeOrName?: string
  minStock?: number
  criticalStock?: number
  webSuperMas?: boolean
  webDistribuidora?: boolean
  description?: string
}

export interface ProductImportRowValidation {
  rowNumber: number
  raw: RawProductCsvRow
  parsed: ProductImportRow
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface ProductImportPreview {
  totalRows: number
  validCount: number
  invalidCount: number
  rows: ProductImportRowValidation[]
  detectedHeaders: string[]
}

export interface ProductImportExecutionResult {
  success: boolean
  totalProcessed: number
  importedCount: number
  failedCount: number
  skippedCount: number
  kardexMovementsCreated: number
  createdProductIds: string[]
  errors: Array<{
    rowNumber: number
    sku?: string
    message: string
  }>
  categoriesCreated: string[]
  brandsCreated: string[]
}
