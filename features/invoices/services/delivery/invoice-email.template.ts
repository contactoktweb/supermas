/**
 * Plantilla del correo con el que se entrega la factura electrónica (o nota) al adquiriente.
 * HTML en tablas con estilos en línea para que se vea igual en Gmail, Outlook y clientes móviles.
 * El logo va como imagen embebida (cid) para no depender de una URL pública.
 */
import { DianInvoiceDocument } from '../dian/dian-document'
import { formatDocumentDateTime } from '../../utils/document-dates'

export const INVOICE_EMAIL_LOGO_CID = 'logo-super-mas'

const DOCUMENT_NAMES = {
  INVOICE: { title: 'Factura electrónica de venta', article: 'la factura electrónica de venta', code: '01' },
  CREDIT_NOTE: { title: 'Nota crédito electrónica', article: 'la nota crédito electrónica', code: '91' },
  DEBIT_NOTE: { title: 'Nota débito electrónica', article: 'la nota débito electrónica', code: '92' },
} as const

const escapeHtml = (value: string) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

const cop = (cents: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2 }).format(cents / 100)

/**
 * Asunto según el Anexo Técnico de factura electrónica:
 * NIT del facturador; nombre del facturador; número del documento; código del tipo de documento; nombre comercial.
 */
export function invoiceEmailSubject(doc: DianInvoiceDocument): string {
  const issuer = doc.input.issuer
  const commercialName = issuer.tradeName || issuer.legalName
  return [issuer.nit, issuer.legalName, doc.documentId, DOCUMENT_NAMES[doc.kind].code, commercialName].join(';')
}

export function invoiceEmailHtml(params: { document: DianInvoiceDocument; cufe: string; validationDate: string }): string {
  const { document: doc, cufe, validationDate } = params
  const issuer = doc.input.issuer
  const names = DOCUMENT_NAMES[doc.kind]
  const isTest = doc.input.environmentCode === '2'
  const keyLabel = doc.kind === 'INVOICE' ? 'CUFE' : 'CUDE'
  const year = new Date().getFullYear()
  const customerName = doc.input.customer.name || 'cliente'

  const row = (label: string, value: string, emphasis = false) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;width:42%;vertical-align:top;">${escapeHtml(label)}</td>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:${emphasis ? '16px' : '13px'};color:#0f172a;font-weight:${emphasis ? '700' : '600'};text-align:right;vertical-align:top;">${value}</td>
          </tr>`

  const testNotice = isTest
    ? `
        <tr>
          <td style="padding:0 32px 8px;">
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;font-size:12px;color:#b91c1c;font-weight:600;text-align:center;">
              Documento de prueba del ambiente de habilitación de la DIAN. No tiene validez fiscal.
            </div>
          </td>
        </tr>`
    : ''

  const reference =
    doc.kind !== 'INVOICE' && doc.input.billingReference
      ? row('Factura referenciada', escapeHtml(doc.input.billingReference.id))
      : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(names.title)} ${escapeHtml(doc.documentId)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(names.title)} ${escapeHtml(doc.documentId)} de ${escapeHtml(issuer.legalName)} por ${escapeHtml(cop(doc.totals.payableCents))}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:26px 32px 18px;border-bottom:4px solid #001b5c;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="cid:${INVOICE_EMAIL_LOGO_CID}" alt="${escapeHtml(issuer.tradeName || issuer.legalName)}" width="150" style="display:block;width:150px;max-width:150px;height:auto;border:0;">
                  </td>
                  <td style="vertical-align:middle;text-align:right;font-size:11px;line-height:16px;color:#64748b;">
                    ${escapeHtml(issuer.legalName)}<br>NIT ${escapeHtml(issuer.nit)}-${escapeHtml(issuer.dv)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 6px;">
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#dc2626;font-weight:700;">${escapeHtml(names.title)}</p>
              <h1 style="margin:0 0 18px;font-size:24px;line-height:30px;color:#001b5c;">No. ${escapeHtml(doc.documentId)}</h1>
              <p style="margin:0 0 14px;font-size:14px;line-height:22px;">Estimado(a) ${escapeHtml(customerName)}:</p>
              <p style="margin:0 0 18px;font-size:14px;line-height:22px;color:#334155;">
                ${escapeHtml(issuer.legalName)} le hace entrega de ${names.article} No. ${escapeHtml(doc.documentId)}, validada previamente por la
                Dirección de Impuestos y Aduanas Nacionales (DIAN). Adjunto encontrará un archivo ZIP con el documento electrónico (XML)
                y su representación gráfica (PDF).
              </p>
            </td>
          </tr>
          ${testNotice}
          <tr>
            <td style="padding:6px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${row('Número del documento', escapeHtml(doc.documentId))}
                ${row('Fecha de emisión', escapeHtml(formatDocumentDateTime(doc.input.issueDate, doc.input.issueTime)))}
                ${row('Validada por la DIAN', escapeHtml(validationDate))}
                ${reference}
                ${row('Valor total', escapeHtml(cop(doc.totals.payableCents)), true)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 32px 26px;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#001b5c;">${keyLabel}</p>
                <p style="margin:0;font-size:11px;line-height:16px;color:#475569;word-break:break-all;font-family:'Courier New',monospace;">${escapeHtml(cufe)}</p>
              </div>
              <p style="margin:16px 0 0;font-size:12px;line-height:19px;color:#64748b;">
                Puede verificar la autenticidad de este documento en el portal de la DIAN escaneando el código QR de la representación gráfica.
                Si tiene alguna inquietud sobre este documento, responda a este correo${issuer.phone ? ` o comuníquese al ${escapeHtml(issuer.phone)}` : ''}.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 22px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;line-height:17px;color:#64748b;text-align:center;">
              <strong style="color:#0f172a;">${escapeHtml(issuer.legalName)}</strong><br>
              NIT ${escapeHtml(issuer.nit)}-${escapeHtml(issuer.dv)} · ${escapeHtml(issuer.address)} · ${escapeHtml(issuer.cityName)}, ${escapeHtml(issuer.departmentName)}<br>
              Este mensaje se generó automáticamente con la entrega de su documento electrónico.<br>
              © ${year} ${escapeHtml(issuer.legalName)}. Todos los derechos reservados.<br>
              <a href="https://www.kytcode.lat" style="color:#0f172a;text-decoration:none;font-weight:600;">Desarrollado por K&amp;T <span style="color:#000000;">&#9829;</span></a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Versión de texto plano (clientes sin HTML y mejor entregabilidad). */
export function invoiceEmailText(params: { document: DianInvoiceDocument; cufe: string; validationDate: string }): string {
  const { document: doc, cufe, validationDate } = params
  const issuer = doc.input.issuer
  const names = DOCUMENT_NAMES[doc.kind]
  return [
    `${names.title} No. ${doc.documentId}`,
    '',
    `Estimado(a) ${doc.input.customer.name || 'cliente'}:`,
    `${issuer.legalName} le hace entrega de ${names.article} No. ${doc.documentId}, validada por la DIAN.`,
    'Adjunto encontrará el documento electrónico (XML) y su representación gráfica (PDF).',
    '',
    `Fecha de emisión: ${formatDocumentDateTime(doc.input.issueDate, doc.input.issueTime)}`,
    `Validada por la DIAN: ${validationDate}`,
    `Valor total: ${cop(doc.totals.payableCents)}`,
    `${doc.kind === 'INVOICE' ? 'CUFE' : 'CUDE'}: ${cufe}`,
    '',
    `${issuer.legalName} · NIT ${issuer.nit}-${issuer.dv}`,
  ].join('\n')
}
