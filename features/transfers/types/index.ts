export type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED'

export type TransferDirection = 'ALL' | 'INBOUND' | 'OUTBOUND'

export interface TransferItem {
  id: string
  productId: string
  productName: string
  sku: string
  barcode?: string
  category: string
  unitOfMeasure: string
  imageUrl?: string
  availableStockAtOrigin: number
  requestedUnits: number
  dispatchedUnits: number
  receivedUnits: number
  unitCost: number // Redacted if no cost.read
  totalCost: number // Redacted if no cost.read
  hasDiscrepancy?: boolean
  discrepancyNote?: string
}

export interface Transfer {
  id: string
  code: string // e.g. "TR-000154"
  originLocationId: string
  originLocationName: string
  originLocationCode: string
  destinationLocationId: string
  destinationLocationName: string
  destinationLocationCode: string
  status: TransferStatus
  items: TransferItem[]
  totalItemsCount: number
  totalUnitsRequested: number
  totalUnitsDispatched: number
  totalUnitsReceived: number
  totalValueAtCost: number // Redacted if no cost.read
  createdByUserId: string
  createdByUserName: string
  createdByUserRole: string
  dispatchedByUserId?: string
  dispatchedByUserName?: string
  dispatchedAt?: string
  receivedByUserId?: string
  receivedByUserName?: string
  receivedAt?: string
  rejectedByUserId?: string
  rejectedByUserName?: string
  rejectedAt?: string
  rejectionReason?: string
  hasIncident: boolean
  incidentNotes?: string
  notes?: string
  createdAt: string // ISO string
  updatedAt: string // ISO string
}

export type TransferSortField =
  | 'createdAt'
  | 'code'
  | 'origin'
  | 'destination'
  | 'units'
  | 'status'
  | 'updatedAt'

export interface TransferFilterParams {
  query?: string
  code?: string
  originLocationId?: string
  destinationLocationId?: string
  direction?: TransferDirection
  activeLocationId?: string
  status?: TransferStatus | 'ALL'
  userId?: string | 'ALL'
  startDate?: string
  endDate?: string
  productId?: string
  page?: number
  pageSize?: number
  sortField?: TransferSortField
  sortDirection?: 'asc' | 'desc'
}

export interface GlobalTransferStats {
  pendingCount: number
  inTransitCount: number
  receivedCount: number
  rejectedCount: number
  totalUnitsTransferred: number
  incidentCount: number
  isCostRedacted: boolean
}

export interface TransferPaginationResult {
  items: Transfer[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  isCostRedacted: boolean
}

export interface UserPermissionContext {
  userId: string
  userRole: 'ADMIN' | 'SELLER' | 'WAREHOUSE_MANAGER' | 'AUDITOR'
  assignedLocationId?: string
  permissions: string[]
}

export interface TransferCreateInput {
  originLocationId: string
  destinationLocationId: string
  items: {
    productId: string
    units: number
  }[]
  notes?: string
}

export interface TransferDispatchInput {
  transferId: string
  notes?: string
}

export interface TransferReceiveInput {
  transferId: string
  receivedItems?: {
    productId: string
    receivedUnits: number
    notes?: string
  }[]
  notes?: string
  evidenceUrl?: string
}

export interface TransferRejectInput {
  transferId: string
  reason: string
}

export interface TransferFlowEdge {
  id: string
  originLocationName: string
  originLocationCode: string
  destinationLocationName: string
  destinationLocationCode: string
  units: number
  itemsCount: number
  status: TransferStatus
  transferCode: string
  transferId: string
  updatedAt: string
}
