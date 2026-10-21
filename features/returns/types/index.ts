/**
 * SUPER MÁS ERP/POS - Tipos del Módulo de Devoluciones (Returns)
 */

export type ReturnType = 'CUSTOMER_RETURN' | 'SUPPLIER_RETURN'
export type ReturnStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED'

/** Condición física de la línea devuelta por el cliente (068). */
export type ReturnItemCondition = 'BUENO' | 'MAL_ESTADO'
/** Destino de la mercancía en mal estado: no reingresa al inventario vendible. */
export type DamagedGoodsDestination = 'PRODUCCION' | 'PROVEEDOR'
export type DamagedGoodsStatus = 'PENDIENTE' | 'ENVIADO'

export interface ReturnItem {
  id: string
  returnId: string
  productId: string
  productName: string
  sku: string
  barcode?: string
  unitOfMeasure?: string
  quantity: number
  unitCost: number
  unitPrice: number
  totalAmount: number
  reason?: string
  condition: ReturnItemCondition
  destination?: DamagedGoodsDestination | null
  dispositionStatus?: DamagedGoodsStatus | null
  dispositionSupplierName?: string | null
  dispositionLocationName?: string | null
  dispositionNotes?: string | null
  dispatchedAt?: string | null
}

export interface ReturnRecord {
  id: string
  code: string
  returnType: ReturnType
  status: ReturnStatus
  sourceDocumentType: 'SALE' | 'PURCHASE'
  sourceDocumentId: string
  sourceDocumentCode?: string
  customerId?: string | null
  customerName?: string | null
  supplierId?: string | null
  supplierName?: string | null
  locationId: string
  locationName: string
  totalItems: number
  totalUnits: number
  totalAmount: number
  reason: string
  notes?: string | null
  createdByUserId?: string | null
  createdByUserName?: string | null
  createdAt: string
  updatedAt: string
  items?: ReturnItem[]
}

export interface ReturnFilterParams {
  query?: string
  returnType?: ReturnType | 'ALL'
  status?: ReturnStatus | 'ALL'
  locationId?: string | 'ALL'
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
  sortBy?: 'created_at' | 'code' | 'total_amount'
  sortDirection?: 'asc' | 'desc'
}

export interface ReturnStats {
  totalReturns: number
  customerReturnsCount: number
  customerReturnsAmount: number
  supplierReturnsCount: number
  supplierReturnsAmount: number
  totalUnitsReturned: number
}

export interface CustomerReturnItemInput {
  productId: string
  quantity: number
  reason?: string
  condition: ReturnItemCondition
  destination?: DamagedGoodsDestination
  supplierId?: string
  productionLocationId?: string
  dispositionNotes?: string
}

export interface ProcessCustomerReturnInput {
  saleId: string
  items: CustomerReturnItemInput[]
  reason: string
  notes?: string
}

export interface DispositionSupplierOption {
  id: string
  name: string
  taxId: string
}

export interface DispositionLocationOption {
  id: string
  code: string
  name: string
}

export interface DispositionSupplierSuggestion {
  productId: string
  supplierId: string
  supplierName: string
  purchaseNumber: string
  purchaseDate: string | null
}

export interface ReturnDispositionOptions {
  suppliers: DispositionSupplierOption[]
  locations: DispositionLocationOption[]
  suggestions: DispositionSupplierSuggestion[]
}

export interface DamagedReturnItem {
  id: string
  returnId: string
  returnCode: string
  returnDate: string
  saleNumber: string | null
  locationName: string | null
  customerName: string | null
  productId: string
  productName: string
  sku: string | null
  quantity: number
  unitCost: number | null
  totalCost: number | null
  reason: string | null
  destination: DamagedGoodsDestination
  status: DamagedGoodsStatus
  supplierName: string | null
  supplierTaxId: string | null
  purchaseNumber: string | null
  productionLocationName: string | null
  dispositionNotes: string | null
  registeredByName: string | null
  dispatchedAt: string | null
  dispatchedByName: string | null
  dispatchReference: string | null
  dispatchNotes: string | null
  returnEntryNumber: string | null
  dispatchEntryNumber: string | null
}

export interface DamagedReturnFilters {
  destination?: DamagedGoodsDestination | 'ALL'
  status?: DamagedGoodsStatus | 'ALL'
  query?: string
  page?: number
  pageSize?: number
}

export interface DamagedReturnSummary {
  pendingSupplierUnits: number
  pendingProductionUnits: number
  pendingLines: number
  sentLines: number
}

export interface DamagedReturnListResult {
  data: DamagedReturnItem[]
  total: number
  page: number
  pageSize: number
  showCost: boolean
  summary: DamagedReturnSummary
}

export interface DispatchDamagedItemInput {
  returnItemId: string
  dispatchReference?: string
  notes?: string
}

export interface DispatchDamagedItemResult {
  alreadyDispatched: boolean
  accountingEntryNumber: string | null
  accountingNote: string | null
}

export interface ProcessSupplierReturnInput {
  purchaseId: string
  items: {
    productId: string
    quantity: number
    reason?: string
  }[]
  reason: string
  notes?: string
}
