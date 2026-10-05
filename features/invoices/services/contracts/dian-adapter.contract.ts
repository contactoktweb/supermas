/**
 * SUPER MÁS ERP/POS — Contrato del Adaptador de Comunicación DIAN
 *
 * Abstrae la comunicación con el WebService SOAP VPFE de la DIAN para
 * Software Propio (o futuro proveedor si se requiriera en fases posteriores).
 */

import {
  DianEnvironment,
  DianTransmissionResult,
  DianStatusQueryResult,
} from '../../types/dian.types'

export interface DianTransmissionPayload {
  fileName: string // Ej. 'face_f09008421090002600000001.xml'
  contentBase64Zip: string // Contenido XML comprimido en ZIP y codificado en Base64
  documentNumber: string
  cufeOrCude: string
  environment: DianEnvironment
  testSetId?: string // Obligatorio en habilitación
}

export interface IDianAdapter {
  readonly adapterName: string

  /**
   * Envía sincrónicamente o asincrónicamente el documento firmado a la DIAN (SendBillSync / SendBillAsync)
   */
  sendBill(payload: DianTransmissionPayload): Promise<DianTransmissionResult>

  /**
   * Envía un paquete del set de pruebas en ambiente de habilitación (SendTestSetAsync)
   */
  sendTestSet?(payload: DianTransmissionPayload): Promise<DianTransmissionResult>

  /**
   * Consulta el estado de un documento mediante su identificador o CUFE (GetStatus / GetStatusZip)
   */
  getStatus(trackIdOrCufe: string, environment: DianEnvironment): Promise<DianStatusQueryResult>

  /**
   * Valida la conectividad y disponibilidad del servicio WebService DIAN
   */
  ping(environment: DianEnvironment): Promise<{ isAvailable: boolean; latencyMs: number }>
}
