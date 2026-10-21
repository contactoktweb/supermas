/**
 * SUPER MÁS ERP/POS — Comprobante impreso para el cliente (formato 15 × 20 cm)
 *
 * Modelo de presentación de una venta POS y, si existe, de su Factura Electrónica de Venta.
 * Todos los valores provienen de la base de datos (sales, sale_items, sale_payments,
 * electronic_invoices y companies); este módulo no calcula impuestos nuevos ni inventa números fiscales.
 */

export interface CustomerReceiptIssuer {
  legalName: string
  tradeName?: string
  nit?: string
  dv?: string
  address?: string
  city?: string
  department?: string
  phone?: string
  logoUrl?: string
}

export interface CustomerReceiptCustomer {
  name: string
  documentType?: string
  documentNumber?: string
  isFinalConsumer: boolean
  /** Responsabilidades fiscales DIAN del adquiriente (p. ej. R-99-PN) cuando se conocen. */
  taxLevelCodes?: string
}

export interface CustomerReceiptLine {
  id: string
  description: string
  sku?: string
  quantity: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  /** Etiqueta del tratamiento de IVA: "19%", "5%", "Exento", "Excluido", "0%". */
  ivaLabel: string
  total: number
}

export interface CustomerReceiptTax {
  key: string
  label: string
  taxableBase: number
  taxAmount: number
}

export interface CustomerReceiptPayment {
  methodLabel: string
  amount: number
  bankName?: string
  accountLast4?: string
  reference?: string
  isCash: boolean
}

/** Datos fiscales de la Factura Electrónica asociada a la venta (solo si existe). */
export interface CustomerReceiptFiscal {
  invoiceId: string
  documentNumber: string
  environment?: 'HABILITACION' | 'PRODUCCION'
  transmissionState: string
  transmissionLabel: string
  isAccepted: boolean
  validatedAt?: string
  resolutionLegend: string | null
  cufe?: string
  qrData?: string
}

export interface CustomerReceiptData {
  saleId: string
  saleNumber: string
  saleStatus: string
  /** Fecha y hora de emisión ya formateadas en America/Bogota. */
  issuedDate: string
  issuedTime: string
  locationName?: string
  sellerName?: string
  cashRegisterLabel?: string
  issuer: CustomerReceiptIssuer
  customer: CustomerReceiptCustomer
  lines: CustomerReceiptLine[]
  grossSubtotal: number
  discountTotal: number
  netSubtotal: number
  taxes: CustomerReceiptTax[]
  taxTotal: number
  total: number
  payments: CustomerReceiptPayment[]
  /** Efectivo entregado por el cliente (solo cuando el POS lo informa) y su cambio. */
  cashReceived?: number
  changeAmount?: number
  fiscal: CustomerReceiptFiscal | null
}
