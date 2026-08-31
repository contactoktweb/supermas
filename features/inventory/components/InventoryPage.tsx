'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  ConsolidatedProductStock,
  InventoryStockLevel,
  InventoryFilterParams,
  InventoryKPIs,
  InventoryViewMode,
  InventoryTabFilter,
  InventorySortField,
  InventoryColumnVisibility,
  StockAdjustmentInput,
  QuickTransferInput,
  PhysicalCountSession,
  UserPermissionContext,
} from '../types'
import { inventoryService } from '../services/inventory.service'
import { InventoryHeader } from './InventoryHeader'
import { InventoryKPIsGrid } from './InventoryKPIsGrid'
import { InventoryStatusTabs } from './InventoryStatusTabs'
import { InventoryFilters } from './InventoryFilters'
import { InventoryColumnSelector } from './InventoryColumnSelector'
import { InventoryLowStockActionsBar } from './InventoryLowStockActionsBar'
import { InventoryTable } from './InventoryTable'
import { InventoryEmptyState } from './InventoryEmptyState'
import { InventoryProductDrawer } from './InventoryProductDrawer'
import { InventoryAdjustModal } from './InventoryAdjustModal'
import { InventoryPhysicalCountModal } from './InventoryPhysicalCountModal'
import { InventoryQuickTransferModal } from './InventoryQuickTransferModal'
import { InventoryExportModal } from './InventoryExportModal'
import { AppIcon } from '@/components/ui/Icon'

interface InventoryPageProps {
  initialLocationId?: string
  initialStatus?: string
  onNavigate?: (view: string, params?: Record<string, string>) => void
  userContext?: UserPermissionContext
}

const DEFAULT_COLUMN_VISIBILITY: InventoryColumnVisibility = {
  product: true,
  sku: true,
  barcode: true,
  category: true,
  location: true,
  currentStock: true,
  minStock: true,
  criticalStock: true,
  status: true,
  averageCost: true,
  totalValue: true,
  lastMovement: true,
  actions: true,
}

export function InventoryPage({
  initialLocationId,
  initialStatus,
  onNavigate,
  userContext = {
    userId: 'usr-admin-01',
    userRole: 'ADMIN',
    permissions: ['inventory.read', 'inventory.adjust', 'inventory.transfer', 'cost.read'],
  },
}: InventoryPageProps) {
  const [viewMode, setViewMode] = useState<InventoryViewMode>('CONSOLIDATED')
  const [activeTab, setActiveTab] = useState<InventoryTabFilter>(
    (initialStatus as InventoryTabFilter) || 'ALL'
  )

  const [filters, setFilters] = useState<InventoryFilterParams>({
    query: '',
    locationId: initialLocationId || 'ALL',
    category: 'ALL',
    brand: 'ALL',
    stockHealth: 'ALL',
    hasStock: 'ALL',
    page: 1,
    pageSize: 10,
    sortField: 'productName',
    sortDirection: 'asc',
  })

  const [kpis, setKpis] = useState<InventoryKPIs>({
    totalValueAtCost: 0,
    totalUnitsAvailable: 0,
    productsWithStock: 0,
    lowStockCount: 0,
    criticalStockCount: 0,
    outOfStockCount: 0,
    isCostRedacted: false,
  })

  const [consolidatedData, setConsolidatedData] = useState<ConsolidatedProductStock[]>([])
  const [byLocationData, setByLocationData] = useState<InventoryStockLevel[]>([])
  const [totalRecords, setTotalRecords] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Drawers & Modals state
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
  const [adjustTargetProduct, setAdjustTargetProduct] = useState<{
    productId?: string
    locationId?: string
  }>({})
  const [isPhysicalCountModalOpen, setIsPhysicalCountModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [transferTargetProduct, setTransferTargetProduct] = useState<{
    productId?: string
    originLocationId?: string
  }>({})
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false)

  // Column Visibility
  const [colVisibility, setColVisibility] =
    useState<InventoryColumnVisibility>(DEFAULT_COLUMN_VISIBILITY)

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{
    text: string
    type: 'success' | 'info' | 'error'
  } | null>(null)

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  const canSeeCost = inventoryService.hasCostReadPermission(userContext)

  // Load KPIs
  const loadKPIs = useCallback(async () => {
    try {
      const data = await inventoryService.getKPIs(userContext)
      setKpis(data)
    } catch (err) {
      console.error('Error loading inventory KPIs:', err)
    }
  }, [userContext])

  // Load Table Data
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const queryParams: InventoryFilterParams = {
        ...filters,
        tab: activeTab,
        viewMode,
      }

      if (viewMode === 'CONSOLIDATED') {
        const result = await inventoryService.getConsolidatedStock(
          queryParams,
          userContext
        )
        setConsolidatedData(result.data)
        setTotalRecords(result.total)
      } else {
        const result = await inventoryService.getStockLevelsByLocation(
          queryParams,
          userContext
        )
        setByLocationData(result.data)
        setTotalRecords(result.total)
      }
    } catch (err) {
      console.error('Error loading inventory data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [filters, activeTab, viewMode, userContext])

  useEffect(() => {
    loadKPIs()
  }, [loadKPIs])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter handlers
  const handleFilterChange = (newFilters: Partial<InventoryFilterParams>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }

  const handleResetFilters = () => {
    setFilters({
      query: '',
      locationId: 'ALL',
      category: 'ALL',
      brand: 'ALL',
      stockHealth: 'ALL',
      hasStock: 'ALL',
      page: 1,
      pageSize: 10,
      sortField: 'productName',
      sortDirection: 'asc',
    })
    setActiveTab('ALL')
    showToast('Filtros restablecidos correctamente', 'info')
  }

  const hasActiveFilters =
    Boolean(filters.query) ||
    filters.locationId !== 'ALL' ||
    filters.category !== 'ALL' ||
    filters.brand !== 'ALL' ||
    filters.stockHealth !== 'ALL' ||
    filters.hasStock !== 'ALL' ||
    activeTab !== 'ALL'

  // Selected product for drawer
  const selectedProduct = consolidatedData.find((p) => p.productId === selectedProductId) || null

  // Adjust stock handler
  const handleExecuteAdjustment = async (data: StockAdjustmentInput) => {
    const result = await inventoryService.adjustStock(data, userContext)
    showToast(
      `Ajuste registrado (${result.movementDoc}). Saldo: ${result.previousStock} → ${result.resultingStock} uds.`,
      'success'
    )
    await loadKPIs()
    await loadData()
  }

  // Physical count handler
  const handleApplyPhysicalCount = async (session: PhysicalCountSession) => {
    const result = await inventoryService.applyPhysicalCountAdjustments(
      session,
      userContext
    )
    showToast(
      `Conteo ${session.sessionNumber} finalizado. Se aplicaron ${result.appliedCount} ajuste(s) al inventario y Kardex.`,
      'success'
    )
    await loadKPIs()
    await loadData()
  }

  // Quick transfer handler
  const handleExecuteTransfer = async (data: QuickTransferInput) => {
    showToast(
      `Transferencia de ${data.quantity} unidades iniciada correctamente hacia la bodega de destino.`,
      'success'
    )
    if (onNavigate) {
      onNavigate('Transferencias')
    }
  }

  // Navigate to Kardex with product filter
  const handleGoToKardex = (prodId?: string, locId?: string) => {
    if (onNavigate) {
      const params: Record<string, string> = {}
      if (prodId) params.productId = prodId
      if (locId) params.locationId = locId
      onNavigate('Kardex', params)
    } else {
      window.location.href = `/kardex${prodId ? `?productId=${prodId}` : ''}`
    }
  }

  return (
    <div className="dashboard-content inventory-module-container page-enter">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`global-toast-banner ${toastMessage.type} animate-slide-down`}>
          <AppIcon
            name={
              toastMessage.type === 'success'
                ? 'check'
                : toastMessage.type === 'error'
                ? 'close'
                : 'info'
            }
            size={16}
          />
          <span>{toastMessage.text}</span>
          <button
            type="button"
            className="icon-button close-toast-btn"
            onClick={() => setToastMessage(null)}
          >
            <AppIcon name="close" size={12} />
          </button>
        </div>
      )}

      {/* 1. Header */}
      <InventoryHeader
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          setViewMode(mode)
          setFilters((f) => ({ ...f, page: 1 }))
        }}
        onOpenAdjustModal={() => {
          setAdjustTargetProduct({})
          setIsAdjustModalOpen(true)
        }}
        onOpenPhysicalCountModal={() => setIsPhysicalCountModalOpen(true)}
        onOpenTransferModal={() => {
          setTransferTargetProduct({})
          setIsTransferModalOpen(true)
        }}
        onGoToKardex={() => handleGoToKardex()}
        onOpenExportModal={() => setIsExportModalOpen(true)}
      />

      {/* 2. Operational KPIs (Directly focused on Stock Levels) */}
      <InventoryKPIsGrid
        kpis={kpis}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab)
          setFilters((f) => ({ ...f, page: 1 }))
        }}
        isLoading={isLoading}
      />

      {/* 3. Status Tabs: Todo | Stock bajo | Crítico | Agotados */}
      <InventoryStatusTabs
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab)
          setFilters((f) => ({ ...f, page: 1 }))
        }}
        kpis={kpis}
      />

      {/* 4. Actionable Low Stock Replenishment Bar */}
      <InventoryLowStockActionsBar
        activeTab={activeTab}
        count={
          activeTab === 'LOW_STOCK'
            ? kpis.lowStockCount
            : activeTab === 'CRITICAL'
            ? kpis.criticalStockCount
            : activeTab === 'OUT_OF_STOCK'
            ? kpis.outOfStockCount
            : 0
        }
        onOpenTransfer={() => {
          setTransferTargetProduct({})
          setIsTransferModalOpen(true)
        }}
        onOpenAdjust={() => {
          setAdjustTargetProduct({})
          setIsAdjustModalOpen(true)
        }}
      />

      {/* 5. Filters Bar */}
      <div className="filters-wrapper-relative">
        <InventoryFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          onToggleColumnSelector={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Column Selector Popover */}
        {isColumnSelectorOpen && (
          <InventoryColumnSelector
            visibility={colVisibility}
            onChange={setColVisibility}
            onClose={() => setIsColumnSelectorOpen(false)}
            viewMode={viewMode}
          />
        )}
      </div>

      {/* 6. Main Table or Empty State */}
      {!isLoading && totalRecords === 0 ? (
        <InventoryEmptyState
          hasFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
        />
      ) : (
        <InventoryTable
          viewMode={viewMode}
          consolidatedData={consolidatedData}
          byLocationData={byLocationData}
          totalRecords={totalRecords}
          page={filters.page || 1}
          pageSize={filters.pageSize || 10}
          sortField={filters.sortField || 'productName'}
          sortDirection={filters.sortDirection || 'asc'}
          visibility={colVisibility}
          canSeeCost={canSeeCost}
          isLoading={isLoading}
          onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          onPageSizeChange={(s) => setFilters((f) => ({ ...f, pageSize: s, page: 1 }))}
          onSortChange={(field) => {
            const nextDir =
              filters.sortField === field && filters.sortDirection === 'asc' ? 'desc' : 'asc'
            setFilters((f) => ({ ...f, sortField: field, sortDirection: nextDir, page: 1 }))
          }}
          onSelectProduct={(pId) => setSelectedProductId(pId)}
          onOpenAdjust={(pId, locId) => {
            setAdjustTargetProduct({ productId: pId, locationId: locId })
            setIsAdjustModalOpen(true)
          }}
          onOpenTransfer={(pId, locId) => {
            setTransferTargetProduct({ productId: pId, originLocationId: locId })
            setIsTransferModalOpen(true)
          }}
          onOpenKardex={(pId, locId) => handleGoToKardex(pId, locId)}
        />
      )}

      {/* 7. Product Detail Quick Drawer */}
      <InventoryProductDrawer
        product={selectedProduct}
        isOpen={Boolean(selectedProductId)}
        canSeeCost={canSeeCost}
        onClose={() => setSelectedProductId(null)}
        onOpenAdjust={(pId, locId) => {
          setSelectedProductId(null)
          setAdjustTargetProduct({ productId: pId, locationId: locId })
          setIsAdjustModalOpen(true)
        }}
        onOpenTransfer={(pId, locId) => {
          setSelectedProductId(null)
          setTransferTargetProduct({ productId: pId, originLocationId: locId })
          setIsTransferModalOpen(true)
        }}
        onOpenKardex={(pId) => {
          setSelectedProductId(null)
          handleGoToKardex(pId)
        }}
      />

      {/* 8. Modals */}
      <InventoryAdjustModal
        isOpen={isAdjustModalOpen}
        productId={adjustTargetProduct.productId}
        locationId={adjustTargetProduct.locationId}
        consolidatedProducts={consolidatedData}
        stockLevels={byLocationData}
        onClose={() => {
          setIsAdjustModalOpen(false)
          setAdjustTargetProduct({})
        }}
        onSubmit={handleExecuteAdjustment}
      />

      <InventoryPhysicalCountModal
        isOpen={isPhysicalCountModalOpen}
        onClose={() => setIsPhysicalCountModalOpen(false)}
        onApplyDiscrepancies={handleApplyPhysicalCount}
      />

      <InventoryQuickTransferModal
        isOpen={isTransferModalOpen}
        productId={transferTargetProduct.productId}
        originLocationId={transferTargetProduct.originLocationId}
        consolidatedProducts={consolidatedData}
        onClose={() => {
          setIsTransferModalOpen(false)
          setTransferTargetProduct({})
        }}
        onSubmit={handleExecuteTransfer}
      />

      <InventoryExportModal
        isOpen={isExportModalOpen}
        viewMode={viewMode}
        data={viewMode === 'CONSOLIDATED' ? consolidatedData : byLocationData}
        canSeeCost={canSeeCost}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  )
}
