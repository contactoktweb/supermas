'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  InventoryMovement,
  KardexFilterParams,
  GlobalKardexStats,
  KardexColumnVisibility,
  KardexSortField,
  ProductKardexSummary,
  UserPermissionContext,
} from '../types'
import { kardexService } from '../services/kardex.service'
import { KardexHeader } from './KardexHeader'
import { KardexStats } from './KardexStats'
import { KardexProductContextBanner } from './KardexProductContextBanner'
import { KardexFilters } from './KardexFilters'
import { KardexColumnSelector } from './KardexColumnSelector'
import { KardexTable } from './KardexTable'
import { KardexTimeline } from './KardexTimeline'
import { KardexDetailDrawer } from './KardexDetailDrawer'
import { KardexRevertModal } from './KardexRevertModal'
import { KardexExportModal } from './KardexExportModal'
import { KardexSkeleton } from './KardexSkeleton'
import { KardexEmptyState } from './KardexEmptyState'
import { KardexErrorState } from './KardexErrorState'
import { KardexToastContainer, KardexToastMessage } from './KardexToast'

const DEFAULT_COLUMN_VISIBILITY: KardexColumnVisibility = {
  createdAt: true,
  product: true,
  sku: true,
  location: true,
  movementType: true,
  document: true,
  quantityIn: true,
  quantityOut: true,
  previousStock: true,
  resultingStock: true,
  unitCost: true,
  averageCost: true,
  totalValue: true,
  user: true,
  actions: true,
}

interface KardexPageProps {
  onNavigate?: (view: string) => void
  initialProductId?: string
  initialLocationId?: string
  userContext?: UserPermissionContext
}

export function KardexPage({
  onNavigate,
  initialProductId,
  initialLocationId,
  userContext,
}: KardexPageProps) {
  // View mode: 'table' or 'timeline'
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table')

  // Filter state
  const [filters, setFilters] = useState<KardexFilterParams>({
    query: '',
    productId: initialProductId || undefined,
    locationId: initialLocationId || 'ALL',
    movementType: 'ALL',
    userId: 'ALL',
    documentQuery: '',
    startDate: undefined,
    endDate: undefined,
    page: 1,
    pageSize: 10,
    sortField: 'createdAt',
    sortDirection: 'desc',
  })

  // Column visibility
  const [columnVisibility, setColumnVisibility] =
    useState<KardexColumnVisibility>(DEFAULT_COLUMN_VISIBILITY)
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false)

  // Data states
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isCostRedacted, setIsCostRedacted] = useState(false)
  const [productSummary, setProductSummary] = useState<ProductKardexSummary | null>(null)

  const [stats, setStats] = useState<GlobalKardexStats>({
    totalMovements: 0,
    totalEntriesCount: 0,
    totalExitsCount: 0,
    totalUnitsIn: 0,
    totalUnitsOut: 0,
    totalValueInAtCost: 0,
    totalValueOutAtCost: 0,
    isCostRedacted: false,
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Drawers and Modals
  const [selectedMovement, setSelectedMovement] = useState<InventoryMovement | null>(null)
  const [revertModal, setRevertModal] = useState<{
    isOpen: boolean
    movement: InventoryMovement | null
  }>({
    isOpen: false,
    movement: null,
  })
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  // Toast Notifications
  const [toasts, setToasts] = useState<KardexToastMessage[]>([])

  const showToast = useCallback(
    (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
      const id = `toast-${Date.now()}`
      setToasts((prev) => [...prev, { id, title, message, type }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4500)
    },
    []
  )

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Load Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [movementsRes, statsRes, summaryRes] = await Promise.all([
        kardexService.listMovements(filters, userContext),
        kardexService.getGlobalStats(filters, userContext),
        filters.productId && filters.productId !== 'ALL'
          ? kardexService.getProductKardexSummary(filters.productId)
          : Promise.resolve(null),
      ])

      setMovements(movementsRes.items)
      setTotal(movementsRes.total)
      setTotalPages(movementsRes.totalPages)
      setIsCostRedacted(movementsRes.isCostRedacted)
      setStats(statsRes)
      setProductSummary(summaryRes)
    } catch (err: any) {
      setError(err.message || 'Error al cargar trazabilidad del Kardex')
    } finally {
      setLoading(false)
    }
  }, [filters, userContext])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter change handler
  const handleFilterChange = (key: keyof KardexFilterParams, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1,
    }))
  }

  // Reset filters
  const handleResetFilters = () => {
    setFilters({
      query: '',
      productId: undefined,
      locationId: 'ALL',
      movementType: 'ALL',
      userId: 'ALL',
      documentQuery: '',
      startDate: undefined,
      endDate: undefined,
      page: 1,
      pageSize: filters.pageSize || 10,
      sortField: 'createdAt',
      sortDirection: 'desc',
    })
    setProductSummary(null)
    showToast('Filtros restablecidos', 'Se muestran todos los movimientos del Kardex.', 'info')
  }

  // Column visibility toggle
  const handleColumnToggle = (key: keyof KardexColumnVisibility) => {
    setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Sort handler
  const handleSort = (field: KardexSortField) => {
    setFilters((prev) => ({
      ...prev,
      sortField: field,
      sortDirection:
        prev.sortField === field && prev.sortDirection === 'asc' ? 'desc' : 'asc',
    }))
  }

  // Compensating Reversion handler
  const handleConfirmReversion = async (movementId: string, reason: string) => {
    try {
      const createdReversion = await kardexService.createReversion(
        { originalMovementId: movementId, reason },
        userContext
      )
      showToast(
        'Reversión registrada con éxito',
        `Se creó el movimiento ${createdReversion.movementNumber} vinculado a la auditoría.`,
        'success'
      )
      setSelectedMovement(null)
      loadData()
    } catch (err: any) {
      showToast('Error al revertir', err.message || 'No se pudo crear la reversión', 'error')
      throw err
    }
  }

  // Document navigation callback
  const handleNavigateDocument = (docType: string, docNumber: string) => {
    if (docType === 'PURCHASE_INVOICE') {
      if (onNavigate) onNavigate('Compras')
      else showToast('Compras', `Navegando a factura de compra ${docNumber}...`, 'info')
    } else if (docType === 'POS_SALE' || docType === 'ELECTRONIC_INVOICE') {
      if (onNavigate) onNavigate('Ventas')
      else showToast('Ventas', `Navegando a comprobante de venta ${docNumber}...`, 'info')
    } else if (docType === 'WAREHOUSE_TRANSFER') {
      if (onNavigate) onNavigate('Transferencias')
      else showToast('Transferencias', `Navegando a transferencia ${docNumber}...`, 'info')
    } else {
      showToast('Documento Origen', `Consultando soporte ${docNumber}...`, 'info')
    }
  }

  const activeFilterCount = [
    Boolean(filters.query?.trim()),
    Boolean(filters.productId && filters.productId !== 'ALL'),
    Boolean(filters.locationId && filters.locationId !== 'ALL'),
    Boolean(filters.movementType && filters.movementType !== 'ALL'),
    Boolean(filters.documentQuery?.trim()),
    Boolean(filters.startDate),
    Boolean(filters.endDate),
  ].filter(Boolean).length

  const hasActiveFilters = activeFilterCount > 0

  return (
    <div className="products-module-wrapper kardex-module-wrapper">
      {/* Toast Notifications */}
      <KardexToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <KardexHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onExport={() => setIsExportModalOpen(true)}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* Stats Cards */}
      <KardexStats stats={stats} />

      {/* Product Context Banner (if filtering by specific product) */}
      {productSummary && (
        <KardexProductContextBanner
          summary={productSummary}
          onClearProductFilter={() => handleFilterChange('productId', undefined)}
          onLocationClick={(locId) => handleFilterChange('locationId', locId)}
          selectedLocationId={filters.locationId}
        />
      )}

      {/* Filters Bar */}
      <div style={{ position: 'relative' }}>
        <KardexFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          onToggleColumnSelector={() =>
            setIsColumnSelectorOpen(!isColumnSelectorOpen)
          }
          isColumnSelectorOpen={isColumnSelectorOpen}
        />

        {/* Column Selector Popover */}
        <KardexColumnSelector
          isOpen={isColumnSelectorOpen}
          onClose={() => setIsColumnSelectorOpen(false)}
          visibility={columnVisibility}
          onChange={handleColumnToggle}
          onReset={() => setColumnVisibility(DEFAULT_COLUMN_VISIBILITY)}
        />
      </div>

      {/* Main Content Area */}
      {loading ? (
        <KardexSkeleton />
      ) : error ? (
        <KardexErrorState message={error} onRetry={loadData} />
      ) : movements.length === 0 ? (
        <KardexEmptyState
          hasFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
        />
      ) : viewMode === 'table' ? (
        <KardexTable
          movements={movements}
          total={total}
          page={filters.page || 1}
          pageSize={filters.pageSize || 10}
          totalPages={totalPages}
          isCostRedacted={isCostRedacted}
          sortField={filters.sortField}
          sortDirection={filters.sortDirection}
          visibility={columnVisibility}
          onSort={handleSort}
          onPageChange={(p) => handleFilterChange('page', p)}
          onPageSizeChange={(sz) => handleFilterChange('pageSize', sz)}
          onSelectMovement={(m) => setSelectedMovement(m)}
          onViewDocument={(m) =>
            handleNavigateDocument(m.sourceDocumentType, m.sourceDocumentNumber)
          }
        />
      ) : (
        <KardexTimeline
          movements={movements}
          isCostRedacted={isCostRedacted}
          onSelectMovement={(m) => setSelectedMovement(m)}
        />
      )}

      {/* Detail Drawer */}
      <KardexDetailDrawer
        movement={selectedMovement}
        isOpen={Boolean(selectedMovement)}
        isCostRedacted={isCostRedacted}
        userContext={userContext}
        onClose={() => setSelectedMovement(null)}
        onNavigateDocument={handleNavigateDocument}
        onOpenRevertModal={(m) => setRevertModal({ isOpen: true, movement: m })}
      />

      {/* Reversion Modal */}
      <KardexRevertModal
        movement={revertModal.movement}
        isOpen={revertModal.isOpen}
        onClose={() => setRevertModal({ isOpen: false, movement: null })}
        onConfirm={handleConfirmReversion}
      />

      {/* Export Modal */}
      <KardexExportModal
        isOpen={isExportModalOpen}
        movements={movements}
        isCostRedacted={isCostRedacted}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  )
}
