'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Supplier,
  SupplierFilterParams,
  SupplierStats as SupplierStatsType,
  CreateSupplierInput,
  UpdateSupplierInput,
  UserPermissionContext,
} from '../types'
import { supplierService } from '../services/supplier.service'
import { locationService, LocationOption } from '@/features/purchases/services/location.service'
import { SupplierHeader } from './SupplierHeader'
import { SupplierStats } from './SupplierStats'
import { SupplierFilters } from './SupplierFilters'
import { SupplierTable } from './SupplierTable'
import { SupplierFormDrawer } from './SupplierFormDrawer'
import { SupplierDetailDrawer } from './SupplierDetailDrawer'
import { SupplierDeactivateModal } from './SupplierDeactivateModal'
import { SupplierPaymentModal } from './SupplierPaymentModal'
import { SupplierExportModal } from './SupplierExportModal'
import { SupplierStatsSkeleton, SupplierTableSkeleton } from './SupplierSkeleton'
import { SupplierEmptyState } from './SupplierEmptyState'
import { SupplierErrorState } from './SupplierErrorState'
import { SupplierToastContainer, SupplierToastMessage } from './SupplierToast'

interface SuppliersPageProps {
  onNavigate?: (view: string) => void
  userContext?: UserPermissionContext
}

export function SuppliersPage({ onNavigate, userContext }: SuppliersPageProps) {
  // 1. Data States
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isCostRedacted, setIsCostRedacted] = useState(false)
  const [stats, setStats] = useState<SupplierStatsType | null>(null)

  // Options
  const [locations, setLocations] = useState<LocationOption[]>([])

  // Loading & Error
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 2. Filters
  const [filters, setFilters] = useState<SupplierFilterParams>({
    query: '',
    documentNumber: '',
    status: 'ALL',
    locationId: undefined,
    hasPendingBalance: undefined,
    startDate: undefined,
    endDate: undefined,
    page: 1,
    pageSize: 10,
    sortField: 'businessName',
    sortDirection: 'asc',
  })

  // 3. Modals & Drawers
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false)
  const [formDrawerMode, setFormDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deactivateSupplier, setDeactivateSupplier] = useState<Supplier | null>(null)
  const [paymentSupplier, setPaymentSupplier] = useState<Supplier | null>(null)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  // 4. Toast Notifications
  const [toasts, setToasts] = useState<SupplierToastMessage[]>([])

  const addToast = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info'
  ) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, title, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // 5. Initial fetch of dynamic options (Locations)
  useEffect(() => {
    async function loadLocations() {
      try {
        const locs = await locationService.list()
        setLocations(locs)
      } catch (err) {
        console.error('Error cargando bodegas:', err)
      }
    }
    loadLocations()
  }, [])

  // 6. Fetch Suppliers
  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await supplierService.list(filters, userContext)
      setSuppliers(resp.items)
      setTotal(resp.total)
      setTotalPages(resp.totalPages)
      setIsCostRedacted(resp.isCostRedacted)
    } catch (err: any) {
      setError(err.message || 'Error al consultar proveedores.')
    } finally {
      setLoading(false)
    }
  }, [filters, userContext])

  // 7. Fetch Stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await supplierService.getSupplierStats(userContext)
      setStats(data)
    } catch (err) {
      console.error('Error cargando estadísticas de proveedores:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [userContext])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Filter Handlers
  const handleFilterChange = (key: keyof SupplierFilterParams, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1,
    }))
  }

  const handleResetFilters = () => {
    setFilters({
      query: '',
      documentNumber: '',
      status: 'ALL',
      locationId: undefined,
      hasPendingBalance: undefined,
      startDate: undefined,
      endDate: undefined,
      page: 1,
      pageSize: 10,
      sortField: 'businessName',
      sortDirection: 'asc',
    })
  }

  const handleSort = (
    field:
      | 'businessName'
      | 'documentNumber'
      | 'totalPurchased'
      | 'currentBalance'
      | 'lastPurchaseDate'
      | 'createdAt'
  ) => {
    setFilters((prev) => {
      const isSame = prev.sortField === field
      const newDirection = isSame && prev.sortDirection === 'asc' ? 'desc' : 'asc'
      return {
        ...prev,
        sortField: field,
        sortDirection: newDirection,
        page: 1,
      }
    })
  }

  // Create or Update Supplier Action
  const handleFormSubmit = async (input: CreateSupplierInput | UpdateSupplierInput) => {
    if (formDrawerMode === 'create') {
      const created = await supplierService.create(input as CreateSupplierInput, userContext)
      addToast(
        'Proveedor Registrado',
        `El proveedor "${created.businessName}" fue creado con éxito en la base de datos.`,
        'success'
      )
    } else {
      const updated = await supplierService.update(input as UpdateSupplierInput, userContext)
      addToast(
        'Proveedor Actualizado',
        `Los datos comerciales de "${updated.businessName}" fueron guardados correctamente.`,
        'success'
      )
      if (selectedSupplier?.id === updated.id) {
        setSelectedSupplier(updated)
      }
    }
    fetchSuppliers()
    fetchStats()
  }

  // Deactivate Action
  const handleConfirmDeactivate = async (supplierId: string) => {
    const deactivated = await supplierService.deactivate(supplierId, userContext)
    addToast(
      'Proveedor Desactivado',
      `El proveedor "${deactivated.businessName}" fue marcado como inactivo. Se mantiene en el histórico.`,
      'warning'
    )
    if (selectedSupplier?.id === supplierId) {
      setSelectedSupplier(deactivated)
    }
    fetchSuppliers()
    fetchStats()
  }

  // Activate Action
  const handleActivate = async (supplier: Supplier) => {
    const activated = await supplierService.activate(supplier.id, userContext)
    addToast(
      'Proveedor Reactivado',
      `El proveedor "${activated.businessName}" se encuentra ahora activo para operaciones comerciales.`,
      'success'
    )
    if (selectedSupplier?.id === supplier.id) {
      setSelectedSupplier(activated)
    }
    fetchSuppliers()
    fetchStats()
  }

  // New Purchase shortcut
  const handleNewPurchaseForSupplier = (supplier: Supplier) => {
    if (onNavigate) {
      onNavigate('Compras')
    } else {
      window.location.href = '/compras'
    }
  }

  // View purchase in Purchases module
  const handleViewPurchaseInModule = (purchaseNumber: string) => {
    if (onNavigate) {
      onNavigate('Compras')
    } else {
      window.location.href = '/compras'
    }
  }

  const hasActiveFilters = Boolean(
    filters.query?.trim() ||
      filters.documentNumber?.trim() ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.locationId && filters.locationId !== 'ALL') ||
      filters.hasPendingBalance !== undefined ||
      filters.startDate ||
      filters.endDate
  )

  const activeFilterCount = [
    Boolean(filters.query?.trim()),
    Boolean(filters.documentNumber?.trim()),
    Boolean(filters.status && filters.status !== 'ALL'),
    Boolean(filters.locationId && filters.locationId !== 'ALL'),
    filters.hasPendingBalance !== undefined,
    Boolean(filters.startDate || filters.endDate),
  ].filter(Boolean).length

  return (
    <div className="dashboard-content page-enter">
      {/* Toast Notifications */}
      <SupplierToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 1. Header with Primary Actions */}
      <SupplierHeader
        onNewSupplier={() => {
          setFormDrawerMode('create')
          setEditingSupplier(null)
          setIsFormDrawerOpen(true)
        }}
        onExport={() => setIsExportModalOpen(true)}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* 2. Key Metrics & Stats */}
      {statsLoading || !stats ? (
        <SupplierStatsSkeleton />
      ) : (
        <SupplierStats stats={stats} />
      )}

      {/* 3. Toolbar & Dynamic Filters */}
      <SupplierFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        locations={locations}
      />

      {/* 4. Suppliers Main Table */}
      {loading ? (
        <SupplierTableSkeleton />
      ) : error ? (
        <SupplierErrorState message={error} onRetry={fetchSuppliers} />
      ) : suppliers.length === 0 ? (
        <SupplierEmptyState
          hasFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
          onNewSupplier={() => {
            setFormDrawerMode('create')
            setEditingSupplier(null)
            setIsFormDrawerOpen(true)
          }}
        />
      ) : (
        <SupplierTable
          suppliers={suppliers}
          total={total}
          page={filters.page || 1}
          pageSize={filters.pageSize || 10}
          totalPages={totalPages}
          isCostRedacted={isCostRedacted}
          sortField={filters.sortField}
          sortDirection={filters.sortDirection}
          onSort={handleSort}
          onPageChange={(p) => handleFilterChange('page', p)}
          onPageSizeChange={(s) => {
            setFilters((prev) => ({ ...prev, pageSize: s, page: 1 }))
          }}
          onSelectSupplier={(s) => setSelectedSupplier(s)}
          onEditSupplier={(s) => {
            setEditingSupplier(s)
            setFormDrawerMode('edit')
            setIsFormDrawerOpen(true)
          }}
          onNewPurchaseForSupplier={handleNewPurchaseForSupplier}
          onViewDocuments={(s) => setSelectedSupplier(s)}
          onDeactivateSupplier={(s) => setDeactivateSupplier(s)}
          onActivateSupplier={handleActivate}
        />
      )}

      {/* =========================================================================
          DRAWERS & MODALS
         ========================================================================= */}
      {/* Formulario Crear / Editar Proveedor */}
      <SupplierFormDrawer
        isOpen={isFormDrawerOpen}
        mode={formDrawerMode}
        supplier={editingSupplier}
        onClose={() => {
          setIsFormDrawerOpen(false)
          setEditingSupplier(null)
        }}
        onSubmit={handleFormSubmit}
      />

      {/* Ficha Completa con 8 Tabs Interactivas */}
      <SupplierDetailDrawer
        supplier={selectedSupplier}
        isOpen={Boolean(selectedSupplier)}
        isCostRedacted={isCostRedacted}
        userContext={userContext}
        onClose={() => setSelectedSupplier(null)}
        onEdit={(s) => {
          setEditingSupplier(s)
          setFormDrawerMode('edit')
          setIsFormDrawerOpen(true)
        }}
        onNewPurchase={handleNewPurchaseForSupplier}
        onRegisterPayment={(s) => setPaymentSupplier(s)}
        onViewPurchaseInModule={handleViewPurchaseInModule}
      />

      {/* Modal Desactivar Proveedor */}
      <SupplierDeactivateModal
        supplier={deactivateSupplier}
        isOpen={Boolean(deactivateSupplier)}
        onClose={() => setDeactivateSupplier(null)}
        onConfirm={handleConfirmDeactivate}
      />

      {/* Modal Registrar Pago a Proveedor */}
      <SupplierPaymentModal
        supplier={paymentSupplier}
        isOpen={Boolean(paymentSupplier)}
        onClose={() => setPaymentSupplier(null)}
        onSuccess={() => {
          addToast(
            'Pago Registrado',
            `Se asentó el abono a la factura del proveedor exitosamente.`,
            'success'
          )
          fetchSuppliers()
          fetchStats()
        }}
      />

      {/* Modal Exportar Proveedores */}
      <SupplierExportModal
        isOpen={isExportModalOpen}
        suppliers={suppliers}
        isCostRedacted={isCostRedacted}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  )
}
