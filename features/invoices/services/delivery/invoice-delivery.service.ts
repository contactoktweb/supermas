/**
 * Entrega al adquiriente de un documento electrónico aceptado por la DIAN:
 * AttachedDocument firmado (XML) + representación gráfica (PDF) en un ZIP, enviado por correo con Resend.
 * Cada intento queda en dian_events (EMAIL_SENT / EMAIL_FAILED).
 *
 * En habilitación los documentos solo se envían a INVOICE_EMAIL_TEST_RECIPIENT: nunca a clientes reales.
 */
import { readFileSync } from 'fs'
import path from 'path'
import { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getInvoiceEmailConfig, isValidEmail, resendClient } from '@/lib/email/resend-client'
import { DianActor, DianOrchestratorError, DianOrchestratorService } from '../dian/dian-orchestrator.service'
import { getDianConfig } from '../dian/dian.config'
import { loadSigningCertificate } from '../dian/dian-certificate'
import { bogotaTimestamp, signUblDocument } from '../dian/dian-xades-signer'
import { serialize } from '../dian/xml/xml-tree'
import { dianFileNames } from '../dian/dian-soap.adapter'
import { zipFiles } from '../dian/dian-zip'
import { DIAN_FINAL_CONSUMER_DOC } from '../dian/dian-document'
import { buildAttachedDocumentTree, validationStampFrom } from './attached-document.builder'
import { buildInvoicePdf } from './invoice-pdf.builder'
import { formatDocumentDateTime } from '../../utils/document-dates'
import { INVOICE_EMAIL_LOGO_CID, invoiceEmailHtml, invoiceEmailSubject, invoiceEmailText } from './invoice-email.template'

export type DeliveryTrigger = 'AUTO' | 'MANUAL'

export type DeliveryOutcome = 'SENT' | 'ALREADY_SENT' | 'NOT_CONFIGURED' | 'NO_RECIPIENT' | 'TEST_ENVIRONMENT' | 'FAILED'

export interface DeliveryResult {
  outcome: DeliveryOutcome
  message: string
  recipient: string | null
}

const LOGO_PATH = path.join(process.cwd(), 'public', 'logo-super-correo.png')

export class InvoiceDeliveryService {
  private readonly admin: SupabaseClient

  constructor(private readonly orchestrator = new DianOrchestratorService()) {
    this.admin = createAdminClient()
  }

  async deliver(actor: DianActor, invoiceId: string, trigger: DeliveryTrigger, recipientOverride?: string | null): Promise<DeliveryResult> {
    const emailConfig = getInvoiceEmailConfig()
    if (!emailConfig) {
      return { outcome: 'NOT_CONFIGURED', message: 'El envío de documentos por correo aún no está habilitado.', recipient: null }
    }

    const { invoice, document } = await this.orchestrator.loadAcceptedDocument(actor, invoiceId)

    if (trigger === 'AUTO' && (await this.alreadySent(invoice.id))) {
      return { outcome: 'ALREADY_SENT', message: 'El documento ya había sido enviado al cliente.', recipient: null }
    }

    const override = recipientOverride?.trim() || null
    if (override && !isValidEmail(override)) throw new DianOrchestratorError('El correo de destino no es válido.', 400)
    const customerEmail = (document.input.customer.email || '').trim()
    let recipient = override || (isValidEmail(customerEmail) ? customerEmail : null)

    const isTest = document.input.environmentCode === '2'
    if (isTest) {
      if (!emailConfig.testRecipient) {
        return {
          outcome: 'TEST_ENVIRONMENT',
          message: 'Los documentos de prueba de la DIAN no se envían a clientes.',
          recipient: null,
        }
      }
      recipient = emailConfig.testRecipient
    }

    if (!recipient) {
      const finalConsumer = document.input.customer.documentNumber === DIAN_FINAL_CONSUMER_DOC
      return {
        outcome: 'NO_RECIPIENT',
        message: finalConsumer
          ? 'Venta a consumidor final sin correo: entregue la representación gráfica impresa.'
          : 'El cliente no tiene un correo electrónico registrado.',
        recipient: null,
      }
    }

    try {
      const dianConfig = getDianConfig()
      const cert = loadSigningCertificate(dianConfig.secrets.certificateBase64, dianConfig.secrets.certificatePassword)
      const validation = validationStampFrom(invoice.application_response_xml, invoice.dian_response_date)
      const now = bogotaTimestamp()

      const attachedTree = buildAttachedDocumentTree({
        document,
        cufe: invoice.cufe,
        signedXml: invoice.xml_signed,
        applicationResponseXml: invoice.application_response_xml || '',
        validation,
        issueDate: now.slice(0, 10),
        issueTime: now.slice(11),
      })
      signUblDocument(attachedTree, cert)
      const attachedXml = serialize(attachedTree, true)

      const pdf = buildInvoicePdf({ document, cufe: invoice.cufe, qrContent: invoice.qr_code_data || '', validation })
      const names = dianFileNames(document.input.issuer.nit, document.input.issueDate, Number(invoice.number), document.kind)
      const baseName = names.xml.replace(/^(fv|nc|nd)/, 'ad').replace(/\.xml$/, '')
      const zip = zipFiles([
        { fileName: `${baseName}.xml`, content: attachedXml },
        { fileName: `${baseName}.pdf`, content: pdf },
      ])

      const validationDate = formatDocumentDateTime(validation.date, validation.time)
      const { data, error } = await resendClient(emailConfig).emails.send({
        from: emailConfig.from,
        to: [recipient],
        replyTo: emailConfig.replyTo || document.input.issuer.email || undefined,
        subject: invoiceEmailSubject(document),
        html: invoiceEmailHtml({ document, cufe: invoice.cufe, validationDate }),
        text: invoiceEmailText({ document, cufe: invoice.cufe, validationDate }),
        attachments: [
          { filename: names.zip, content: zip },
          { filename: 'logo.png', content: readFileSync(LOGO_PATH), contentId: INVOICE_EMAIL_LOGO_CID },
        ],
      })
      if (error) throw new Error(error.message)

      await this.event(actor, invoice, 'EMAIL_SENT', 'SUCCESS', { to: recipient, trigger, file: names.zip }, { id: data?.id ?? null })
      return { outcome: 'SENT', message: `Documento enviado a ${recipient}.`, recipient }
    } catch (e: any) {
      const reason = e?.message || String(e)
      console.error('[DIAN] Error enviando el documento al cliente:', reason)
      await this.event(actor, invoice, 'EMAIL_FAILED', 'ERROR', { to: recipient, trigger }, { error: reason })
      return { outcome: 'FAILED', message: 'No se pudo enviar el correo al cliente. Intente de nuevo en unos minutos.', recipient }
    }
  }

  private async alreadySent(invoiceId: string): Promise<boolean> {
    const { count } = await this.admin
      .from('dian_events')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_id', invoiceId)
      .eq('event_type', 'EMAIL_SENT')
    return (count || 0) > 0
  }

  private async event(actor: DianActor, inv: any, type: string, status: string, sent: any, received: any): Promise<void> {
    const { error } = await this.admin.from('dian_events').insert({
      invoice_id: inv.id,
      company_id: inv.company_id,
      created_by_user_id: actor.userId,
      environment: inv.environment,
      event_type: type,
      status,
      payload_sent: sent,
      response_received: received,
    })
    if (error) console.error('[DIAN] No se pudo registrar el evento de entrega:', error.message)
  }
}
