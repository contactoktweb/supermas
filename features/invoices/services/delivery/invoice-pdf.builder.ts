/**
 * Representación gráfica en PDF de la factura electrónica de venta y de sus notas crédito/débito.
 * Se arma con el mismo documento fiscal del XML: emisor, adquiriente, líneas, impuestos, totales,
 * resolución de numeración, CUFE/CUDE y código QR de consulta en la DIAN.
 */
import { readFileSync } from 'fs'
import path from 'path'
import { PdfColor, SimplePdf, wrapText } from '@/lib/pdf/simple-pdf'
import { qrMatrix } from '@/lib/qr/qr-svg'
import { amountInWords } from '../../utils/amount-in-words'
import { formatDocumentDate, formatDocumentDateTime } from '../../utils/document-dates'
import { DianInvoiceDocument, dianIdTypeCode } from '../dian/dian-document'
import { DianValidationStamp } from './attached-document.builder'

const NAVY: PdfColor = [0, 27, 92]
const RED: PdfColor = [220, 38, 38]
const TEXT: PdfColor = [17, 24, 39]
const MUTED: PdfColor = [100, 116, 139]
const LINE: PdfColor = [203, 213, 225]
const SOFT: PdfColor = [241, 245, 249]
const WHITE: PdfColor = [255, 255, 255]

const MARGIN = 36
const LOGO_PATH = path.join(process.cwd(), 'public', 'logo-super-documento.jpg')

const TITLE_BY_KIND = {
  INVOICE: 'FACTURA ELECTRÓNICA DE VENTA',
  CREDIT_NOTE: 'NOTA CRÉDITO ELECTRÓNICA',
  DEBIT_NOTE: 'NOTA DÉBITO ELECTRÓNICA',
} as const

const ID_TYPE_LABELS: Record<string, string> = {
  '11': 'Registro civil', '12': 'Tarjeta de identidad', '13': 'Cédula de ciudadanía', '21': 'Tarjeta de extranjería',
  '22': 'Cédula de extranjería', '31': 'NIT', '41': 'Pasaporte', '42': 'Documento extranjero', '47': 'PEP', '48': 'PPT',
}

const PAYMENT_MEANS_LABELS: Record<string, string> = {
  '10': 'Efectivo', '42': 'Consignación bancaria', '47': 'Transferencia bancaria', '48': 'Tarjeta crédito',
  '49': 'Tarjeta débito', ZZZ: 'Otro',
}

const cop = (cents: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2 }).format(cents / 100)

const quantity = (q: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 }).format(q)

let logoCache: Buffer | null | undefined
function companyLogo(): Buffer | null {
  if (logoCache === undefined) {
    try {
      logoCache = readFileSync(LOGO_PATH)
    } catch {
      logoCache = null
    }
  }
  return logoCache
}

export interface InvoicePdfParams {
  document: DianInvoiceDocument
  cufe: string
  qrContent: string
  validation: DianValidationStamp
}

export function buildInvoicePdf({ document: doc, cufe, qrContent, validation }: InvoicePdfParams): Buffer {
  const pdf = new SimplePdf()
  const right = pdf.width - MARGIN
  const contentWidth = right - MARGIN
  const bottomLimit = pdf.height - 48
  const { issuer, customer, resolution, payment, billingReference, discrepancy } = doc.input
  const isTest = doc.input.environmentCode === '2'
  const isNote = doc.kind !== 'INVOICE'
  const keyLabel = isNote ? 'CUDE' : 'CUFE'

  // ---------------------------------------------------------------- Encabezado
  let y = MARGIN
  const logo = companyLogo()
  const logoHeight = logo ? pdf.jpeg(logo, MARGIN, y, 160) : 0

  pdf.text(right, y + 12, TITLE_BY_KIND[doc.kind], { size: 13, font: 'bold', color: NAVY, align: 'right' })
  pdf.text(right, y + 30, `No. ${doc.documentId}`, { size: 12, font: 'bold', color: RED, align: 'right' })
  pdf.text(right, y + 45, `Fecha de emisión: ${formatDocumentDateTime(doc.input.issueDate, doc.input.issueTime)}`, { size: 8, color: MUTED, align: 'right' })
  pdf.text(right, y + 56, `Validada por la DIAN: ${formatDocumentDateTime(validation.date, validation.time)}`, { size: 8, color: MUTED, align: 'right' })

  y += Math.max(logoHeight, 60) + 12
  pdf.text(MARGIN, y, issuer.legalName, { size: 10.5, font: 'bold', color: NAVY })
  y += 13
  const issuerLines = [
    `NIT ${issuer.nit}-${issuer.dv}${issuer.tradeName && issuer.tradeName !== issuer.legalName ? ` · ${issuer.tradeName}` : ''}`,
    `${issuer.address} · ${issuer.cityName}, ${issuer.departmentName}`,
    [issuer.phone && `Tel. ${issuer.phone}`, issuer.email].filter(Boolean).join(' · '),
    `Responsabilidades fiscales: ${issuer.taxLevelCodes} · ${issuer.taxSchemeCode === '01' ? 'Responsable de IVA' : 'No responsable de IVA'}`,
  ].filter(Boolean)
  for (const line of issuerLines) {
    pdf.text(MARGIN, y, line, { size: 8, color: TEXT })
    y += 11
  }

  if (isTest) {
    y += 4
    pdf.rect(MARGIN, y, contentWidth, 18, { fill: [254, 242, 242], stroke: [254, 202, 202] })
    pdf.text(MARGIN + contentWidth / 2, y + 12, 'DOCUMENTO DE PRUEBA — AMBIENTE DE HABILITACIÓN DIAN — SIN VALIDEZ FISCAL', {
      size: 8, font: 'bold', color: RED, align: 'center',
    })
    y += 18
  }

  // ---------------------------------------------------------------- Adquiriente y condiciones
  y += 10
  const boxTop = y
  const half = contentWidth / 2
  const idType = dianIdTypeCode(customer.documentType)
  const leftRows: Array<[string, string]> = [
    ['Nombre / razón social', customer.name],
    ['Identificación', `${ID_TYPE_LABELS[idType] || customer.documentType} ${customer.documentNumber}${idType === '31' && customer.dv ? `-${customer.dv}` : ''}`],
    ['Dirección', [customer.address, customer.cityName].filter(Boolean).join(' · ') || '—'],
    ['Correo electrónico', customer.email || '—'],
    ['Teléfono', customer.phone || '—'],
  ]
  const rightRows: Array<[string, string]> = isNote
    ? [
        ['Factura referenciada', billingReference?.id || '—'],
        ['Fecha de la factura', formatDocumentDate(billingReference?.issueDate)],
        ['Concepto', discrepancy?.description || '—'],
      ]
    : [
        ['Forma de pago', payment?.form === '2' ? 'Crédito' : 'Contado'],
        ['Medio de pago', PAYMENT_MEANS_LABELS[payment?.meansCode || ''] || 'Otro'],
        ['Fecha de vencimiento', formatDocumentDate(payment?.dueDate || doc.input.issueDate)],
      ]
  const rowsHeight = Math.max(leftRows.length, rightRows.length) * 22 + 24
  pdf.rect(MARGIN, boxTop, contentWidth, rowsHeight, { fill: [248, 250, 252], stroke: LINE })
  pdf.line(MARGIN + half, boxTop + 8, MARGIN + half, boxTop + rowsHeight - 8)
  pdf.text(MARGIN + 10, boxTop + 15, 'ADQUIRIENTE', { size: 8, font: 'bold', color: NAVY })
  pdf.text(MARGIN + half + 10, boxTop + 15, isNote ? 'DOCUMENTO REFERENCIADO' : 'CONDICIONES DE PAGO', { size: 8, font: 'bold', color: NAVY })
  const drawRows = (rows: Array<[string, string]>, x: number) =>
    rows.forEach(([label, value], i) => {
      const rowY = boxTop + 30 + i * 22
      pdf.text(x, rowY, label, { size: 6.5, color: MUTED })
      pdf.text(x, rowY + 9, wrapText(value, half - 24, 8.5)[0], { size: 8.5, color: TEXT })
    })
  drawRows(leftRows, MARGIN + 10)
  drawRows(rightRows, MARGIN + half + 10)
  y = boxTop + rowsHeight + 14

  // ---------------------------------------------------------------- Detalle
  const cols = [
    { label: '#', width: 20, align: 'center' as const },
    { label: 'Código', width: 62, align: 'left' as const },
    { label: 'Descripción', width: contentWidth - 20 - 62 - 42 - 72 - 38 - 38 - 78, align: 'left' as const },
    { label: 'Cant.', width: 42, align: 'right' as const },
    { label: 'Vr. unitario', width: 72, align: 'right' as const },
    { label: 'Desc.', width: 38, align: 'right' as const },
    { label: 'IVA', width: 38, align: 'right' as const },
    { label: 'Total', width: 78, align: 'right' as const },
  ]
  const cellX = (i: number) => MARGIN + cols.slice(0, i).reduce((s, c) => s + c.width, 0)
  const cellText = (i: number, rowY: number, value: string, bold = false, color: PdfColor = TEXT) => {
    const c = cols[i]
    const x = c.align === 'right' ? cellX(i) + c.width - 5 : c.align === 'center' ? cellX(i) + c.width / 2 : cellX(i) + 5
    pdf.text(x, rowY, value, { size: bold ? 7.5 : 8, font: bold ? 'bold' : 'regular', color, align: c.align })
  }
  const tableHeader = () => {
    pdf.rect(MARGIN, y, contentWidth, 18, { fill: NAVY })
    cols.forEach((c, i) => cellText(i, y + 12, c.label, true, WHITE))
    y += 18
  }
  tableHeader()

  doc.lines.forEach((line, index) => {
    const description = wrapText(line.input.description, cols[2].width - 10, 8)
    const rowHeight = Math.max(1, description.length) * 10 + 8
    if (y + rowHeight > bottomLimit) {
      pdf.addPage()
      y = MARGIN
      tableHeader()
    }
    if (index % 2 === 1) pdf.rect(MARGIN, y, contentWidth, rowHeight, { fill: [248, 250, 252] })
    const baseline = y + 12
    cellText(0, baseline, String(line.lineNumber))
    cellText(1, baseline, line.input.sku || '—')
    description.forEach((text, i) => pdf.text(cellX(2) + 5, baseline + i * 10, text, { size: 8 }))
    cellText(3, baseline, quantity(line.quantity))
    cellText(4, baseline, cop(line.unitPriceCents))
    cellText(5, baseline, line.input.discountPercent ? `${line.input.discountPercent}%` : '—')
    cellText(6, baseline, line.treatment === 'EXCLUIDO' ? 'Excl.' : `${line.tax?.ratePercent ?? 0}%`)
    cellText(7, baseline, cop(line.netCents))
    y += rowHeight
    pdf.line(MARGIN, y, right, y, [226, 232, 240])
  })

  // ---------------------------------------------------------------- Totales
  const t = doc.totals
  const discountCents = doc.lines.reduce((s, l) => s + l.discountCents, 0)
  const totalRows: Array<[string, number]> = [['Subtotal', t.lineExtensionCents + discountCents]]
  if (discountCents) totalRows.push(['Descuentos', -discountCents])
  totalRows.push(['Base gravable', t.taxExclusiveCents])
  for (const sub of t.taxSubtotals) totalRows.push([`IVA ${sub.ratePercent}%`, sub.taxCents])
  const totalsHeight = totalRows.length * 15 + 30

  if (y + 14 + totalsHeight + 150 > bottomLimit) {
    pdf.addPage()
    y = MARGIN
  }
  y += 14
  const totalsWidth = 220
  const totalsX = right - totalsWidth
  totalRows.forEach(([label, cents], i) => {
    const rowY = y + 11 + i * 15
    pdf.text(totalsX + 8, rowY, label, { size: 8.5, color: MUTED })
    pdf.text(right - 8, rowY, cop(cents), { size: 8.5, color: TEXT, align: 'right' })
  })
  const payableY = y + totalRows.length * 15 + 4
  pdf.rect(totalsX, payableY, totalsWidth, 24, { fill: NAVY })
  pdf.text(totalsX + 8, payableY + 16, 'TOTAL A PAGAR', { size: 9.5, font: 'bold', color: WHITE })
  pdf.text(right - 8, payableY + 16, cop(t.payableCents), { size: 10.5, font: 'bold', color: WHITE, align: 'right' })

  const wordsWidth = totalsX - MARGIN - 16
  pdf.rect(MARGIN, y, wordsWidth, totalsHeight - 2, { fill: SOFT })
  pdf.text(MARGIN + 10, y + 14, 'VALOR EN LETRAS', { size: 7, font: 'bold', color: NAVY })
  wrapText(amountInWords(t.payableCents / 100), wordsWidth - 20, 8.5, 'bold').forEach((text, i) =>
    pdf.text(MARGIN + 10, y + 28 + i * 11, text, { size: 8.5, font: 'bold', color: TEXT })
  )
  const notes = (doc.input.notes || []).filter(Boolean).join(' ')
  if (notes) {
    wrapText(`Observaciones: ${notes}`, wordsWidth - 20, 7.5).slice(0, 3).forEach((text, i) =>
      pdf.text(MARGIN + 10, y + 56 + i * 9, text, { size: 7.5, color: MUTED })
    )
  }
  y = payableY + 40

  // ---------------------------------------------------------------- Información fiscal, CUFE y QR
  pdf.line(MARGIN, y, right, y, LINE)
  y += 10
  const qrSize = 96
  const qr = qrMatrix(qrContent, 'M')
  const module = qrSize / (qr.size + 2)
  for (let row = 0; row < qr.size; row++) {
    let start = -1
    for (let col = 0; col <= qr.size; col++) {
      const dark = col < qr.size && qr.modules[row][col]
      if (dark && start < 0) start = col
      if (!dark && start >= 0) {
        pdf.rect(MARGIN + (start + 1) * module, y + (row + 1) * module, (col - start) * module, module, { fill: [0, 0, 0], lineWidth: 0 })
        start = -1
      }
    }
  }

  const infoX = MARGIN + qrSize + 14
  const infoWidth = right - infoX
  let infoY = y + 10
  const info = (text: string, opts: { bold?: boolean; color?: PdfColor; size?: number } = {}) => {
    for (const lineText of wrapText(text, infoWidth, opts.size ?? 7.5, opts.bold ? 'bold' : 'regular')) {
      pdf.text(infoX, infoY, lineText, { size: opts.size ?? 7.5, font: opts.bold ? 'bold' : 'regular', color: opts.color ?? TEXT })
      infoY += 10
    }
  }
  info(`${keyLabel}:`, { bold: true, color: NAVY })
  info(cufe, { size: 7, color: TEXT })
  infoY += 3
  if (resolution) {
    info(
      `Autorización de numeración de facturación DIAN No. ${resolution.resolutionNumber}${resolution.resolutionDate ? ` del ${formatDocumentDate(resolution.resolutionDate)}` : ''}, ` +
        `prefijo ${resolution.prefix} del ${resolution.rangeFrom} al ${resolution.rangeTo}, vigente del ${formatDocumentDate(resolution.validFrom)} al ${formatDocumentDate(resolution.validTo)}.`,
      { color: MUTED }
    )
  }
  if (isNote && billingReference) info(`Referencia: factura ${billingReference.id} — CUFE ${billingReference.uuid}`, { color: MUTED })
  info('Escanee el código QR para consultar este documento en el portal de la DIAN.', { color: MUTED })
  info(`Documento generado con software propio del emisor (Super Más ERP) · NIT ${issuer.nit}-${issuer.dv}.`, { color: MUTED })

  // ---------------------------------------------------------------- Numeración de páginas
  const total = pdf.pageCount
  for (let i = 0; i < total; i++) {
    pdf.goToPage(i)
    pdf.line(MARGIN, pdf.height - 34, right, pdf.height - 34, LINE)
    pdf.text(right, pdf.height - 22, `Página ${i + 1} de ${total}`, { size: 7, color: MUTED, align: 'right' })
  }

  return pdf.toBuffer({ title: `${TITLE_BY_KIND[doc.kind]} ${doc.documentId}`, author: issuer.legalName })
}
