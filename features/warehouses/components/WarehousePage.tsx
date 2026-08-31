'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  LocationWithMetrics,
  WarehouseFilters as FilterState,
  GlobalWarehousesStats,
} from '../types'
import { warehouseService } from '../services/warehouse.service'
import { useWarehousePermissions } from '../hooks/useWarehousePermissions'
import { WarehouseHeader } from './WarehouseHeader'
import { WarehouseStats } from './WarehouseStats'
import { WarehouseFilters } from './WarehouseFilters'
import { WarehouseGrid } from './WarehouseGrid'
import { WarehouseTable } from './WarehouseTable'
import { WarehouseFormDrawer } from './WarehouseFormDrawer'
import { WarehouseDeactivateDialog } from './WarehouseDeactivateDialog'
import { WarehouseAdjustStockModal } from './WarehouseAdjustStockModal'
import { WarehouseTransferModal } from './WarehouseTransferModal'
import { WarehouseStatsSkeleton, WarehouseGridSkeleton, WarehouseTableSkeleton } from './WarehouseSkeleton'
import { WarehouseErrorState } from './WarehouseErrorState'
import { WarehouseToastContainer, ToastMessage } from './WarehouseToast'
import { WarehouseFormData, StockAdjustmentFormData, CreateTransferFormData } from '../schemas/warehouse.schema'
import { WarehouseDetailPage } from './detail/WarehouseDetailPage'

interface WarehousePageProps {
  onNavigateWarehouseDetail?: (id: string) => void
  initialWarehouseId?: string
}

export function WarehousePage({
  onNavigateWarehouseDetail,
  initialWarehouseId,
}: WarehousePageProps) {
  const permissions = useWarehousePermissions('SUPERADMIN')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(
    initialWarehouseId || null
  )

  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID')
  const [filters, setFilters] = useState<FilterState>({
    query: '',
    type: 'ALL',
    status: 'ALL',
    inventoryHealth: 'ALL',
    sortBy: 'NAME_ASC',
    page: 1,
    pageSize: 10,
  })

  const [warehouses, setWarehouses] = useState<LocationWithMetrics[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [globalStats, setGlobalStats] = useState<GlobalWarehousesStats>({
    totalWarehouses: 0,
    activeWarehouses: 0,
    inactiveWarehouses: 0,
    totalInventoryValueAtCost: 0,
    totalTodaySales: 0,
    totalLowStockProducts: 0,
    totalPendingTransfers: 0,
    totalActiveAlerts: 0,
  })

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Drawer / Modal states
  const [formDrawerMode, setFormDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingWarehouse, setEditingWarehouse] = useState<LocationWithMetrics | null>(null)
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false)

  const [deactivatingWarehouse, setDeactivatingWarehouse] = useState<LocationWithMetrics | null>(null)
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false)

  const [transferOriginWh, setTransferOriginWh] = useState<LocationWithMetrics | null>(null)
  const [isTransferOpen, setIsTransferOpen] = useState(false)

  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((type: 'success' | 'error' | 'info', title: string, description?: string) => {
    setToasts((prev) => [
      ...prev,
      { id: `toast-${Date.now()}-${Math.random()}`, type, title, description },
    ])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [listResult, statsResult] = await Promise.all([
        warehouseService.listWarehouses(filters),
        warehouseService.getGlobalStats(),
      ])

      setWarehouses(listResult.data)
      setTotalCount(listResult.total)
      setGlobalStats(statsResult)
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servicio de bodegas')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Sync if initialWarehouseId prop changes
  useEffect(() => {
    if (initialWarehouseId) {
      setSelectedWarehouseId(initialWarehouseId)
    }
  }, [initialWarehouseId])

  const handleSelectWarehouse = (id: string) => {
    if (onNavigateWarehouseDetail) {
      onNavigateWarehouseDetail(id)
    } else {
      setSelectedWarehouseId(id)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleOpenCreate = () => {
    setFormDrawerMode('create')
    setEditingWarehouse(null)
    setIsFormDrawerOpen(true)
  }

  const handleOpenEdit = (wh: LocationWithMetrics) => {
    setFormDrawerMode('edit')
    setEditingWarehouse(wh)
    setIsFormDrawerOpen(true)
  }

  const handleOpenDeactivate = (wh: LocationWithMetrics) => {
    setDeactivatingWarehouse(wh)
    setIsDeactivateOpen(true)
  }

  const handleOpenTransfer = (wh: LocationWithMetrics) => {
    setTransferOriginWh(wh)
    setIsTransferOpen(true)
  }

  const handleFormSubmit = async (data: WarehouseFormData) => {
    if (formDrawerMode === 'create') {
      const created = await warehouseService.createWarehouse(data, {
        id: 'usr-admin',
        name: 'Admin Mauricio',
      })
      addToast(
        'success',
        'Bodega creada exitosamente',
        `La bodega "${created.name}" (${created.code}) ha sido incorporada al ERP.`
      )
    } else if (editingWarehouse) {
      const updated = await warehouseService.updateWarehouse(
        editingWarehouse.id,
        data,
        { id: 'usr-admin', name: 'Admin Mauricio' }
      )
      addToast(
        'success',
        'Cambios guardados',
        `La información de "${updated.name}" ha sido actualizada.`
      )
    }
    await loadData()
  }

  const handleDeactivateConfirm = async (id: string) => {
    const deactivated = await warehouseService.deactivateWarehouse(id, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
    })
    addToast(
      'info',
      'Bodega desactivada',
      `La bodega "${deactivated.name}" ya no recibirá nuevas operaciones. Datos conservados.`
    )
    await loadData()
  }

  const handleCreateTransfer = async (data: CreateTransferFormData) => {
    const newTr = await warehouseService.createTransfer(data, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
    })
    addToast(
      'success',
      'Transferencia registrada',
      `Transferencia ${newTr.code} creada y en espera de despacho.`
    )
    await loadData()
  }

  const handleExport = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'Código,Nombre,Tipo,Estado,Ciudad,Dirección,Productos,Inventario_Costo,Ventas_Hoy,Stock_Bajo,Alertas',
        ...warehouses.map(
          (w) =>
            `"${w.code}","${w.name}","${w.type}","${w.status}","${w.city}","${w.address}",${w.productsCount},${w.inventoryValueAtCost},${w.todaySalesAmount},${w.lowStockProductsCount},${w.activeAlertsCount}`
        ),
      ].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `supermas_bodegas_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    addToast('info', 'Exportación generada', 'Archivo CSV descargado con éxito.')
  }

  const handleClearFilters = () => {
    setFilters({
      query: '',
      type: 'ALL',
      status: 'ALL',
      inventoryHealth: 'ALL',
      sortBy: 'NAME_ASC',
      page: 1,
      pageSize: 10,
    })
  }

  // If a warehouse detail is active
  if (selectedWarehouseId) {
    return (
      <WarehouseDetailPage
        warehouseId={selectedWarehouseId}
        onBack={() => setSelectedWarehouseId(null)}
      />
    )
  }

  return (
    <div className="warehouse-module-page page-enter">
      <WarehouseToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Header */}
      <WarehouseHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenCreate={handleOpenCreate}
        onExport={handleExport}
        canCreate={permissions.canCreateWarehouse}
      />

      {/* Global Top Stats */}
      {isLoading && warehouses.length === 0 ? (
        <WarehouseStatsSkeleton />
      ) : (
        <WarehouseStats stats={globalStats} canReadCost={permissions.canReadCost} />
      )}

      {/* Filters Bar */}
      <WarehouseFilters
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Error state if any */}
      {error && (
        <WarehouseErrorState message={error} onRetry={loadData} />
      )}

      {/* Content: Grid or Table */}
      {isLoading ? (
        viewMode === 'GRID' ? (
          <WarehouseGridSkeleton />
        ) : (
          <WarehouseTableSkeleton />
        )
      ) : viewMode === 'GRID' ? (
        <WarehouseGrid
          warehouses={warehouses}
          permissions={permissions}
          onSelect={handleSelectWarehouse}
          onEdit={handleOpenEdit}
          onDeactivate={handleOpenDeactivate}
          onAdjustStock={() => {}}
          onTransfer={handleOpenTransfer}
          onOpenInventory={(id) => handleSelectWarehouse(id)}
          onOpenKardex={(id) => handleSelectWarehouse(id)}
          onOpenUsers={(id) => handleSelectWarehouse(id)}
          onClearFilters={handleClearFilters}
        />
      ) : (
        <WarehouseTable
          warehouses={warehouses}
          permissions={permissions}
          total={totalCount}
          page={filters.page || 1}
          pageSize={filters.pageSize || 10}
          sortBy={filters.sortBy}
          onPageChange={(page) => setFilters((p) => ({ ...p, page }))}
          onPageSizeChange={(pageSize) => setFilters((p) => ({ ...p, pageSize, page: 1 }))}
          onSortChange={(sortBy) => setFilters((p) => ({ ...p, sortBy }))}
          onSelect={handleSelectWarehouse}
          onEdit={handleOpenEdit}
          onDeactivate={handleOpenDeactivate}
          onClearFilters={handleClearFilters}
        />
      )}

      {/* Drawers and Modals */}
      <WarehouseFormDrawer
        mode={formDrawerMode}
        warehouse={editingWarehouse}
        isOpen={isFormDrawerOpen}
        onClose={() => setIsFormDrawerOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <WarehouseDeactivateDialog
        warehouse={deactivatingWarehouse}
        isOpen={isDeactivateOpen}
        onClose={() => setIsDeactivateOpen(false)}
        onConfirm={handleDeactivateConfirm}
      />

      <WarehouseTransferModal
        originWarehouse={transferOriginWh}
        allWarehouses={warehouses}
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        onSubmit={handleCreateTransfer}
      />
    </div>
  )
}
