import { resolutionLegend, TRANSMISSION_LABELS } from '@/features/invoices/components/DianFiscalPanel'
import { DIAN_FINAL_CONSUMER_DOC } from '@/features/invoices/services/dian/dian-document'
import { Invoice } from '@/features/invoices/types'
import {
  customerReceiptRepository,
  CustomerReceiptRepository,
  RawCustomerReceipt,
  RawReceiptSaleItem,
} from '../repositories/customer-receipt.repository'
import {
  CustomerReceiptData,
  CustomerReceiptFiscal,
  CustomerReceiptLine,
  CustomerReceiptPayment,
  CustomerReceiptTax,
} from '../types'

const BOGOTA_TZ = 'America/Bogota'
const FINAL_CONSUMER_TAX_LEVEL = 'R-99-PN'
const CASH_METHOD = 'CASH'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  BANK_TRANSFER: 'Transferencia',
  CREDIT_CARD: 'Tarjeta de crédito',
  DEBIT_CARD: 'Tarjeta débito',
  CREDIT: 'Crédito',
  MIXED: 'Mixto',
}

const num = (v: number | string | null | undefined): number => Number(v || 0)
const round2 = (v: number): number => Math.round(v * 100) / 100

/** Código de impuesto con la misma regla que la representación gráfica de la factura. */
function taxKey(rate: number, treatment?: string | null): string {
  if (rate > 0) return `IVA_${rate}`
  if (treatment === 'EXCLUIDO') return 'EXCLUIDO'
  if (treatment === 'EXENTO') return 'EXENTO'
  return 'IVA_0'
}

function ivaLabel(rate: number, key: string): string {
  if (rate > 0) return `${rate}%`
  if (key === 'EXCLUIDO') return 'Excluido'
  if (key === 'EXENTO') return 'Exento'
  return '0%'
}

function taxSummaryLabel(key: string, rate: number): string {
  if (key === 'EXCLUIDO') return 'Excluido de IVA'
  if (key === 'EXENTO') return 'Exento de IVA (0%)'
  return `IVA ${rate}%`
}

function mapSaleLine(it: RawReceiptSaleItem): CustomerReceiptLine & { key: string; rate: number; base: number; tax: number } {
  const quantity = num(it.quantity)
  const unitPrice = num(it.unit_price)
  const net = num(it.subtotal)
  const rate = num(it.tax_rate_percent)
  const key = taxKey(rate, it.iva_treatment || it.products?.iva_treatment)
  return {
    id: it.id,
    description: it.products?.name || 'Producto',
    sku: it.products?.sku || undefined,
    quantity,
    unitPrice,
    discountPercent: num(it.discount_percent),
    discountAmount: Math.max(0, round2(quantity * unitPrice - net)),
    ivaLabel: ivaLabel(rate, key),
    total: num(it.total),
    key,
    rate,
    base: net,
    tax: num(it.tax_amount),
  }
}

function buildTaxes(lines: Array<{ key: string; rate: number; base: number; tax: number }>): CustomerReceiptTax[] {
  const byKey = new Map<string, { rate: number; base: number; tax: number }>()
  for (const l of lines) {
    const cur = byKey.get(l.key) || { rate: l.rate, base: 0, tax: 0 }
    cur.base += l.base
    cur.tax += l.tax
    byKey.set(l.key, cur)
  }
  return [...byKey.entries()]
    .sort((a, b) => b[1].rate - a[1].rate)
    .map(([key, v]) => ({ key, label: taxSummaryLabel(key, v.rate), taxableBase: round2(v.base), taxAmount: round2(v.tax) }))
}

function formatBogotaDate(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('es-CO', { timeZone: BOGOTA_TZ, day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('es-CO', { timeZone: BOGOTA_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
  }
}

/** Fecha/hora de emisión de la factura tal como quedó en el XML (issue_date / issue_time, hora Colombia). */
function invoiceIssueDate(invoice: Invoice): { date: string; time: string } | null {
  if (!invoice.issueDate) return null
  const [y, m, d] = invoice.issueDate.slice(0, 10).split('-')
  return { date: `${d}/${m}/${y}`, time: (invoice.issueTime || invoice.issuedAtBogota || '').slice(0, 5) }
}

function buildFiscal(invoice: Invoice): CustomerReceiptFiscal {
  const state = invoice.transmissionState || 'PENDING'
  return {
    invoiceId: invoice.id,
    documentNumber: invoice.invoiceNumber,
    environment: invoice.environment,
    transmissionState: state,
    transmissionLabel: TRANSMISSION_LABELS[state]?.label || state,
    isAccepted: state === 'ACCEPTED',
    validatedAt: state === 'ACCEPTED' && invoice.dianResponseDate
      ? new Date(invoice.dianResponseDate).toLocaleString('es-CO', { timeZone: BOGOTA_TZ })
      : undefined,
    resolutionLegend: resolutionLegend(invoice),
    cufe: invoice.dianCufe,
    qrData: invoice.dianQrCode,
  }
}

function buildPayments(raw: RawCustomerReceipt, total: number): CustomerReceiptPayment[] {
  const banks = new Map(raw.bankAccounts.map((b) => [b.id, b]))
  if (raw.payments.length) {
    return raw.payments.map((p) => {
      const bank = p.bank_account_id ? banks.get(p.bank_account_id) : undefined
      return {
        methodLabel: PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method,
        amount: num(p.amount),
        bankName: bank?.bank_name,
        accountLast4: bank?.last4,
        reference: p.reference || undefined,
        isCash: p.payment_method === CASH_METHOD,
      }
    })
  }
  // Ventas anteriores al registro detallado de pagos: se muestra el medio de pago de la venta.
  const method = raw.sale.payment_method
  if (!method) return []
  return [{ methodLabel: PAYMENT_METHOD_LABELS[method] || method, amount: total, isCash: method === CASH_METHOD }]
}

export interface CustomerReceiptOptions {
  /** Efectivo entregado por el cliente, informado por el POS al cerrar el cobro. */
  cashReceived?: number
}

export function buildCustomerReceipt(raw: RawCustomerReceipt, options: CustomerReceiptOptions = {}): CustomerReceiptData {
  const { sale, invoice, company } = raw
  const cust = sale.customers
  const documentNumber = cust?.document_number || undefined
  const isFinalConsumer = documentNumber === DIAN_FINAL_CONSUMER_DOC
  const personName = `${cust?.first_name || ''} ${cust?.last_name || ''}`.trim()
  const customerName = cust?.company_name || personName || 'Consumidor final'
  // En la factura electrónica, el XML usa R-99-PN cuando el adquiriente no tiene responsabilidades registradas.
  const taxLevelCodes = cust?.dian_tax_level_codes || (isFinalConsumer || invoice ? FINAL_CONSUMER_TAX_LEVEL : undefined)

  const saleLines = raw.items.map(mapSaleLine)
  const useInvoice = Boolean(invoice && invoice.items.length)

  const lines: CustomerReceiptLine[] = useInvoice
    ? invoice!.items.map((it) => {
        const key = it.taxRatePercent > 0 ? `IVA_${it.taxRatePercent}` : it.taxCode
        return {
          id: it.id,
          description: it.productName,
          sku: it.sku || undefined,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountPercent: it.discountPercent,
          discountAmount: it.discountAmount,
          ivaLabel: ivaLabel(it.taxRatePercent, key),
          total: it.total,
        }
      })
    : saleLines.map(({ key: _k, rate: _r, base: _b, tax: _t, ...line }) => line)

  const taxes: CustomerReceiptTax[] = useInvoice
    ? invoice!.taxesBreakdown.map((t) => ({ key: t.taxCode, label: t.taxName, taxableBase: t.taxableBase, taxAmount: t.taxAmount }))
    : buildTaxes(saleLines)

  // Base neta (después de descuentos) desde las líneas, igual que la factura electrónica.
  // sales.subtotal_amount es el valor bruto antes de descuentos.
  const saleNet = saleLines.length ? round2(saleLines.reduce((s, l) => s + l.base, 0)) : round2(num(sale.subtotal_amount) - num(sale.discount_amount))
  const saleDiscount = saleLines.length ? round2(saleLines.reduce((s, l) => s + l.discountAmount, 0)) : num(sale.discount_amount)
  const netSubtotal = invoice ? invoice.subtotal : saleNet
  const discountTotal = useInvoice ? invoice!.discountTotal : saleDiscount
  const taxTotal = invoice ? invoice.taxTotal : num(sale.tax_amount)
  const total = invoice ? invoice.total : num(sale.total_amount)

  const payments = buildPayments(raw, total)
  const cashDue = payments.filter((p) => p.isCash).reduce((s, p) => s + p.amount, 0)
  const received = options.cashReceived
  const hasValidCash = cashDue > 0 && received !== undefined && Number.isFinite(received) && received >= cashDue

  const issued = (invoice && invoiceIssueDate(invoice)) || formatBogotaDate(sale.created_at)
  const register = raw.cashRegister

  return {
    saleId: sale.id,
    saleNumber: sale.sale_number,
    saleStatus: sale.status,
    issuedDate: issued.date,
    issuedTime: issued.time,
    locationName: sale.locations?.name || undefined,
    sellerName: sale.users?.full_name || undefined,
    cashRegisterLabel: register ? [register.name, register.code].filter(Boolean).join(' · ') : undefined,
    issuer: {
      legalName: company?.business_name || '',
      tradeName: company?.trade_name || undefined,
      nit: company?.tax_id || undefined,
      dv: company?.verification_digit || undefined,
      address: company?.address || undefined,
      city: company?.city || undefined,
      department: company?.department || undefined,
      phone: company?.phone || undefined,
      logoUrl: company?.logo_url || undefined,
    },
    customer: {
      name: customerName,
      documentType: cust?.document_type || undefined,
      documentNumber,
      isFinalConsumer,
      taxLevelCodes,
    },
    lines,
    grossSubtotal: round2(netSubtotal + discountTotal),
    discountTotal,
    netSubtotal,
    taxes,
    taxTotal,
    total,
    payments,
    cashReceived: hasValidCash ? received : undefined,
    changeAmount: hasValidCash ? round2((received as number) - cashDue) : undefined,
    fiscal: invoice ? buildFiscal(invoice) : null,
  }
}

export class CustomerReceiptService {
  constructor(private repo: CustomerReceiptRepository = customerReceiptRepository) {}

  /** null = la venta no existe o el usuario no tiene acceso. */
  async getBySaleId(saleId: string, options: CustomerReceiptOptions = {}): Promise<CustomerReceiptData | null> {
    const raw = await this.repo.findBySaleId(saleId)
    return raw ? buildCustomerReceipt(raw, options) : null
  }
}

export const customerReceiptService = new CustomerReceiptService()
