'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Purchase,
  PurchaseFilterParams,
  PurchaseStats as PurchaseStatsType,
  SupplierOption,
  CreatePurchaseInput,
  UpdatePurchaseInput,
  ReceivePurchaseInput,
  RegisterPaymentInput,
  UserPermissionContext,
} from '../types'
import { LocationOption } from '../services/location.service'
import { useAuth } from '@/features/auth/hooks/useAuth'
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
  const { user } = useAuth()
  const effectiveUserContext: UserPermissionContext | undefined = user
    ? {
        userId: user.id,
        userName: user.fullName || user.email,
        userRole: user.roleCode,
        permissions: user.permissions || [],
      }
    : userContext

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
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null)
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
      const resp = await purchaseService.list(filters, effectiveUserContext)
      setPurchases(resp.items)
      setTotal(resp.total)
      setTotalPages(resp.totalPages)
      setIsCostRedacted(resp.isCostRedacted)
    } catch (err: any) {
      setError(err.message || 'Error al consultar órdenes de compra.')
    } finally {
      setLoading(false)
    }
  }, [filters, effectiveUserContext])

  // 7. Fetch Stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await purchaseService.getPurchaseStats(effectiveUserContext)
      setStats(data)
    } catch (err) {
      console.error('Error cargando estadísticas de compras:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [effectiveUserContext])

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
    const created = await purchaseService.createPurchase(input, effectiveUserContext)
    addToast(
      "Compra Registrada",
      `La orden ${created.purchaseNumber} fue registrada con éxito (${created.status === "BORRADOR" || created.status === "DRAFT" ? "Borrador" : "Confirmada"}).`,
      "success"
    )
    fetchPurchases()
    fetchStats()
  }

  // Action: Update Purchase (Draft)
  const handleUpdatePurchase = async (purchaseId: string, input: UpdatePurchaseInput) => {
    const updated = await purchaseService.updatePurchase(purchaseId, input, effectiveUserContext)
    addToast(
      "Compra Actualizada",
      `La orden ${updated.purchaseNumber} fue actualizada con éxito (${updated.status === "BORRADOR" || updated.status === "DRAFT" ? "Borrador" : "Confirmada"}).`,
      "success"
    )
    fetchPurchases()
    fetchStats()
  }

  // Action: Confirm Draft Purchase
  const handleConfirmOrder = async (purchase: Purchase) => {
    try {
      const confirmed = await purchaseService.confirmOrder(purchase.id, effectiveUserContext)
      addToast(
        'Orden Confirmada',
        `La orden ${confirmed.purchaseNumber} fue confirmada exitosamente. Lista para recepción.`,
        'success'
      )
      if (selectedPurchase?.id === purchase.id) {
        setSelectedPurchase(confirmed)
      }
      fetchPurchases()
      fetchStats()
    } catch (err: any) {
      addToast('Error al confirmar', err.message || 'No se pudo confirmar la orden.', 'error')
    }
  }

  // Action: Receive Purchase (Inventory & Kardex entry)
  const handleConfirmReceive = async (
    purchaseId: string,
    notes?: string,
    remission?: string,
    items?: { itemId: string; quantityReceived: number }[]
  ) => {
    const received = await purchaseService.receivePurchase(
      {
        purchaseId,
        notes,
        supplierRemissionNumber: remission,
        receivedItems: items?.map((i) => ({
          itemId: i.itemId,
          quantityReceived: i.quantityReceived,
        })),
      },
      effectiveUserContext
    )
    const recNum = received.receptionInfo?.receptionNumber
    addToast(
      'Mercancía Recibida',
      recNum
        ? `Acta ${recNum} generada con éxito. Inventario ingresado a Kardex en ${received.destinationLocationName}.`
        : `Inventario ingresado a Kardex en la bodega ${received.destinationLocationName}.`,
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
    const updated = await purchaseService.registerPayment(input, effectiveUserContext)
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
    const cancelled = await purchaseService.cancelPurchase(purchaseId, reason, effectiveUserContext)
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
    <div className="products-module-wrapper purchases-module-wrapper page-enter">
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
          onEditDraft={(p) => { setEditingPurchase(p); setIsNewDrawerOpen(true); }}
          onConfirmPurchase={handleConfirmOrder}
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
        initialPurchase={editingPurchase}
        onClose={() => {
          setIsNewDrawerOpen(false)
          setEditingPurchase(null)
        }}
        onSubmit={handleCreatePurchase}
        onUpdate={handleUpdatePurchase}
      />

      {/* Detalle de Compra */}
      <PurchaseDetailDrawer
        purchase={selectedPurchase}
        isOpen={Boolean(selectedPurchase)}
        isCostRedacted={isCostRedacted}
        userContext={effectiveUserContext}
        onClose={() => setSelectedPurchase(null)}
        onEditDraft={(p) => {
          setSelectedPurchase(null)
          setEditingPurchase(p)
          setIsNewDrawerOpen(true)
        }}
        onConfirm={handleConfirmOrder}
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
