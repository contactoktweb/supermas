/**
 * SUPER MÁS ERP/POS - Tipos del Módulo de Cotizaciones y Presupuestos
 *
 * Define modelos, estados, entradas de datos, filtros y KPIs para la gestión comercial
 * de cotizaciones B2B y B2C.
 */

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED'

export interface QuoteItem {
  id: string
  quoteId: string
  productId: string
  productName: string
  sku: string
  barcode?: string
  quantity: number
  unitPrice: number
  unitCost: number
  discountPercent: number
  discountAmount: number
  taxRatePercent: number
  taxAmount: number
  subtotal: number
  total: number
}

export interface Quote {
  id: string
  companyId: string
  quoteNumber: string
  locationId: string
  locationName?: string
  customerId?: string | null
  customerName: string
  customerDocument?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  sellerUserId?: string | null
  sellerUserName?: string | null
  status: QuoteStatus
  issueDate: string
  validUntil: string
  subtotalAmount: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  saleId?: string | null
  notes?: string | null
  termsConditions?: string | null
  items: QuoteItem[]
  itemsCount: number
  totalUnits: number
  createdAt: string
  updatedAt: string
}

export interface CreateQuoteItemInput {
  productId: string
  quantity: number
  unitPrice: number
  discountPercent?: number
  taxRatePercent?: number
}

export interface CreateQuoteInput {
  locationId: string
  customerId?: string | null
  customerName: string
  customerDocument?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  sellerUserId?: string | null
  issueDate?: string
  validUntil: string
  notes?: string | null
  termsConditions?: string | null
  items: CreateQuoteItemInput[]
}

export interface UpdateQuoteInput {
  locationId?: string
  customerId?: string | null
  customerName?: string
  customerDocument?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  sellerUserId?: string | null
  validUntil?: string
  notes?: string | null
  termsConditions?: string | null
  items?: CreateQuoteItemInput[]
}

export interface QuoteFilterParams {
  query?: string
  status?: QuoteStatus | 'ALL'
  customerId?: string
  locationId?: string
  sellerUserId?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export interface QuoteStats {
  totalQuotes: number
  draftCount: number
  sentCount: number
  acceptedCount: number
  convertedCount: number
  expiredCount: number
  rejectedCount: number
  totalQuotedAmount: number
  convertedAmount: number
  conversionRatePercent: number
}

/**
 * Origen del precio de la venta convertida (decide el servidor):
 * - QUOTE_AGREED_PRICE: cotización vigente convertida por quien puede aprobar precios.
 * - CURRENT_PRICE_QUOTE_NOT_VALID: la cotización no está enviada/aceptada o ya venció.
 * - CURRENT_PRICE_NO_PRICE_APPROVAL: quien convierte no tiene el permiso de aprobar precios.
 */
export type QuotePriceSource =
  | 'QUOTE_AGREED_PRICE'
  | 'CURRENT_PRICE_QUOTE_NOT_VALID'
  | 'CURRENT_PRICE_NO_PRICE_APPROVAL'

export interface QuoteConversionResult {
  saleId: string
  saleNumber: string
  totalAmount: number
  idempotentReplay: boolean
  priceSource: QuotePriceSource | null
  accountingEntryNumber: string | null
  quote: Quote
}
