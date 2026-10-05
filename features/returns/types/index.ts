/**
 * SUPER MÁS ERP/POS - Tipos del Módulo de Devoluciones (Returns)
 */

export type ReturnType = 'CUSTOMER_RETURN' | 'SUPPLIER_RETURN'
export type ReturnStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED'

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

export interface ProcessCustomerReturnInput {
  saleId: string
  items: {
    productId: string
    quantity: number
    reason?: string
  }[]
  reason: string
  notes?: string
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
