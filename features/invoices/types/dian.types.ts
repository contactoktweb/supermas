/**
 * SUPER MÁS ERP/POS — SUBSISTEMA DE FACTURACIÓN ELECTRÓNICA DIAN (COLOMBIA)
 * Especificación Técnica Formal según Resolución 000165 de 2023 y Anexo Técnico 1.9
 *
 * Módulo de Definición de Tipos, Enums, Máquina de Estados y Contratos de Dominio.
 */

// ============================================================================
// 1. ENUMS Y CONSTANTES OFICIALES DIAN
// ============================================================================

/**
 * Códigos oficiales de tipo de documento DIAN (Anexo Técnico 1.9)
 */
export type DianDocumentTypeCode =
  | '01' // Factura Electrónica de Venta
  | '02' // Factura de Exportación
  | '03' // Factura Electrónica por Contingencia Facturador
  | '04' // Factura Electrónica por Contingencia DIAN
  | '91' // Nota Crédito Electrónica
  | '92' // Nota Débito Electrónica
  | '20' // Documento Equivalente Electrónico POS

export type DianInternalDocumentType = 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE'

/**
 * Tipos de Ambiente DIAN
 * 1: Producción
 * 2: Pruebas / Habilitación
 */
export type DianEnvironment = 'HABILITACION' | 'PRODUCCION'
export type DianEnvironmentCode = '1' | '2'

/**
 * Tipos de Operación Factura de Venta (Catálogo DIAN)
 * 10: Estándar
 * 09: AIU (Administración, Imprevistos, Utilidad)
 * 11: Mandatos
 */
export type DianOperationType = '10' | '09' | '11'

/**
 * Conceptos oficiales para Nota Crédito (Catálogo DIAN)
 */
export type DianCreditNoteReasonCode =
  | '1' // Devolución parcial de los bienes y/o no aceptación parcial del servicio
  | '2' // Anulación de factura electrónica
  | '3' // Rebaja o descuento parcial o total
  | '4' // Ajuste de precio
  | '5' // Otros

/**
 * Conceptos oficiales para Nota Débito (Catálogo DIAN)
 */
export type DianDebitNoteReasonCode =
  | '1' // Intereses
  | '2' // Gastos por cobrar
  | '3' // Cambio del valor
  | '4' // Otros

/**
 * Códigos de Impuesto DIAN (Tributos Nacionales y Locales)
 */
export type DianTaxCode =
  | '01' // IVA (Impuesto sobre las Ventas)
  | '04' // INC (Impuesto Nacional al Consumo)
  | '03' // ICA (Impuesto de Industria y Comercio)
  | '05' // ReteIVA
  | '06' // ReteFuente
  | '07' // ReteICA
  | 'ZZ' // No aplica / Exento

/**
 * Formas de Pago DIAN
 * 1: Contado
 * 2: Crédito
 */
export type DianPaymentFormCode = '1' | '2'

/**
 * Medios de Pago más comunes (Catálogo 5.3.3.4 Anexo Técnico 1.9)
 */
export type DianPaymentMethodCode =
  | '10' // Efectivo
  | '42' // Consignación / Transferencia Bancaria
  | '48' // Tarjeta de Crédito
  | '49' // Tarjeta de Débito
  | '1'  // Instrumento no definido

// ============================================================================
// 2. MÁQUINA DE ESTADOS FISCALES Y DE TRANSMISIÓN
// ============================================================================

/**
 * Estados del ciclo de vida de un documento electrónico fiscal
 */
export type DianFiscalStatus =
  | 'DRAFT'                      // Borrador local no procesado
  | 'PENDING_VALIDATION'        // En cola para validación fiscal previa
  | 'VALIDATION_FAILED'          // Rechazado localmente por datos incompletos/inválidos
  | 'SIGNING'                    // Generando UBL 2.1 y firma digital XAdES-BES
  | 'SIGNED'                     // Firmado digitalmente con éxito
  | 'TRANSMITTING'               // Enviando al WebService SOAP de la DIAN
  | 'ACCEPTED'                   // Validado y Aceptado por la DIAN (ApplicationResponse 00)
  | 'ACCEPTED_WITH_OBSERVATIONS' // Aceptado por la DIAN con observaciones
  | 'REJECTED'                   // Rechazado formalmente por la DIAN con código de error
  | 'COMMUNICATION_ERROR'        // Error de red, timeout o caída de la DIAN (Reintentable)
  | 'CANCELLED'                  // Anulado administrativamente con Nota Crédito

/**
 * Mapeo al enum de base de datos existente (public.dian_status_type)
 */
export type DbDianStatus =
  | 'PENDING'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ACCEPTED_WITH_OBSERVATIONS'

/**
 * Matriz de transiciones permitidas en la máquina de estados
 */
export const DIAN_ALLOWED_TRANSITIONS: Record<DianFiscalStatus, DianFiscalStatus[]> = {
  DRAFT: ['PENDING_VALIDATION', 'VALIDATION_FAILED'],
  PENDING_VALIDATION: ['VALIDATION_FAILED', 'SIGNING'],
  VALIDATION_FAILED: ['PENDING_VALIDATION', 'DRAFT'],
  SIGNING: ['SIGNED', 'VALIDATION_FAILED'],
  SIGNED: ['TRANSMITTING', 'COMMUNICATION_ERROR'],
  TRANSMITTING: ['ACCEPTED', 'ACCEPTED_WITH_OBSERVATIONS', 'REJECTED', 'COMMUNICATION_ERROR'],
  ACCEPTED: ['CANCELLED'], // Una factura aceptada solo cambia si se anula con Nota Crédito
  ACCEPTED_WITH_OBSERVATIONS: ['CANCELLED'],
  REJECTED: ['PENDING_VALIDATION', 'DRAFT'], // Permite corregir y retransmitir si no se consumió consecutivo
  COMMUNICATION_ERROR: ['TRANSMITTING', 'PENDING_VALIDATION'], // Reintentos permitidos
  CANCELLED: [], // Estado terminal
}

// ============================================================================
// 3. ESTRUCTURAS DE DATOS FISCALES (DTOs)
// ============================================================================

export interface FiscalPartyIdentification {
  documentType: 'NIT' | 'CC' | 'CE' | 'PASAPORTE' | 'TI' | 'DIE'
  documentNumber: string
  dv?: string
  legalName: string
  commercialName?: string
  fiscalRegime: '48' | '49' // 48 = Responsable de IVA, 49 = No responsable
  taxLevelCode?: string
  economicActivityCode?: string
  address: string
  cityCode: string // Código Dane 5 dígitos, ej: 05001
  cityName: string
  departmentCode: string // Código Dane 2 dígitos, ej: 05
  departmentName: string
  countryCode: string // 'CO'
  countryName: string
  email: string
  phone?: string
}

export interface FiscalTaxSubtotal {
  taxCode: DianTaxCode
  taxName: string
  ratePercent: number
  taxableBase: number
  taxAmount: number
}

export interface FiscalDocumentLine {
  lineNumber: number
  productId: string
  sku: string
  barcode?: string
  description: string
  unitOfMeasure: string // Ej. 'EA' (Unidad), 'KGM' (Kilos)
  quantity: number
  unitPrice: number
  grossAmount: number
  discountPercent: number
  discountAmount: number
  taxableBase: number
  taxes: FiscalTaxSubtotal[]
  totalTaxAmount: number
  netAmount: number
}

export interface FiscalTotals {
  lineExtensionAmount: number // Total bruto antes de tributos y descuentos
  taxExclusiveAmount: number  // Total base imponible neta
  taxInclusiveAmount: number  // Total bruto + impuestos
  allowanceTotalAmount: number // Total descuentos
  chargeTotalAmount: number    // Total cargos adicionales
  payableAmount: number        // Total a pagar final
  currency: 'COP'
}

export interface FiscalPaymentDetails {
  paymentForm: DianPaymentFormCode
  paymentMethod: DianPaymentMethodCode
  dueDate: string // YYYY-MM-DD
  paymentTermsDescription?: string
}

// ============================================================================
// 4. ENTIDADES DE DOMINIO Y CONFIGURACIÓN
// ============================================================================

/**
 * Representa la configuración técnica del software propio DIAN
 * (Almacenada en public.dian_software_config)
 */
export interface DianSoftwareConfiguration {
  id: string
  companyId: string
  softwareId: string
  softwareName: string
  pinSecretRef: string // Referencia al secreto en .env o vault, ¡NUNCA valor en texto plano!
  environment: DianEnvironment
  operationMode: 'SOFTWARE_PROPIO'
  certificateAlias?: string
  certificateSecretRef?: string
  certificateIssuer?: string
  certificateValidFrom?: string
  certificateExpiration?: string
  testSetId?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Representa una resolución de numeración oficial autorizada por la DIAN
 * (Almacenada en public.dian_resolutions)
 */
export interface DianResolutionRecord {
  id: string
  companyId: string
  locationId?: string
  dianPrefix: string
  resolutionNumber: string
  resolutionDate: string
  validFrom: string
  validTo: string
  initialRange: number
  finalRange: number
  currentNumber: number
  documentType: DianInternalDocumentType
  technicalKey?: string // Clave técnica DIAN de la resolución
  environment: DianEnvironment
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Evento de trazabilidad e inmutabilidad fiscal DIAN
 * (Almacenado en public.dian_events)
 */
export interface DianEventRecord {
  id: string
  invoiceId: string
  companyId: string
  eventType:
    | 'INVOICE_GENERATED'
    | 'XML_BUILT'
    | 'DIGITAL_SIGNATURE_APPLIED'
    | 'DIAN_TRANSMISSION_ATTEMPT'
    | 'DIAN_RESPONSE_ACCEPTED'
    | 'DIAN_RESPONSE_REJECTED'
    | 'DIAN_RETRY_SCHEDULED'
    | 'CREDIT_NOTE_ISSUED'
  status: 'SUCCESS' | 'ERROR' | 'INFO'
  environment: DianEnvironment
  payloadSent?: Record<string, any> // Sanitizado sin secretos
  responseReceived?: Record<string, any>
  createdAt: string
  createdByUserId?: string
}

// ============================================================================
// 5. PARÁMETROS CRIPTOGRÁFICOS Y DE IDENTIFICACIÓN FISCAL
// ============================================================================

export interface CufeCalculationInput {
  numFac: string        // Prefijo + Número
  fecFac: string        // YYYY-MM-DD
  horFac: string        // HH:mm:ss-05:00
  valFac: number        // Valor base
  codImp1: string       // '01' (IVA)
  valImp1: number       // Valor IVA
  codImp2: string       // '04' (Consumo)
  valImp2: number       // Valor Consumo
  codImp3: string       // '03' (ICA u otro)
  valImp3: number       // Valor otro impuesto
  valTot: number        // Valor total documento
  nitOfe: string        // NIT Emisor sin DV
  numAdq: string        // NIT/Cédula Adquiriente
  clTec: string         // Clave técnica DIAN
  tipoAmbiente: DianEnvironmentCode // '1' o '2'
}

export interface CudeCalculationInput {
  numDoc: string        // Prefijo + Número Nota Crédito/Débito
  fecDoc: string        // YYYY-MM-DD
  horDoc: string        // HH:mm:ss-05:00
  valDoc: number        // Valor base
  codImp1: string       // '01' (IVA)
  valImp1: number       // Valor IVA
  codImp2: string       // '04'
  valImp2: number
  codImp3: string       // '03'
  valImp3: number
  valTot: number        // Valor total documento
  nitOfe: string        // NIT Emisor sin DV
  numAdq: string        // NIT/Cédula Adquiriente
  pin: string           // PIN del Software DIAN
  tipoAmbiente: DianEnvironmentCode // '1' o '2'
}

export interface SoftwareSecurityCodeInput {
  softwareId: string
  pin: string
  documentNumber: string
}

// ============================================================================
// 6. RESULTADOS DE TRANSMISIÓN Y PROCESAMIENTO
// ============================================================================

export interface DianTransmissionResult {
  success: boolean
  statusCode: string
  status: DianFiscalStatus
  cufeOrCude: string
  trackId?: string
  dianMessage: string
  validationErrors: Array<{
    code: string
    message: string
    ruleId?: string
    severity: 'ERROR' | 'WARNING'
  }>
  applicationResponseXml?: string
  responseReceivedAt: string
  isRetryable: boolean
}

export interface DianStatusQueryResult {
  statusCode: string
  statusDescription: string
  cufe: string
  isValid: boolean
  rawResponse?: string
}
