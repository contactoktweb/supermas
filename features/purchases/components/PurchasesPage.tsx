'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Purchase,
  PurchaseFilterParams,
  PurchaseStats as PurchaseStatsType,
  SupplierOption,
  CreatePurchaseInput,
  RegisterPaymentInput,
  UserPermissionContext,
} from '../types'
import { LocationOption } from '../services/location.service'
import { purchaseService } from '../services/purchase.service'
import { supplierService } from '../services/supplier.service'
import { locationService } from '../services/location.service'
import { PurchaseHeader } from './PurchaseHeader'
import { PurchaseStats } from './PurchaseStats'
import { PurchaseFilters } from './PurchaseFilters'
import { PurchaseTable } from './PurchaseTable'
import { PurchaseNewDrawer } from './PurchaseNewDrawer'
import { PurchaseDetailDrawer } from './PurchaseDetailDrawer'
import { PurchaseReceiveModal } from './PurchaseReceiveModal'
import { PurchasePaymentModal } from './PurchasePaymentModal'
import { PurchaseCancelModal } from './PurchaseCancelModal'
import { PurchaseExportModal } from './PurchaseExportModal'
import { PurchaseStatsSkeleton, PurchaseTableSkeleton } from './PurchaseSkeleton'
import { PurchaseEmptyState } from './PurchaseEmptyState'
import { PurchaseErrorState } from './PurchaseErrorState'
import { PurchaseToastContainer, PurchaseToastMessage } from './PurchaseToast'

interface PurchasesPageProps {
  onNavigate?: (view: string) => void
  userContext?: UserPermissionContext
}

export function PurchasesPage({ onNavigate, userContext }: PurchasesPageProps) {
  // 1. Data States
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isCostRedacted, setIsCostRedacted] = useState(false)
  const [stats, setStats] = useState<PurchaseStatsType | null>(null)

  // Options
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])

  // Loading & Error
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 2. Filters
  const [filters, setFilters] = useState<PurchaseFilterParams>({
    query: '',
    supplierId: undefined,
    locationId: undefined,
    status: 'ALL',
    paymentType: 'ALL',
    startDate: undefined,
    endDate: undefined,
    page: 1,
    pageSize: 10,
    sortField: 'date',
    sortDirection: 'desc',
  })

  // 3. Modals & Drawers
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)
  const [isNewDrawerOpen, setIsNewDrawerOpen] = useState(false)
  const [receiveModalPurchase, setReceiveModalPurchase] = useState<Purchase | null>(null)
  const [paymentModalPurchase, setPaymentModalPurchase] = useState<Purchase | null>(null)
  const [cancelModalPurchase, setCancelModalPurchase] = useState<Purchase | null>(null)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  // 4. Toast Notifications
  const [toasts, setToasts] = useState<PurchaseToastMessage[]>([])

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

  // 5. Initial fetch of dynamic options (Suppliers & Locations)
  useEffect(() => {
    async function loadOptions() {
      try {
        const [sups, locs] = await Promise.all([
          supplierService.list(),
          locationService.list(),
        ])
        setSuppliers(sups)
        setLocations(locs)
      } catch (err) {
        console.error('Error cargando opciones de proveedores y bodegas:', err)
      }
    }
    loadOptions()
  }, [])

  // 6. Fetch Purchases
  const fetchPurchases = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await purchaseService.list(filters, userContext)
      setPurchases(resp.items)
      setTotal(resp.total)
      setTotalPages(resp.totalPages)
      setIsCostRedacted(resp.isCostRedacted)
    } catch (err: any) {
      setError(err.message || 'Error al consultar órdenes de compra.')
    } finally {
      setLoading(false)
    }
  }, [filters, userContext])

  // 7. Fetch Stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await purchaseService.getPurchaseStats(userContext)
      setStats(data)
    } catch (err) {
      console.error('Error cargando estadísticas de compras:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [userContext])

  // Trigger loads
  useEffect(() => {
    fetchPurchases()
  }, [fetchPurchases])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Filter Handlers
  const handleFilterChange = (key: keyof PurchaseFilterParams, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1, // Reset page on filter changes
    }))
  }

  const handleResetFilters = () => {
    setFilters({
      query: '',
      supplierId: undefined,
      locationId: undefined,
      status: 'ALL',
      paymentType: 'ALL',
      startDate: undefined,
      endDate: undefined,
      page: 1,
      pageSize: 10,
      sortField: 'date',
      sortDirection: 'desc',
    })
  }

  const handleSort = (field: 'date' | 'total' | 'purchaseNumber' | 'pendingBalance' | 'createdAt') => {
    setFilters((prev) => {
      const isSame = prev.sortField === field
      const newDirection = isSame && prev.sortDirection === 'desc' ? 'asc' : 'desc'
      return {
        ...prev,
        sortField: field,
        sortDirection: newDirection,
        page: 1,
      }
    })
  }

  // Action: Create Purchase
  const handleCreatePurchase = async (input: CreatePurchaseInput) => {
    const created = await purchaseService.createPurchase(input, userContext)
    addToast(
      'Compra Registrada',
      `La orden ${created.purchaseNumber} fue registrada con éxito (${created.status === 'DRAFT' ? 'Borrador' : 'Emitida'}).`,
      'success'
    )
    fetchPurchases()
    fetchStats()
  }

  // Action: Receive Purchase (Inventory & Kardex entry)
  const handleConfirmReceive = async (purchaseId: string, notes?: string) => {
    const received = await purchaseService.receivePurchase(purchaseId, notes, userContext)
    addToast(
      'Mercancía Recibida',
      `Inventario ingresado a Kardex en la bodega ${received.destinationLocationName}.`,
      'success'
    )
    // Update active drawer if open
    if (selectedPurchase?.id === purchaseId) {
      setSelectedPurchase(received)
    }
    fetchPurchases()
    fetchStats()
  }

  // Action: Register Payment
  const handleConfirmPayment = async (input: RegisterPaymentInput) => {
    const updated = await purchaseService.registerPayment(input, userContext)
    addToast(
      'Pago Registrado',
      `Se registró el abono a la factura. Nuevo saldo pendiente: $${updated.pendingBalance.toLocaleString('es-CO')}.`,
      'success'
    )
    if (selectedPurchase?.id === input.purchaseId) {
      setSelectedPurchase(updated)
    }
    fetchPurchases()
    fetchStats()
  }

  // Action: Cancel Purchase
  const handleConfirmCancel = async (purchaseId: string, reason: string) => {
    const cancelled = await purchaseService.cancelPurchase(purchaseId, reason, userContext)
    addToast(
      'Compra Anulada',
      `La orden ${cancelled.purchaseNumber} fue anulada correctamente.`,
      'warning'
    )
    if (selectedPurchase?.id === purchaseId) {
      setSelectedPurchase(cancelled)
    }
    fetchPurchases()
    fetchStats()
  }

  // Action: Quick Receive (open first pending reception)
  const handleQuickReceive = () => {
    const firstPending = purchases.find(
      (p) => p.status === 'PENDING_RECEPTION' || p.status === 'DRAFT'
    )
    if (firstPending) {
      setReceiveModalPurchase(firstPending)
    } else {
      addToast(
        'Sin compras pendientes',
        'No hay compras pendientes de recepción en la lista actual.',
        'info'
      )
    }
  }

  // Action: Navigate to Kardex filtered by document
  const handleViewKardex = (purchaseNumber: string, locationId: string) => {
    if (onNavigate) {
      onNavigate('Kardex')
    } else {
      addToast(
        'Kardex',
        `Consulte en el módulo Kardex filtrando por documento: ${purchaseNumber}`,
        'info'
      )
    }
  }

  const hasActiveFilters = Boolean(
    filters.query?.trim() ||
      (filters.supplierId && filters.supplierId !== 'ALL') ||
      (filters.locationId && filters.locationId !== 'ALL') ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.paymentType && filters.paymentType !== 'ALL') ||
      filters.startDate ||
      filters.endDate
  )

  const activeFilterCount = [
    Boolean(filters.query?.trim()),
    Boolean(filters.supplierId && filters.supplierId !== 'ALL'),
    Boolean(filters.locationId && filters.locationId !== 'ALL'),
    Boolean(filters.status && filters.status !== 'ALL'),
    Boolean(filters.paymentType && filters.paymentType !== 'ALL'),
    Boolean(filters.startDate || filters.endDate),
  ].filter(Boolean).length

  return (
    <div className="dashboard-content page-enter">
      {/* Toast Notifications */}
      <PurchaseToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 1. Header with primary actions */}
      <PurchaseHeader
        onNewPurchase={() => setIsNewDrawerOpen(true)}
        onQuickReceive={handleQuickReceive}
        onExport={() => setIsExportModalOpen(true)}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* 2. Key Metrics & Stats */}
      {statsLoading || !stats ? (
        <PurchaseStatsSkeleton />
      ) : (
        <PurchaseStats stats={stats} />
      )}

      {/* 3. Toolbar & Dynamic Filters */}
      <PurchaseFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        suppliers={suppliers}
        locations={locations}
      />

      {/* 4. Purchases Main Table */}
      {loading ? (
        <PurchaseTableSkeleton />
      ) : error ? (
        <PurchaseErrorState message={error} onRetry={fetchPurchases} />
      ) : purchases.length === 0 ? (
        <PurchaseEmptyState
          hasFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
          onNewPurchase={() => setIsNewDrawerOpen(true)}
        />
      ) : (
        <PurchaseTable
          purchases={purchases}
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
          onSelectPurchase={(p) => setSelectedPurchase(p)}
          onReceivePurchase={(p) => setReceiveModalPurchase(p)}
          onRegisterPayment={(p) => setPaymentModalPurchase(p)}
          onCancelPurchase={(p) => setCancelModalPurchase(p)}
          onViewAttachment={(p) => setSelectedPurchase(p)}
        />
      )}

      {/* =========================================================================
          DRAWERS & MODALS
         ========================================================================= */}
      {/* Nueva Compra */}
      <PurchaseNewDrawer
        isOpen={isNewDrawerOpen}
        suppliers={suppliers}
        locations={locations}
        onClose={() => setIsNewDrawerOpen(false)}
        onSubmit={handleCreatePurchase}
      />

      {/* Detalle de Compra */}
      <PurchaseDetailDrawer
        purchase={selectedPurchase}
        isOpen={Boolean(selectedPurchase)}
        isCostRedacted={isCostRedacted}
        userContext={userContext}
        onClose={() => setSelectedPurchase(null)}
        onReceive={(p) => {
          setSelectedPurchase(null)
          setReceiveModalPurchase(p)
        }}
        onRegisterPayment={(p) => {
          setSelectedPurchase(null)
          setPaymentModalPurchase(p)
        }}
        onCancel={(p) => {
          setSelectedPurchase(null)
          setCancelModalPurchase(p)
        }}
        onViewKardex={handleViewKardex}
      />

      {/* Modal Confirmar Recepción Física */}
      <PurchaseReceiveModal
        purchase={receiveModalPurchase}
        isOpen={Boolean(receiveModalPurchase)}
        onClose={() => setReceiveModalPurchase(null)}
        onConfirm={handleConfirmReceive}
      />

      {/* Modal Registrar Pago a Proveedor */}
      <PurchasePaymentModal
        purchase={paymentModalPurchase}
        isOpen={Boolean(paymentModalPurchase)}
        onClose={() => setPaymentModalPurchase(null)}
        onConfirm={handleConfirmPayment}
      />

      {/* Modal Anular Compra */}
      <PurchaseCancelModal
        purchase={cancelModalPurchase}
        isOpen={Boolean(cancelModalPurchase)}
        onClose={() => setCancelModalPurchase(null)}
        onConfirm={handleConfirmCancel}
      />

      {/* Modal Exportar CSV/JSON */}
      <PurchaseExportModal
        isOpen={isExportModalOpen}
        purchases={purchases}
        isCostRedacted={isCostRedacted}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  )
}
