/**
 * SUPER MÁS ERP/POS — Tipos para Importación Masiva de Productos (Excel / CSV)
 */

export interface RawProductCsvRow {
  [key: string]: string | number | boolean | undefined | null
}

export type ProductImportIvaTreatment = 'GRAVADO' | 'EXENTO' | 'EXCLUIDO'

/** Qué se hará con la fila: crear, actualizar, nada (ya está igual) o no se puede importar. */
export type ProductImportAction = 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'ERROR'

export interface ProductImportRow {
  /** Fila del archivo (la cabecera es la 1) */
  rowNumber?: number
  /** Producto existente con ese SKU: la fila lo actualiza en lugar de crearlo */
  existingProductId?: string
  /** Columnas que traen valor: en una actualización, las celdas vacías no cambian nada */
  provided?: Partial<Record<keyof ProductImportRow, boolean>>
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
  ivaTreatment?: ProductImportIvaTreatment | null
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
  action: ProductImportAction
  /** Solo actualizaciones: cambios frente al producto actual ("Costo: 3.200 → 3.300,5") */
  changes: string[]
  /** Bodega donde entraría el stock inicial */
  locationName?: string
  errors: string[]
  warnings: string[]
}

export interface ProductImportPreview {
  totalRows: number
  /** Filas que se pueden aplicar (nuevas + actualizaciones) */
  validCount: number
  createCount: number
  updateCount: number
  unchangedCount: number
  invalidCount: number
  rows: ProductImportRowValidation[]
  detectedHeaders: string[]
}

export interface ProductImportExecutionResult {
  success: boolean
  totalProcessed: number
  /** Productos creados + actualizados */
  importedCount: number
  createdCount: number
  updatedCount: number
  /** Productos cuyo cambio de precio quedó esperando aprobación */
  pricePendingCount: number
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
