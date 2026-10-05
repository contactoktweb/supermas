/**
 * SUPER MÁS ERP/POS — Contrato del Procesador de Respuestas DIAN
 *
 * Desempaqueta, parsea y valida las respuestas SOAP y los ApplicationResponse
 * devueltos por los servidores de la DIAN.
 */

import {
  DianFiscalStatus,
  DianTransmissionResult,
} from '../../types/dian.types'

export interface ParsedDianResponse {
  isAccepted: boolean
  fiscalStatus: DianFiscalStatus
  statusCode: string
  statusMessage: string
  cufeOrCude?: string
  trackId?: string
  applicationResponseXml?: string
  validationRulesEvaluated: number
  notifications: Array<{
    code: string
    message: string
    ruleId?: string
    isRejectionError: boolean
  }>
  isTemporaryCommunicationError: boolean
}

export interface IDianResponseProcessor {
  /**
   * Procesa la respuesta en crudo de la DIAN (SOAP XML o JSON de transporte)
   */
  processRawResponse(rawSoapResponse: string): ParsedDianResponse

  /**
   * Extrae y decodifica el ApplicationResponse XML adjunto en la respuesta Base64
   */
  extractApplicationResponseXml(base64ZipOrXml: string): string | null

  /**
   * Mapea el resultado procesado al formato de resultado de transmisión
   */
  toTransmissionResult(parsed: ParsedDianResponse): DianTransmissionResult
}
