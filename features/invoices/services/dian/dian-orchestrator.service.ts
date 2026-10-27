/**
 * SUPER MÁS ERP/POS — Orquestador de Facturación Electrónica DIAN (solo servidor)
 *
 * Flujo:
 *   VENTA → numeración atómica (SQL) → documento fiscal → CUFE + SoftwareSecurityCode + QR
 *   → XML UBL 2.1 → firma XAdES-BES → ZIP → SOAP DIAN → respuesta → persistencia + eventos.
 *
 * Reglas:
 *  - Nunca marca ACEPTADA sin respuesta real de la DIAN (IsValid=true).
 *  - Un error de red no consume un nuevo consecutivo: la factura queda en COMMUNICATION_ERROR
 *    y se reintenta con el mismo número y el mismo CUFE.
 *  - Si falta configuración (PIN, clave técnica, certificado), la factura queda en
 *    BLOCKED_CONFIG o XML_BUILT con el motivo exacto, sin inventar datos.
 *  - Los secretos jamás se escriben en BD, eventos ni respuestas.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientSafeDatabaseMessage, logDatabaseError } from '@/lib/errors/database-error'
import { DianConfig, getDianConfig, validateDianConfiguration } from './dian.config'
import {
  buildInvoiceDocument,
  DianInvoiceDocument,
  DianInvoiceInput,
  DianDocumentError,
  DianDocumentKind,
  dianPaymentMeansCode,
  CREDIT_NOTE_CONCEPTS,
  DEBIT_NOTE_CONCEPTS,
} from './dian-document'
import { dianCryptoService } from './dian-crypto.service'
import { dianUblBuilderService } from './dian-ubl-builder.service'
import { serialize } from './xml/xml-tree'
import { loadSigningCertificate, DianCertificateError } from './dian-certificate'
import { bogotaTimestamp, signUblDocument } from './dian-xades-signer'
import { zipSingleFile } from './dian-zip'
import { DianCommunicationError, DianSoapAdapter, DianSoapResult, dianFileNames } from './dian-soap.adapter'

export type TransmissionState =
  | 'PENDING'
  | 'NUMBERED'
  | 'XML_BUILT'
  | 'SIGNED'
  | 'SENDING'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COMMUNICATION_ERROR'
  | 'BLOCKED_CONFIG'
  /** Documento anterior a la habilitación (migración 058): sin resolución, nunca se transmite. */
  | 'LEGACY'

export interface DianProcessResult {
  invoiceId: string
  documentNumber: string
  transmissionState: TransmissionState
  dianStatus: 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED'
  cufe: string | null
  trackId: string | null
  message: string
  dianErrors: string[]
}

export interface DianActor {
  userId: string
  companyId: string
}

export interface NoteRequest {
  originalInvoiceId: string
  documentType: 'CREDIT_NOTE' | 'DEBIT_NOTE'
  conceptCode: string
  reason: string
  /** Ver fn_create_electronic_note (migración 060) para el formato de cada línea */
  lines?: Array<Record<string, unknown>>
  returnId?: string | null
}

export class DianOrchestratorError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message)
    this.name = 'DianOrchestratorError'
  }
}

const num = (v: any) => Number(v || 0)

/** Respuesta de la DIAN cuando el set de pruebas ya fue aceptado y no valida más documentos. */
const TEST_SET_CLOSED_PATTERN = /set de prueba con identificador .+ se encuentra aceptado/i

/** Regla 90: la DIAN ya había recibido el documento. */
const ALREADY_PROCESSED_PATTERN = /Regla:\s*90\b|procesad[oa] anteriormente|ya (fue|ha sido) procesad/i

export class DianOrchestratorService {
  constructor(
    private readonly admin: SupabaseClient<any, 'public', any> = createAdminClient(),
    private readonly config: DianConfig = getDianConfig()
  ) {}

  // ----------------------------------------------------------------------------
  // 1. Emisión desde una venta
  // ----------------------------------------------------------------------------

  /**
   * Crea la factura (consecutivo atómico, idempotente) y la procesa hasta donde la configuración lo permita.
   * @param userClient cliente con el JWT del usuario: la función SQL valida empresa y permiso invoices.create.
   */
  async emitFromSale(
    userClient: SupabaseClient<any, 'public', any>,
    actor: DianActor,
    saleId: string,
    idempotencyKey: string
  ): Promise<DianProcessResult & { idempotentReplay: boolean }> {
    const software = await this.loadSoftwareConfig(actor.companyId)

    // Verificar configuración ANTES de consumir un consecutivo DIAN.
    const problems = [...validateDianConfiguration(this.config).errors]
    if (!software?.software_id) problems.push('Falta el Software ID en dian_software_config.')
    if (this.config.environment === 'HABILITACION' && !software?.test_set_id) problems.push('Falta el TestSetId en dian_software_config.')
    const { data: company } = await this.admin
      .from('companies')
      .select('tax_id, verification_digit, address, dian_municipality_code, dian_department_code, dian_tax_level_codes')
      .eq('id', actor.companyId)
      .maybeSingle()
    if (!company?.tax_id || !company?.verification_digit) problems.push('Faltan NIT/DV de la empresa.')
    if (!company?.address) problems.push('Falta la dirección de la empresa.')
    if (!/^[0-9]{5}$/.test(company?.dian_municipality_code || '')) problems.push('Falta el código DANE del municipio de la empresa.')
    if (!/^[0-9]{2}$/.test(company?.dian_department_code || '')) problems.push('Falta el código DANE del departamento de la empresa.')
    if (!company?.dian_tax_level_codes) problems.push('Faltan las responsabilidades fiscales DIAN de la empresa (TaxLevelCode).')
    if (problems.length) {
      throw new DianOrchestratorError(`No se emitió la factura (no se consumió consecutivo). Falta: ${problems.join(' ')}`, 400)
    }

    const { data, error } = await userClient.rpc('fn_create_electronic_invoice_from_sale', {
      p_sale_id: saleId,
      p_idempotency_key: idempotencyKey,
      p_environment: this.config.environment,
      p_software_id: software?.software_id || null,
    })
    if (error) {
      const message = clientSafeDatabaseMessage('DIAN emitir factura', error, 'No se pudo emitir la factura electrónica.')
      throw new DianOrchestratorError(message, error.code === '42501' ? 403 : 400)
    }
    const invoiceId = String(data.invoice_id)
    const result = await this.process(actor, invoiceId)
    return { ...result, idempotentReplay: Boolean(data.idempotent_replay) }
  }

  // ----------------------------------------------------------------------------
  // 1b. Emisión de nota crédito / débito sobre una factura aceptada
  // ----------------------------------------------------------------------------

  /**
   * Crea la nota (consecutivo atómico, idempotente, validada contra la factura original y contabilizada)
   * y la procesa: CUDE, XML, firma y envío.
   * @param userClient cliente con el JWT del usuario: la función SQL valida empresa y permiso invoices.cancel.
   */
  async emitNote(
    userClient: SupabaseClient<any, 'public', any>,
    actor: DianActor,
    note: NoteRequest,
    idempotencyKey: string
  ): Promise<DianProcessResult & { idempotentReplay: boolean }> {
    const software = await this.loadSoftwareConfig(actor.companyId)
    const report = validateDianConfiguration(this.config)
    const problems: string[] = []
    if (!report.checks.pinConfigured) problems.push('DIAN_SOFTWARE_PIN no está configurado (requerido para el CUDE).')
    if (!software?.software_id) problems.push('Falta el Software ID en dian_software_config.')
    if (this.config.environment === 'HABILITACION' && !software?.test_set_id) problems.push('Falta el TestSetId en dian_software_config.')
    if (problems.length) {
      throw new DianOrchestratorError(`No se emitió la nota (no se consumió consecutivo). Falta: ${problems.join(' ')}`, 400)
    }

    const { data, error } = await userClient.rpc('fn_create_electronic_note', {
      p_original_invoice_id: note.originalInvoiceId,
      p_document_type: note.documentType,
      p_concept_code: note.conceptCode,
      p_reason: note.reason,
      p_lines: note.lines && note.lines.length ? note.lines : null,
      p_return_id: note.returnId || null,
      p_idempotency_key: idempotencyKey,
      p_environment: this.config.environment,
    })
    if (error) {
      const message = clientSafeDatabaseMessage('DIAN emitir nota', error, 'No se pudo emitir la nota electrónica.')
      throw new DianOrchestratorError(message, error.code === '42501' ? 403 : 400)
    }
    const noteId = String(data.note_id)
    const result = await this.process(actor, noteId)
    return { ...result, idempotentReplay: Boolean(data.idempotent_replay) }
  }

  // ----------------------------------------------------------------------------
  // 2. Procesamiento / reintento de un documento ya numerado (factura o nota)
  // ----------------------------------------------------------------------------

  async process(actor: DianActor, invoiceId: string): Promise<DianProcessResult> {
    const inv = await this.loadInvoice(actor.companyId, invoiceId)
    const documentNumber = `${inv.prefix}${inv.number}`

    if (inv.dian_status === 'ACCEPTED') {
      return this.result(inv, 'ACCEPTED', 'La DIAN ya aceptó este documento. No se reenvía.')
    }
    if (inv.transmission_state === 'SENT' && inv.dian_track_id) {
      return this.checkStatus(actor, invoiceId)
    }
    if (inv.transmission_state === 'LEGACY') {
      return this.result(inv, 'LEGACY', 'Documento anterior a la habilitación DIAN: no tiene resolución de numeración y no se transmite.')
    }

    // Reserva atómica (LEGACY no está en la lista: el servidor nunca lo toma): solo un proceso a la vez genera/firma/transmite esta factura.
    const previousState: TransmissionState = inv.transmission_state
    const claimable = ['PENDING', 'NUMBERED', 'XML_BUILT', 'SIGNED', 'COMMUNICATION_ERROR', 'BLOCKED_CONFIG', 'REJECTED']
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: claimed, error: claimErr } = await this.admin
      .from('electronic_invoices')
      .update({ transmission_state: 'SENDING', updated_at: new Date().toISOString() })
      .eq('id', inv.id)
      .or(`transmission_state.in.(${claimable.join(',')}),and(transmission_state.eq.SENDING,updated_at.lt.${staleBefore})`)
      .select('id')
    if (claimErr) {
      logDatabaseError('DIAN reservar factura', claimErr)
      throw new DianOrchestratorError('No se pudo reservar la factura para su procesamiento.', 500)
    }
    if (!claimed || claimed.length === 0) {
      return this.result(inv, inv.transmission_state, 'Otro proceso está generando o enviando esta factura. Espere unos segundos y consulte de nuevo.')
    }

    try {
      return await this.processClaimed(actor, inv, previousState)
    } catch (e: any) {
      // Nunca dejar la factura bloqueada en SENDING
      await this.update(inv.id, {
        transmission_state: previousState === 'SENDING' ? 'COMMUNICATION_ERROR' : previousState,
        last_error: e?.message || String(e),
      }).catch(() => undefined)
      throw e
    }
  }

  private async processClaimed(actor: DianActor, inv: any, previousState: TransmissionState): Promise<DianProcessResult> {
    inv = await this.refreshStaleIssueDate(actor, inv)

    // a) Documento fiscal desde la BD (misma fuente para XML, CUFE y QR)
    const kind: DianDocumentKind = inv.document_type
    let doc: DianInvoiceDocument
    try {
      doc = buildInvoiceDocument(kind === 'INVOICE' ? await this.loadDocumentInput(inv) : await this.loadNoteInput(inv))
    } catch (e: any) {
      if (!(e instanceof DianDocumentError)) console.error('[DIAN] Error armando el documento fiscal:', e?.message || String(e))
      const problems = e instanceof DianDocumentError ? e.problems : ['No se pudieron cargar los datos fiscales del documento.']
      await this.update(inv.id, { transmission_state: 'BLOCKED_CONFIG', last_error: problems.join(' | ') })
      await this.event(actor, inv, 'VALIDATION_FAILED', 'ERROR', null, { problems })
      return this.result({ ...inv, transmission_state: 'BLOCKED_CONFIG' }, 'BLOCKED_CONFIG', 'Datos fiscales incompletos.', problems)
    }

    // b) Totales del documento deben coincidir con la factura numerada
    const totalFromDoc = doc.totals.payableCents / 100
    if (Math.abs(totalFromDoc - num(inv.total_amount)) > 0.01) {
      const msg = `El total recalculado (${totalFromDoc}) no coincide con el total registrado (${inv.total_amount}).`
      await this.update(inv.id, { transmission_state: 'BLOCKED_CONFIG', last_error: msg })
      return this.result({ ...inv, transmission_state: 'BLOCKED_CONFIG' }, 'BLOCKED_CONFIG', msg, [msg])
    }

    // c) Secretos: CUFE (factura: clave técnica + PIN) o CUDE (nota: solo PIN)
    const report = validateDianConfiguration(this.config)
    const isNote = kind !== 'INVOICE'
    const canBuildXml = isNote ? report.checks.pinConfigured : report.canBuildXml
    const canSign = canBuildXml && report.checks.certificateConfigured && report.checks.certificatePasswordConfigured
    if (!canBuildXml) {
      const errors = isNote ? report.errors.filter((e) => !/TECHNICAL_KEY/.test(e)) : report.errors
      await this.update(inv.id, { transmission_state: 'BLOCKED_CONFIG', last_error: errors.join(' | ') })
      await this.event(actor, inv, 'CONFIG_MISSING', 'ERROR', null, { errors })
      return this.result({ ...inv, transmission_state: 'BLOCKED_CONFIG' }, 'BLOCKED_CONFIG', 'Falta configuración DIAN en el servidor.', errors)
    }

    const cufe = dianCryptoService.calculateDocumentKey(doc, { technicalKey: this.config.secrets.technicalKey, pin: this.config.secrets.pin })
    if (inv.cufe && inv.cufe !== cufe) {
      const msg = isNote
        ? 'El CUDE recalculado no coincide con el guardado: los datos de la nota cambiaron después de emitirla.'
        : 'El CUFE recalculado no coincide con el guardado: los datos de la venta cambiaron después de emitir. Requiere nota crédito.'
      await this.update(inv.id, { last_error: msg })
      throw new DianOrchestratorError(msg, 409)
    }
    const ssc = dianCryptoService.calculateSoftwareSecurityCode({
      softwareId: doc.input.softwareId,
      pin: this.config.secrets.pin!,
      documentNumber: doc.documentId,
    })
    const qr = dianCryptoService.buildQRCodeContent(doc, cufe, this.config.endpoints.qrBaseUrl)
    const tree = dianUblBuilderService.buildDocumentTree(doc, { cufe, softwareSecurityCode: ssc, qrCodeContent: qr })
    const xmlUnsigned = serialize(tree, true)
    const files = dianFileNames(doc.input.issuer.nit, doc.input.issueDate, inv.number, kind)

    await this.update(inv.id, {
      cufe,
      qr_code_data: qr,
      software_security_code: ssc,
      xml_unsigned: xmlUnsigned,
      xml_file_name: files.xml,
      zip_file_name: files.zip,
      transmission_state: 'XML_BUILT',
      last_error: null,
    })
    if (inv.transmission_state !== 'XML_BUILT') {
      await this.event(actor, inv, 'XML_BUILT', 'SUCCESS', { cufe, file: files.xml }, null)
    }

    // d) Firma digital
    if (!canSign) {
      const msg = `XML, ${isNote ? 'CUDE' : 'CUFE'} y QR generados. Falta el certificado digital para firmar y transmitir.`
      await this.update(inv.id, { last_error: msg })
      return this.result({ ...inv, cufe, transmission_state: 'XML_BUILT' }, 'XML_BUILT', msg, report.warnings)
    }

    let xmlSigned: string
    try {
      const cert = loadSigningCertificate(this.config.secrets.certificateBase64, this.config.secrets.certificatePassword)
      signUblDocument(tree, cert)
      xmlSigned = serialize(tree, true)
      await this.update(inv.id, { xml_signed: xmlSigned, transmission_state: 'SIGNED' })
      await this.event(actor, inv, 'DIGITAL_SIGNATURE_APPLIED', 'SUCCESS', { certificate: cert.subjectCommonName }, null)

      // e) Transmisión
      const zip = zipSingleFile(files.xml, xmlSigned)
      const adapter = new DianSoapAdapter(this.config.endpoints.wsUrl, cert, this.config.httpTimeoutMs)

      // Si un envío anterior pudo llegar a la DIAN (timeout/caída), consultar por CUFE antes de reenviar.
      if (previousState === 'COMMUNICATION_ERROR' && Number(inv.retry_count || 0) > 0) {
        try {
          const prior = await adapter.getStatus(cufe)
          if (prior.isValid === true) {
            await this.event(actor, inv, 'DIAN_STATUS_QUERY', 'SUCCESS', { cufe }, this.safeResponse(prior))
            return this.applyValidation(actor, { ...inv, cufe }, prior)
          }
        } catch {
          // Sin respuesta: se intenta el reenvío normal
        }
      }

      return await this.transmit(actor, { ...inv, cufe }, adapter, files.zip, zip.toString('base64'))
    } catch (e: any) {
      if (e instanceof DianCertificateError) {
        await this.update(inv.id, { transmission_state: 'BLOCKED_CONFIG', last_error: e.message })
        await this.event(actor, inv, 'CERTIFICATE_ERROR', 'ERROR', null, { message: e.message })
        return this.result({ ...inv, cufe, transmission_state: 'BLOCKED_CONFIG' }, 'BLOCKED_CONFIG', e.message, [e.message])
      }
      throw e
    }
  }

  private async transmit(actor: DianActor, inv: any, adapter: DianSoapAdapter, zipName: string, zipB64: string): Promise<DianProcessResult> {
    const software = await this.loadSoftwareConfig(actor.companyId)
    let res: DianSoapResult
    try {
      if (this.config.environment === 'HABILITACION') {
        if (!software?.test_set_id) throw new DianOrchestratorError('Falta el TestSetId en dian_software_config.', 400)
        res = await adapter.sendTestSetAsync(zipName, zipB64, software.test_set_id)
      } else {
        res = await adapter.sendBillSync(zipName, zipB64)
      }
    } catch (e: any) {
      if (e instanceof DianCommunicationError) {
        await this.update(inv.id, {
          transmission_state: 'COMMUNICATION_ERROR',
          last_error: e.message,
          retry_count: num(inv.retry_count) + 1,
          last_retry_at: new Date().toISOString(),
        })
        await this.event(actor, inv, 'DIAN_TRANSMISSION_ATTEMPT', 'ERROR', { file: zipName }, { message: e.message })
        return this.result({ ...inv, transmission_state: 'COMMUNICATION_ERROR' }, 'COMMUNICATION_ERROR', e.message, [e.message])
      }
      throw e
    }

    await this.event(actor, inv, 'DIAN_TRANSMISSION_ATTEMPT', res.fault ? 'ERROR' : 'SUCCESS', { file: zipName, operation: res.operation }, this.safeResponse(res))

    if (res.fault) {
      await this.update(inv.id, {
        transmission_state: 'COMMUNICATION_ERROR',
        last_error: `DIAN (SOAP Fault): ${res.fault}`,
        retry_count: num(inv.retry_count) + 1,
        last_retry_at: new Date().toISOString(),
      })
      return this.result({ ...inv, transmission_state: 'COMMUNICATION_ERROR' }, 'COMMUNICATION_ERROR', `La DIAN rechazó la solicitud: ${res.fault}`, [res.fault])
    }

    // Envío asíncrono (set de pruebas): queda SENT con TrackId hasta consultar el estado.
    if (res.operation === 'SendTestSetAsync') {
      if (!res.zipKey) {
        const msg = res.errorMessages.join(' | ') || 'La DIAN no devolvió TrackId (ZipKey).'
        await this.update(inv.id, { transmission_state: 'REJECTED', dian_status: 'REJECTED', dian_validation_errors: res.errorMessages, last_error: msg, dian_response_date: new Date().toISOString() })
        return this.result({ ...inv, transmission_state: 'REJECTED', dian_status: 'REJECTED' }, 'REJECTED', msg, res.errorMessages)
      }
      await this.update(inv.id, { transmission_state: 'SENT', dian_status: 'SENT', dian_track_id: res.zipKey, last_error: null })
      return this.result({ ...inv, transmission_state: 'SENT', dian_status: 'SENT', dian_track_id: res.zipKey }, 'SENT',
        'Enviada al set de pruebas de la DIAN. Consulte el estado en unos segundos.')
    }

    return this.applyValidation(actor, inv, res)
  }

  // ----------------------------------------------------------------------------
  // 3. Consulta de estado (GetStatusZip con el TrackId)
  // ----------------------------------------------------------------------------

  async checkStatus(actor: DianActor, invoiceId: string): Promise<DianProcessResult> {
    const inv = await this.loadInvoice(actor.companyId, invoiceId)
    if (!inv.dian_track_id) throw new DianOrchestratorError('La factura no tiene TrackId: aún no ha sido enviada.', 409)
    const report = validateDianConfiguration(this.config)
    if (!report.canSign) throw new DianOrchestratorError('Se requiere el certificado para consultar el estado en la DIAN.', 400)

    const cert = loadSigningCertificate(this.config.secrets.certificateBase64, this.config.secrets.certificatePassword)
    const adapter = new DianSoapAdapter(this.config.endpoints.wsUrl, cert, this.config.httpTimeoutMs)
    let res: DianSoapResult
    try {
      res = await adapter.getStatusZip(inv.dian_track_id)
    } catch (e: any) {
      if (e instanceof DianCommunicationError) {
        return this.result(inv, inv.transmission_state, `No se pudo consultar el estado: ${e.message}`, [e.message])
      }
      throw e
    }
    await this.event(actor, inv, 'DIAN_STATUS_QUERY', res.fault ? 'ERROR' : 'SUCCESS', { trackId: inv.dian_track_id }, this.safeResponse(res))
    if (res.fault) return this.result(inv, inv.transmission_state, `La DIAN rechazó la consulta: ${res.fault}`, [res.fault])
    if (res.isValid === null && !res.statusCode) {
      return this.result(inv, 'SENT', 'La DIAN aún está procesando el documento. Intente de nuevo en unos segundos.')
    }
    if (this.config.environment === 'HABILITACION' && TEST_SET_CLOSED_PATTERN.test(res.statusDescription || '')) {
      return this.validateAfterClosedTestSet(actor, inv, adapter)
    }
    return this.applyValidation(actor, inv, res)
  }

  /**
   * Con el set de pruebas ya aceptado, la DIAN no valida lo que llega a SendTestSetAsync: solo responde
   * que el set "se encuentra Aceptado". En habilitación el mismo documento firmado se valida con SendBillSync.
   */
  private async validateAfterClosedTestSet(actor: DianActor, inv: any, adapter: DianSoapAdapter): Promise<DianProcessResult> {
    if (!inv.xml_signed || !inv.xml_file_name || !inv.zip_file_name) {
      throw new DianOrchestratorError('El documento no tiene XML firmado para validarlo en la DIAN.', 409)
    }
    const zipB64 = zipSingleFile(inv.xml_file_name, inv.xml_signed).toString('base64')
    let res: DianSoapResult
    try {
      res = await adapter.sendBillSync(inv.zip_file_name, zipB64)
    } catch (e: any) {
      if (e instanceof DianCommunicationError) {
        return this.result(inv, inv.transmission_state, `No se pudo validar el documento: ${e.message}`, [e.message])
      }
      throw e
    }
    await this.event(actor, inv, 'DIAN_TRANSMISSION_ATTEMPT', res.fault ? 'ERROR' : 'SUCCESS', { file: inv.zip_file_name, operation: res.operation }, this.safeResponse(res))
    if (res.fault) return this.result(inv, inv.transmission_state, `La DIAN rechazó la solicitud: ${res.fault}`, [res.fault])
    // Ya validado antes (regla 90): el resultado vigente se consulta por CUFE/CUDE.
    if (res.isValid !== true && inv.cufe && ALREADY_PROCESSED_PATTERN.test(res.errorMessages.join(' '))) {
      try {
        const prior = await adapter.getStatus(inv.cufe)
        await this.event(actor, inv, 'DIAN_STATUS_QUERY', prior.fault ? 'ERROR' : 'SUCCESS', { cufe: inv.cufe }, this.safeResponse(prior))
        if (!prior.fault) return this.applyValidation(actor, inv, prior)
      } catch (e: any) {
        if (!(e instanceof DianCommunicationError)) throw e
      }
    }
    return this.applyValidation(actor, inv, res)
  }

  private async applyValidation(actor: DianActor, inv: any, res: DianSoapResult): Promise<DianProcessResult> {
    const text = [res.statusCode, res.statusDescription, res.statusMessage, ...res.errorMessages].join(' ')
    // Respuesta sin validación (vacía): no es un rechazo.
    if (res.isValid === null && !res.statusCode && res.errorMessages.length === 0) {
      const msg = 'La DIAN no devolvió un resultado de validación. Intente consultar de nuevo.'
      await this.update(inv.id, { transmission_state: inv.dian_track_id ? 'SENT' : 'COMMUNICATION_ERROR', last_error: msg })
      return this.result(inv, inv.dian_track_id ? 'SENT' : 'COMMUNICATION_ERROR', msg)
    }
    // Documento aún en validación.
    if (res.isValid !== true && (res.statusCode === '98' || /en proceso|procesando|in process/i.test(text))) {
      await this.update(inv.id, { transmission_state: 'SENT', dian_status: 'SENT', last_error: null })
      return this.result({ ...inv, transmission_state: 'SENT', dian_status: 'SENT' }, 'SENT', 'La DIAN aún está validando el documento. Consulte el estado más tarde.')
    }
    // "Documento procesado anteriormente" (regla 90): la DIAN ya lo tiene; no se marca rechazado.
    if (res.isValid !== true && ALREADY_PROCESSED_PATTERN.test(text)) {
      const msg = 'La DIAN indica que este documento ya había sido recibido. Se consultará su estado (por CUFE) en el próximo intento.'
      await this.update(inv.id, { transmission_state: 'COMMUNICATION_ERROR', last_error: msg, retry_count: Number(inv.retry_count || 0) + 1 })
      return this.result({ ...inv, transmission_state: 'COMMUNICATION_ERROR' }, 'COMMUNICATION_ERROR', msg, res.errorMessages)
    }
    const accepted = res.isValid === true && (res.statusCode === '00' || res.statusCode === null)
    const state: TransmissionState = accepted ? 'ACCEPTED' : 'REJECTED'
    const message = res.statusMessage || res.statusDescription || (accepted ? 'Documento validado por la DIAN.' : 'Documento rechazado por la DIAN.')
    await this.update(inv.id, {
      transmission_state: state,
      dian_status: state,
      dian_status_code: res.statusCode,
      dian_response_message: message,
      dian_response_date: new Date().toISOString(),
      dian_validation_errors: res.errorMessages.length ? res.errorMessages : null,
      application_response_xml: res.applicationResponseXml,
      last_error: accepted ? null : res.errorMessages.join(' | ') || message,
    })
    await this.event(actor, inv, accepted ? 'DIAN_RESPONSE_ACCEPTED' : 'DIAN_RESPONSE_REJECTED', accepted ? 'SUCCESS' : 'ERROR', null, {
      statusCode: res.statusCode,
      message,
      errors: res.errorMessages,
    })
    return this.result({ ...inv, transmission_state: state, dian_status: state }, state, message, res.errorMessages)
  }

  /**
   * Datos de un documento ACEPTADO para entregarlo al adquiriente (AttachedDocument, PDF y correo).
   * El documento fiscal se arma desde la misma fuente que el XML transmitido.
   */
  async loadAcceptedDocument(actor: DianActor, invoiceId: string): Promise<{ invoice: any; document: DianInvoiceDocument }> {
    const inv = await this.loadInvoice(actor.companyId, invoiceId)
    if (inv.transmission_state !== 'ACCEPTED' || !inv.xml_signed || !inv.cufe) {
      throw new DianOrchestratorError('Solo se entregan al cliente los documentos aceptados por la DIAN.', 409)
    }
    const input = inv.document_type === 'INVOICE' ? await this.loadDocumentInput(inv) : await this.loadNoteInput(inv)
    return { invoice: inv, document: buildInvoiceDocument(input) }
  }

  // ----------------------------------------------------------------------------
  // Carga de datos
  // ----------------------------------------------------------------------------

  private async loadInvoice(companyId: string, invoiceId: string): Promise<any> {
    const { data, error } = await this.admin
      .from('electronic_invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) {
      logDatabaseError('DIAN consultar factura', error)
      throw new DianOrchestratorError('Error consultando la factura.', 500)
    }
    if (!data) throw new DianOrchestratorError('Factura no encontrada en su empresa.', 404)
    if (!['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(data.document_type)) {
      throw new DianOrchestratorError(`Tipo de documento no soportado: ${data.document_type}.`, 400)
    }
    if (data.environment !== this.config.environment) {
      throw new DianOrchestratorError(`La factura es del ambiente ${data.environment} y el servidor está en ${this.config.environment}.`, 409)
    }
    return data
  }

  private async loadSoftwareConfig(companyId: string): Promise<any | null> {
    const { data } = await this.admin
      .from('dian_software_config')
      .select('software_id, test_set_id, environment, is_active')
      .eq('company_id', companyId)
      .eq('environment', this.config.environment)
      .eq('is_active', true)
      .maybeSingle()
    return data || null
  }

  private async loadDocumentInput(inv: any): Promise<DianInvoiceInput> {
    const [companyQ, customerQ, saleQ, itemsQ, paymentsQ, softwareQ] = await Promise.all([
      this.admin.from('companies').select('*').eq('id', inv.company_id).maybeSingle(),
      this.admin.from('customers').select('*').eq('id', inv.customer_id).maybeSingle(),
      this.admin.from('sales').select('id, sale_number, payment_method, due_date, notes').eq('id', inv.sale_id).maybeSingle(),
      this.admin
        .from('sale_items')
        .select('product_id, quantity, unit_price, discount_percent, tax_rate_percent, tax_amount, subtotal, total, iva_treatment, created_at, products ( sku, name, iva_treatment )')
        .eq('sale_id', inv.sale_id)
        .order('created_at', { ascending: true }),
      this.admin.from('sale_payments').select('payment_method, amount').eq('sale_id', inv.sale_id),
      this.loadSoftwareConfig(inv.company_id),
    ])

    const c = companyQ.data
    const cu = customerQ.data
    const s = saleQ.data
    if (!c) throw new DianDocumentError(['Empresa emisora no encontrada.'])
    if (!cu) throw new DianDocumentError(['Cliente de la factura no encontrado.'])
    if (!s) throw new DianDocumentError(['Venta de la factura no encontrada.'])

    const payments: Array<{ payment_method: string; amount: number }> = paymentsQ.data || []
    const mainMethod = payments.length
      ? payments.slice().sort((a, b) => num(b.amount) - num(a.amount))[0].payment_method
      : String(s.payment_method || 'CASH')
    const isCredit = mainMethod === 'CREDIT'

    const docType = String(cu.document_type || 'CC')
    const isCompany = docType.toUpperCase() === 'NIT' || String(cu.customer_type || '').toUpperCase() === 'COMPANY' || String(cu.person_type || '').toUpperCase().includes('JUR')

    return {
      prefix: inv.prefix,
      number: Number(inv.number),
      issueDate: String(inv.issue_date),
      issueTime: String(inv.issue_time),
      environmentCode: this.config.environmentCode,
      softwareId: softwareQ?.software_id || inv.software_id || '',
      issuer: {
        nit: String(c.tax_id || '').replace(/[^0-9]/g, ''),
        dv: String(c.verification_digit || ''),
        legalName: c.business_name,
        tradeName: c.trade_name,
        address: c.address,
        cityName: c.city,
        departmentName: c.department,
        municipalityCode: c.dian_municipality_code,
        departmentCode: c.dian_department_code,
        countryCode: c.country_code || 'CO',
        postalCode: c.postal_code,
        email: c.invoice_email || c.email,
        phone: c.phone,
        organizationType: (c.dian_organization_type === '2' ? '2' : '1'),
        taxLevelCodes: c.dian_tax_level_codes,
        taxSchemeCode: c.dian_tax_scheme_code === 'ZZ' ? 'ZZ' : '01',
      },
      customer: {
        documentType: docType,
        documentNumber: String(cu.document_number || ''),
        dv: cu.verification_digit,
        name: cu.company_name || [cu.first_name, cu.last_name].filter(Boolean).join(' ') || 'Consumidor final',
        firstName: cu.first_name,
        lastName: cu.last_name,
        isCompany,
        email: cu.email,
        phone: cu.phone,
        address: cu.address,
        cityName: cu.city,
        departmentName: cu.department,
        municipalityCode: cu.dian_municipality_code,
        taxLevelCodes: cu.dian_tax_level_codes,
        taxSchemeCode: cu.dian_tax_scheme_code,
      },
      resolution: {
        resolutionNumber: String(inv.dian_resolution || ''),
        prefix: inv.prefix,
        rangeFrom: Number(inv.resolution_range_from),
        rangeTo: Number(inv.resolution_range_to),
        validFrom: String(inv.resolution_valid_from),
        validTo: String(inv.resolution_valid_to),
        resolutionDate: inv.resolution_date,
      },
      lines: (itemsQ.data || []).map((it: any) => ({
        productId: it.product_id,
        sku: it.products?.sku || String(it.product_id).slice(0, 8),
        description: it.products?.name || 'Producto',
        quantity: num(it.quantity),
        unitPrice: num(it.unit_price),
        discountPercent: num(it.discount_percent),
        taxRatePercent: num(it.tax_rate_percent),
        netAmount: num(it.subtotal),
        taxAmount: num(it.tax_amount),
        ivaTreatment: num(it.tax_rate_percent) > 0 ? 'GRAVADO' : (it.iva_treatment && it.iva_treatment !== 'GRAVADO' ? it.iva_treatment : it.products?.iva_treatment || null),
      })),
      payment: {
        form: isCredit ? '2' : '1',
        meansCode: dianPaymentMeansCode(mainMethod),
        dueDate: isCredit ? s.due_date : null,
      },
      orderReference: s.sale_number,
      notes: [`Venta ${s.sale_number}`],
    }
  }

  /** Datos fiscales de una nota: emisor/adquiriente de la factura original, líneas propias de la nota. */
  private async loadNoteInput(note: any): Promise<DianInvoiceInput> {
    const { data: orig } = await this.admin
      .from('electronic_invoices')
      .select('*')
      .eq('id', note.original_invoice_id)
      .eq('company_id', note.company_id)
      .maybeSingle()
    if (!orig) throw new DianDocumentError(['La factura referenciada por la nota no existe.'])
    if (!orig.cufe || orig.transmission_state !== 'ACCEPTED') {
      throw new DianDocumentError([`La factura ${orig.prefix}${orig.number} debe estar aceptada por la DIAN (tiene que tener CUFE).`])
    }

    // Emisor, adquiriente y medio de pago: los mismos de la factura (se reutiliza la carga de la factura)
    const base = await this.loadDocumentInput({ ...orig, prefix: note.prefix, number: note.number, issue_date: note.issue_date, issue_time: note.issue_time })

    const { data: lines, error } = await this.admin
      .from('electronic_document_lines')
      .select('line_number, product_id, sku, description, quantity, unit_price, discount_percent, net_amount, iva_treatment, tax_rate_percent, tax_amount')
      .eq('document_id', note.id)
      .order('line_number', { ascending: true })
    if (error) {
      logDatabaseError('DIAN leer líneas de la nota', error)
      throw new DianDocumentError(['No se pudieron leer las líneas de la nota.'])
    }

    const kind: DianDocumentKind = note.document_type
    const concepts = kind === 'CREDIT_NOTE' ? CREDIT_NOTE_CONCEPTS : DEBIT_NOTE_CONCEPTS
    const conceptDescription = concepts[String(note.note_concept_code)] || ''

    return {
      ...base,
      kind,
      prefix: note.prefix,
      number: Number(note.number),
      issueDate: String(note.issue_date),
      issueTime: String(note.issue_time),
      resolution: null,
      billingReference: { id: `${orig.prefix}${orig.number}`, uuid: String(orig.cufe), issueDate: String(orig.issue_date) },
      discrepancy: note.note_concept_code ? { code: String(note.note_concept_code), description: conceptDescription } : null,
      orderReference: null,
      notes: [note.note_reason ? String(note.note_reason) : conceptDescription].filter(Boolean),
      lines: (lines || []).map((l: any) => ({
        productId: l.product_id || '',
        sku: l.sku || `L${l.line_number}`,
        description: l.description,
        quantity: num(l.quantity),
        unitPrice: num(l.unit_price),
        discountPercent: num(l.discount_percent),
        taxRatePercent: num(l.tax_rate_percent),
        netAmount: num(l.net_amount),
        taxAmount: num(l.tax_amount),
        ivaTreatment: l.iva_treatment,
      })),
    }
  }

  // ----------------------------------------------------------------------------
  // Persistencia
  // ----------------------------------------------------------------------------

  private async update(invoiceId: string, patch: Record<string, any>): Promise<void> {
    const { error } = await this.admin
      .from('electronic_invoices')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', invoiceId)
    if (error) {
      logDatabaseError('DIAN guardar estado de la factura', error)
      throw new DianOrchestratorError('No se pudo guardar el estado de la factura.', 500)
    }
  }

  /**
   * La DIAN exige que la fecha de emisión sea la del día de la firma (regla FAD09e). Un documento que nunca
   * fue aceptado y se reintenta otro día se re-fecha a hoy; su CUFE/CUDE y el XML se regeneran con la nueva fecha.
   * Solo llega aquí un documento reservado en un estado no aceptado ni en validación (ver process).
   */
  private async refreshStaleIssueDate(actor: DianActor, inv: any): Promise<any> {
    const now = bogotaTimestamp()
    const today = now.slice(0, 10)
    const previousDate = String(inv.issue_date).slice(0, 10)
    if (previousDate === today) return inv

    const refreshed = {
      issue_date: today,
      issue_time: now.slice(11),
      cufe: null,
      qr_code_data: null,
      software_security_code: null,
      xml_unsigned: null,
    }
    await this.update(inv.id, refreshed)
    await this.event(actor, inv, 'ISSUE_DATE_REFRESHED', 'SUCCESS', { previousDate, issueDate: today }, null)
    return { ...inv, ...refreshed }
  }

  private async event(actor: DianActor, inv: any, type: string, status: string, sent: any, received: any): Promise<void> {
    await this.admin.from('dian_events').insert({
      invoice_id: inv.id,
      company_id: inv.company_id,
      created_by_user_id: actor.userId,
      environment: inv.environment,
      event_type: type,
      status,
      payload_sent: sent,
      response_received: received,
    })
  }

  /** Respuesta DIAN sin el sobre completo (evita guardar megabytes por evento). */
  private safeResponse(res: DianSoapResult) {
    return {
      operation: res.operation,
      httpStatus: res.httpStatus,
      isValid: res.isValid,
      statusCode: res.statusCode,
      statusDescription: res.statusDescription,
      statusMessage: res.statusMessage,
      errors: res.errorMessages,
      zipKey: res.zipKey,
      fault: res.fault,
    }
  }

  private result(inv: any, state: TransmissionState, message: string, dianErrors: string[] = []): DianProcessResult {
    return {
      invoiceId: inv.id,
      documentNumber: `${inv.prefix}${inv.number}`,
      transmissionState: state,
      dianStatus: (inv.dian_status as any) || 'PENDING',
      cufe: inv.cufe || null,
      trackId: inv.dian_track_id || null,
      message,
      dianErrors,
    }
  }
}
