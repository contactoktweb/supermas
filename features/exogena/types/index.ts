/**
 * SUPER MÁS ERP/POS - Tipos del Módulo de Exógena Tributaria (Medios Magnéticos DIAN)
 */

export interface ExogenaConcept {
  code: string
  name: string
  accountPrefixes: string[]
  requiresWithholding: boolean
}

export interface ExogenaFormatConfig {
  formatNumber: string
  version: number
  name: string
  description: string
  appliesToSuperMas: boolean
  isEnabled: boolean
  category: string
  legalBasis: string
  minimumThresholdCOP: number
  concepts: ExogenaConcept[]
  recordsCount?: number
  errorsCount?: number
  warningsCount?: number
}

export interface ExogenaYearNormativa {
  year: number
  label: string
  normativaResolution: string
  obligadoType: string
  companyNit: string
  companyName: string
  responsibleName: string
  dueDate: string
  status: 'EN_PREPARACION' | 'FINALIZADO_Y_PRESENTADO' | 'BORRADOR_PREVIO'
  grossRevenueThreshold: number
  withholdingAgentRequired: boolean
  formats: ExogenaFormatConfig[]
}

export interface ExogenaRecord {
  id: string
  year: number
  formatNumber: string
  formatVersion: number
  conceptCode: string
  conceptName: string
  thirdPartyType: 'NIT' | 'CC' | 'CE' | 'PASAPORTE' | 'EXTRANJERO'
  documentNumber: string
  verificationDigit: string
  businessName: string
  firstSurname?: string
  secondSurname?: string
  firstName?: string
  otherNames?: string
  address: string
  city: string
  cityCode: string
  department: string
  departmentCode: string
  country: string
  countryCode: string
  email?: string
  phone?: string
  baseAmount: number
  nonDeductibleAmount?: number
  vatAmount?: number
  withholdingAmount?: number
  vatWithholdingAmount?: number
  sourceType: 'SALE' | 'PURCHASE' | 'INVOICE' | 'ACCOUNTING_ENTRY' | 'CUSTOMER' | 'SUPPLIER'
  sourceId: string
  documentReference: string
  validationStatus: 'VALID' | 'WARNING' | 'ERROR'
  validationNotes?: string[]
}

export interface ExogenaValidationError {
  id: string
  severity: 'ERROR' | 'ADVERTENCIA' | 'INFORMATIVO'
  formatNumber: string
  recordId?: string
  thirdPartyName: string
  thirdPartyDoc: string
  field: string
  currentValue: string
  issueDescription: string
  sourceOrigin: string
  sourceLink?: string
}

export interface ExogenaStats {
  recordsToReportCount: number
  identifiedThirdPartiesCount: number
  enabledFormatsCount: number
  recordsWithErrorsCount: number
  recordsWithWarningsCount: number
  lastGenerationDate: string | null
  lastBatchCode: string | null
  validationStatus: 'VALIDATED' | 'HAS_ERRORS' | 'PENDING' | 'GENERATED'
}

export interface ExogenaConciliationItem {
  id: string
  concept: string
  accountingAccountCode: string
  accountingTotalCOP: number
  exogenaTotalCOP: number
  differenceCOP: number
  status: 'CONCILIATED' | 'DISCREPANCY'
  notes?: string
}

export interface ExogenaGenerationRecord {
  id: string
  year: number
  batchCode: string
  date: string
  userId: string
  userName: string
  userRole: string
  formatsIncluded: string[]
  totalRecords: number
  totalErrors: number
  totalWarnings: number
  status: 'DRAFT' | 'VALIDATING' | 'HAS_ERRORS' | 'VALIDATED' | 'GENERATED'
  fileFormat: 'XML' | 'CSV'
  fileName: string
  fileUrl: string
  checksum: string
  notes: string
}

export type ExogenaPermission =
  | 'exogena.read'
  | 'exogena.configure'
  | 'exogena.generate'
  | 'exogena.validate'
  | 'exogena.export'
  | 'exogena.audit'
