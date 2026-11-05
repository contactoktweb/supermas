/**
 * Orden de compra en PDF para enviar al proveedor: empresa compradora, proveedor, lugar de entrega,
 * productos con costo, descuento e IVA, totales y condiciones de pago. Solo servidor.
 */
import { readFileSync } from 'fs'
import path from 'path'
import { PdfColor, SimplePdf, wrapText } from '@/lib/pdf/simple-pdf'
import { Purchase } from '../types'

const NAVY: PdfColor = [0, 27, 92]
const RED: PdfColor = [220, 38, 38]
const TEXT: PdfColor = [17, 24, 39]
const MUTED: PdfColor = [100, 116, 139]
const LINE: PdfColor = [203, 213, 225]
const SOFT: PdfColor = [248, 250, 252]
const WHITE: PdfColor = [255, 255, 255]

const MARGIN = 36
const LOGO_PATH = path.join(process.cwd(), 'public', 'logo-super-documento.jpg')

export interface PurchaseOrderIssuer {
  legalName: string
  tradeName: string
  taxId: string
  verificationDigit: string
  address: string
  city: string
  phone: string
  email: string
}

export interface PurchaseOrderSupplierDetails {
  contactName: string
  address: string
  city: string
}

export interface PurchaseOrderDelivery {
  address: string
  city: string
  phone: string
}

export interface PurchaseOrderPdfParams {
  purchase: Purchase
  issuer: PurchaseOrderIssuer
  supplier: PurchaseOrderSupplierDetails
  delivery: PurchaseOrderDelivery
}

const cop = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)

const quantity = (q: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 }).format(q)

const formatDate = (iso?: string) => {
  if (!iso) return '—'
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00-05:00` : iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'long', year: 'numeric' })
}

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

export const purchaseOrderFileName = (purchase: Purchase) => `Orden-de-compra-${purchase.purchaseNumber}.pdf`

export function buildPurchaseOrderPdf({ purchase, issuer, supplier, delivery }: PurchaseOrderPdfParams): Buffer {
  const pdf = new SimplePdf()
  const right = pdf.width - MARGIN
  const contentWidth = right - MARGIN
  const bottomLimit = pdf.height - 48

  // ---------------------------------------------------------------- Encabezado
  let y = MARGIN
  const logo = companyLogo()
  const logoHeight = logo ? pdf.jpeg(logo, MARGIN, y, 150) : 0

  pdf.text(right, y + 12, 'ORDEN DE COMPRA', { size: 14, font: 'bold', color: NAVY, align: 'right' })
  pdf.text(right, y + 30, `No. ${purchase.purchaseNumber}`, { size: 12, font: 'bold', color: RED, align: 'right' })
  pdf.text(right, y + 45, `Fecha de emisión: ${formatDate(purchase.date)}`, { size: 8, color: MUTED, align: 'right' })
  if (purchase.paymentType === 'CREDITO' && purchase.dueDate) {
    pdf.text(right, y + 56, `Vencimiento del pago: ${formatDate(purchase.dueDate)}`, { size: 8, color: MUTED, align: 'right' })
  }

  y += Math.max(logoHeight, 62) + 12
  pdf.text(MARGIN, y, issuer.legalName, { size: 10.5, font: 'bold', color: NAVY })
  y += 13
  const issuerLines = [
    `NIT ${issuer.taxId}${issuer.verificationDigit ? `-${issuer.verificationDigit}` : ''}${
      issuer.tradeName && issuer.tradeName !== issuer.legalName ? ` · ${issuer.tradeName}` : ''
    }`,
    [issuer.address, issuer.city].filter(Boolean).join(' · '),
    [issuer.phone && `Tel. ${issuer.phone}`, issuer.email].filter(Boolean).join(' · '),
  ].filter(Boolean)
  for (const line of issuerLines) {
    pdf.text(MARGIN, y, line, { size: 8, color: TEXT })
    y += 11
  }

  // ---------------------------------------------------------------- Proveedor y entrega
  y += 10
  const boxTop = y
  const half = contentWidth / 2
  const supplierRows: Array<[string, string]> = [
    ['Razón social', purchase.supplierName],
    ['NIT', purchase.supplierNit || '—'],
    ['Contacto', supplier.contactName || '—'],
    ['Teléfono / correo', [purchase.supplierPhone, purchase.supplierEmail].filter(Boolean).join(' · ') || '—'],
    ['Dirección', [supplier.address, supplier.city].filter(Boolean).join(' · ') || '—'],
  ]
  const deliveryRows: Array<[string, string]> = [
    ['Lugar de entrega', purchase.destinationLocationName || '—'],
    ['Dirección de entrega', [delivery.address, delivery.city].filter(Boolean).join(' · ') || '—'],
    ['Teléfono de la sede', delivery.phone || '—'],
    ['Forma de pago', purchase.paymentType === 'CREDITO' ? 'Crédito' : 'Contado'],
    ['Factura del proveedor', purchase.supplierInvoiceNumber || 'Pendiente'],
  ]
  const rowsHeight = Math.max(supplierRows.length, deliveryRows.length) * 22 + 24
  pdf.rect(MARGIN, boxTop, contentWidth, rowsHeight, { fill: SOFT, stroke: LINE })
  pdf.line(MARGIN + half, boxTop + 8, MARGIN + half, boxTop + rowsHeight - 8)
  pdf.text(MARGIN + 10, boxTop + 15, 'PROVEEDOR', { size: 8, font: 'bold', color: NAVY })
  pdf.text(MARGIN + half + 10, boxTop + 15, 'ENTREGA Y CONDICIONES', { size: 8, font: 'bold', color: NAVY })
  const drawRows = (rows: Array<[string, string]>, x: number) =>
    rows.forEach(([label, value], i) => {
      const rowY = boxTop + 30 + i * 22
      pdf.text(x, rowY, label, { size: 6.5, color: MUTED })
      pdf.text(x, rowY + 9, wrapText(value, half - 24, 8.5)[0], { size: 8.5, color: TEXT })
    })
  drawRows(supplierRows, MARGIN + 10)
  drawRows(deliveryRows, MARGIN + half + 10)
  y = boxTop + rowsHeight + 14

  // ---------------------------------------------------------------- Detalle
  const cols = [
    { label: '#', width: 20, align: 'center' as const },
    { label: 'Código', width: 62, align: 'left' as const },
    { label: 'Producto', width: contentWidth - 20 - 62 - 48 - 74 - 38 - 38 - 80, align: 'left' as const },
    { label: 'Cant.', width: 48, align: 'right' as const },
    { label: 'Costo unit.', width: 74, align: 'right' as const },
    { label: 'Desc.', width: 38, align: 'right' as const },
    { label: 'IVA', width: 38, align: 'right' as const },
    { label: 'Total', width: 80, align: 'right' as const },
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

  purchase.items.forEach((item, index) => {
    const description = wrapText(`${item.productName} (${item.unitOfMeasure})`, cols[2].width - 10, 8)
    const rowHeight = Math.max(1, description.length) * 10 + 8
    if (y + rowHeight > bottomLimit) {
      pdf.addPage()
      y = MARGIN
      tableHeader()
    }
    if (index % 2 === 1) pdf.rect(MARGIN, y, contentWidth, rowHeight, { fill: SOFT })
    const baseline = y + 12
    cellText(0, baseline, String(index + 1))
    cellText(1, baseline, item.sku || '—')
    description.forEach((text, i) => pdf.text(cellX(2) + 5, baseline + i * 10, text, { size: 8 }))
    cellText(3, baseline, quantity(item.quantity))
    cellText(4, baseline, cop(item.unitCost))
    cellText(5, baseline, item.discountPercent ? `${item.discountPercent}%` : '—')
    cellText(6, baseline, `${item.taxRatePercent}%`)
    cellText(7, baseline, cop(item.total))
    y += rowHeight
    pdf.line(MARGIN, y, right, y, [226, 232, 240])
  })

  // ---------------------------------------------------------------- Totales y observaciones
  const totalRows: Array<[string, number]> = [['Subtotal', purchase.subtotal]]
  if (purchase.discountTotal) totalRows.push(['Descuentos', -purchase.discountTotal])
  totalRows.push(['IVA', purchase.taxTotal])
  const totalsHeight = totalRows.length * 15 + 30
  const signaturesHeight = 70

  if (y + 14 + totalsHeight + signaturesHeight > bottomLimit) {
    pdf.addPage()
    y = MARGIN
  }
  y += 14
  const totalsWidth = 220
  const totalsX = right - totalsWidth
  totalRows.forEach(([label, value], i) => {
    const rowY = y + 11 + i * 15
    pdf.text(totalsX + 8, rowY, label, { size: 8.5, color: MUTED })
    pdf.text(right - 8, rowY, cop(value), { size: 8.5, color: TEXT, align: 'right' })
  })
  const payableY = y + totalRows.length * 15 + 4
  pdf.rect(totalsX, payableY, totalsWidth, 24, { fill: NAVY })
  pdf.text(totalsX + 8, payableY + 16, 'TOTAL DE LA ORDEN', { size: 9.5, font: 'bold', color: WHITE })
  pdf.text(right - 8, payableY + 16, cop(purchase.total), { size: 10.5, font: 'bold', color: WHITE, align: 'right' })

  const notesWidth = totalsX - MARGIN - 16
  pdf.rect(MARGIN, y, notesWidth, totalsHeight - 2, { fill: SOFT })
  pdf.text(MARGIN + 10, y + 14, 'OBSERVACIONES', { size: 7, font: 'bold', color: NAVY })
  const notes = purchase.notes?.trim() || 'Entregar la mercancía con la factura electrónica que corresponda a esta orden.'
  wrapText(notes, notesWidth - 20, 8).slice(0, 4).forEach((text, i) =>
    pdf.text(MARGIN + 10, y + 28 + i * 10, text, { size: 8, color: TEXT })
  )
  y = payableY + 50

  // ---------------------------------------------------------------- Firmas
  const signatureWidth = (contentWidth - 40) / 2
  pdf.line(MARGIN, y + 30, MARGIN + signatureWidth, y + 30, MUTED)
  pdf.line(right - signatureWidth, y + 30, right, y + 30, MUTED)
  pdf.text(MARGIN, y + 42, `Elaboró: ${purchase.createdByUserName || issuer.legalName}`, { size: 8, color: MUTED })
  pdf.text(right - signatureWidth, y + 42, 'Recibido por el proveedor', { size: 8, color: MUTED })

  // ---------------------------------------------------------------- Numeración de páginas
  const total = pdf.pageCount
  for (let i = 0; i < total; i++) {
    pdf.goToPage(i)
    pdf.line(MARGIN, pdf.height - 34, right, pdf.height - 34, LINE)
    pdf.text(MARGIN, pdf.height - 22, `Orden de compra ${purchase.purchaseNumber} · ${issuer.legalName}`, { size: 7, color: MUTED })
    pdf.text(right, pdf.height - 22, `Página ${i + 1} de ${total}`, { size: 7, color: MUTED, align: 'right' })
  }

  return pdf.toBuffer({ title: `Orden de compra ${purchase.purchaseNumber}`, author: issuer.legalName })
}
