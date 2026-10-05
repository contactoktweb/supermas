/**
 * SUPER MÁS ERP/POS — Contrato del Orquestador de Facturación Electrónica DIAN
 *
 * Coordina el ciclo de vida fiscal completo:
 * 1. Validación previa de datos y resolución
 * 2. Asignación de consecutivo e idempotencia
 * 3. Cálculo de CUFE / CUDE
 * 4. Construcción del XML UBL 2.1
 * 5. Firma digital XAdES-BES
 * 6. Transmisión al WebService DIAN (Software Propio)
 * 7. Procesamiento de respuesta y actualización de estado
 * 8. Registro de evento inmutable y auditoría
 * 9. Desencadenamiento de causación contable y actualización en POS
 */

import {
  Invoice,
  InvoiceUserContext,
} from '../../types'
import {
  DianFiscalStatus,
  DianTransmissionResult,
  DianCreditNoteReasonCode,
} from '../../types/dian.types'

export interface EmitInvoiceInput {
  saleId: string
  companyId: string
  locationId: string
  idempotencyKey: string
  user: InvoiceUserContext
}

export interface EmitCreditNoteInput {
  originalInvoiceId: string
  returnId?: string // Opcional si proviene de devolución de inventario
  discrepancyReasonCode: DianCreditNoteReasonCode
  reasonDescription: string
  idempotencyKey: string
  user: InvoiceUserContext
}

export interface RetryTransmissionInput {
  invoiceId: string
  user: InvoiceUserContext
}

export interface IDianOrchestrator {
  /**
   * Emite una Factura Electrónica de Venta a partir de una venta confirmada
   */
  emitElectronicInvoice(input: EmitInvoiceInput): Promise<{
    invoice: Invoice
    transmissionResult: DianTransmissionResult
    status: DianFiscalStatus
  }>

  /**
   * Emite una Nota Crédito Electrónica vinculada a su factura original
   */
  emitCreditNote(input: EmitCreditNoteInput): Promise<{
    creditNote: Invoice
    transmissionResult: DianTransmissionResult
    status: DianFiscalStatus
  }>

  /**
   * Reintenta la transmisión de un documento pendiente o con error de comunicación
   */
  retryTransmission(input: RetryTransmissionInput): Promise<{
    invoice: Invoice
    transmissionResult: DianTransmissionResult
    status: DianFiscalStatus
  }>

  /**
   * Consulta el estado de un documento directamente ante los servidores de la DIAN
   */
  queryDocumentStatus(invoiceId: string): Promise<{
    invoice: Invoice
    status: DianFiscalStatus
    message: string
  }>
}
