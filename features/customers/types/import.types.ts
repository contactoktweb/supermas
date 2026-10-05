/**
 * SUPER MÁS ERP/POS — Tipos para Importación Masiva de Clientes (Excel / CSV)
 */

export interface RawCustomerCsvRow {
  [key: string]: string | number | boolean | undefined | null
}

export interface CustomerImportRow {
  documentType: string
  documentNumber: string
  verificationDigit?: string
  name: string
  commercialName?: string
  personType: 'NATURAL' | 'COMPANY'
  category?: 'RETAIL' | 'WHOLESALE' | 'SPECIAL' | 'FREQUENT'
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  department?: string
  creditLimit?: number
  creditDays?: number
  notes?: string
}

export interface CustomerImportRowValidation {
  rowNumber: number
  raw: RawCustomerCsvRow
  parsed: CustomerImportRow
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface CustomerImportPreview {
  totalRows: number
  validCount: number
  invalidCount: number
  rows: CustomerImportRowValidation[]
  detectedHeaders: string[]
}

export interface CustomerImportExecutionResult {
  success: boolean
  totalProcessed: number
  importedCount: number
  failedCount: number
  skippedCount: number
  createdCustomerIds: string[]
  errors: Array<{
    rowNumber: number
    documentNumber?: string
    message: string
  }>
}
