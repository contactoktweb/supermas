'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Transfer,
  TransferFilterParams,
  GlobalTransferStats,
  TransferSortField,
  UserPermissionContext,
} from '../types'
import { transferService } from '../services/transfer.service'
import { TransferHeader } from './TransferHeader'
import { TransferStats } from './TransferStats'
import { TransferFilters } from './TransferFilters'
import { TransferTable } from './TransferTable'
import { TransferFlowView } from './TransferFlowView'
import { TransferDetailDrawer } from './TransferDetailDrawer'
import { TransferNewDrawer } from './TransferNewDrawer'
import { TransferReceiveModal } from './TransferReceiveModal'
import { TransferRejectModal } from './TransferRejectModal'
import { TransferExportModal } from './TransferExportModal'
import { TransferSkeleton } from './TransferSkeleton'
import { TransferEmptyState } from './TransferEmptyState'
import { TransferErrorState } from './TransferErrorState'
import { TransferToastContainer, TransferToastMessage } from './TransferToast'

interface TransferPageProps {
  onNavigate?: (view: string) => void
  initialLocationId?: string
  initialProductId?: string
  initialDirection?: 'ALL' | 'INBOUND' | 'OUTBOUND'
  userContext?: UserPermissionContext
}

export function TransferPage({
  onNavigate,
  initialLocationId,
  initialProductId,
  initialDirection = 'ALL',
  userContext,
}: TransferPageProps) {
  // View mode: 'table' or 'flow'
  const [viewMode, setViewMode] = useState<'table' | 'flow'>('table')

  // Filter state
  const [filters, setFilters] = useState<TransferFilterParams>({
    query: '',
    code: '',
    originLocationId: undefined,
    destinationLocationId: undefined,
    direction: initialDirection,
    activeLocationId: initialLocationId,
    status: 'ALL',
    userId: 'ALL',
    productId: initialProductId,
    startDate: undefined,
    endDate: undefined,
    page: 1,
    pageSize: 10,
    sortField: 'createdAt',
    sortDirection: 'desc',
  })

  // Data states
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isCostRedacted, setIsCostRedacted] = useState(false)
  const [stats, setStats] = useState<GlobalTransferStats>({
    pendingCount: 0,
    inTransitCount: 0,
    receivedCount: 0,
    rejectedCount: 0,
    totalUnitsTransferred: 0,
    incidentCount: 0,
    isCostRedacted: false,
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Drawers and Modals
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null)
  const [isNewDrawerOpen, setIsNewDrawerOpen] = useState(false)
  const [receiveModalState, setReceiveModalState] = useState<{
    isOpen: boolean
    transfer: Transfer | null
  }>({
    isOpen: false,
    transfer: null,
  })
  const [rejectModalState, setRejectModalState] = useState<{
    isOpen: boolean
    transfer: Transfer | null
  }>({
    isOpen: false,
    transfer: null,
  })
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  // Toast Notifications
  const [toasts, setToasts] = useState<TransferToastMessage[]>([])

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

      const [transfersRes, statsRes] = await Promise.all([
        transferService.listTransfers(filters, userContext),
        transferService.getGlobalStats(filters, userContext),
      ])

      setTransfers(transfersRes.items)
      setTotal(transfersRes.total)
      setTotalPages(transfersRes.totalPages)
      setIsCostRedacted(transfersRes.isCostRedacted)
      setStats(statsRes)
    } catch (err: any) {
      setError(err.message || 'Error al cargar transferencias de inventario')
    } finally {
      setLoading(false)
    }
  }, [filters, userContext])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter change handler
  const handleFilterChange = (key: keyof TransferFilterParams, value: any) => {
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
      code: '',
      originLocationId: undefined,
      destinationLocationId: undefined,
      direction: 'ALL',
      activeLocationId: initialLocationId,
      status: 'ALL',
      userId: 'ALL',
      productId: undefined,
      startDate: undefined,
      endDate: undefined,
      page: 1,
      pageSize: filters.pageSize || 10,
      sortField: 'createdAt',
      sortDirection: 'desc',
    })
    showToast('Filtros restablecidos', 'Se muestran todas las transferencias.', 'info')
  }

  // Sort handler
  const handleSort = (field: TransferSortField) => {
    setFilters((prev) => ({
      ...prev,
      sortField: field,
      sortDirection:
        prev.sortField === field && prev.sortDirection === 'asc' ? 'desc' : 'asc',
    }))
  }

  // Actions
  const handleDispatch = async (transfer: Transfer) => {
    try {
      const dispatched = await transferService.dispatchTransfer(
        { transferId: transfer.id },
        userContext
      )
      showToast(
        'Transferencia Despachada',
        `La orden ${dispatched.code} ahora está EN TRÁNSITO hacia ${dispatched.destinationLocationName}.`,
        'success'
      )
      if (selectedTransfer?.id === transfer.id) {
        setSelectedTransfer(dispatched)
      }
      loadData()
    } catch (err: any) {
      showToast('Error al despachar', err.message || 'No se pudo despachar', 'error')
    }
  }

  const handleOpenReceive = (transfer: Transfer) => {
    setReceiveModalState({ isOpen: true, transfer })
  }

  const handleConfirmReceive = async (
    transferId: string,
    receivedItems: { productId: string; receivedUnits: number; notes?: string }[],
    notes?: string
  ) => {
    try {
      const received = await transferService.receiveTransfer(
        {
          transferId,
          receivedItems,
          notes,
        },
        userContext
      )

      showToast(
        'Transferencia Recibida',
        `Se confirmó la recepción de ${received.code} en ${received.destinationLocationName}.`,
        'success'
      )
      if (selectedTransfer?.id === transferId) {
        setSelectedTransfer(received)
      }
      loadData()
    } catch (err: any) {
      showToast('Error al recibir', err.message || 'No se pudo confirmar la recepción', 'error')
      throw err
    }
  }

  const handleOpenReject = (transfer: Transfer) => {
    setRejectModalState({ isOpen: true, transfer })
  }

  const handleConfirmReject = async (transferId: string, reason: string) => {
    try {
      const rejected = await transferService.rejectTransfer(
        {
          transferId,
          reason,
        },
        userContext
      )

      showToast(
        'Transferencia Rechazada',
        `La orden ${rejected.code} fue cancelada y archivada en auditoría.`,
        'info'
      )
      if (selectedTransfer?.id === transferId) {
        setSelectedTransfer(rejected)
      }
      loadData()
    } catch (err: any) {
      showToast('Error al rechazar', err.message || 'No se pudo rechazar', 'error')
      throw err
    }
  }

  const hasActiveFilters = Boolean(
    filters.query?.trim() ||
      filters.code?.trim() ||
      (filters.originLocationId && filters.originLocationId !== 'ALL') ||
      (filters.destinationLocationId && filters.destinationLocationId !== 'ALL') ||
      (filters.direction && filters.direction !== 'ALL') ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.userId && filters.userId !== 'ALL') ||
      filters.startDate ||
      filters.endDate
  )

  const activeFilterCount = [
    Boolean(filters.query?.trim()),
    Boolean(filters.originLocationId && filters.originLocationId !== 'ALL'),
    Boolean(filters.destinationLocationId && filters.destinationLocationId !== 'ALL'),
    Boolean(filters.direction && filters.direction !== 'ALL'),
    Boolean(filters.status && filters.status !== 'ALL'),
    Boolean(filters.userId && filters.userId !== 'ALL'),
    Boolean(filters.startDate || filters.endDate),
  ].filter(Boolean).length

  return (
    <div className="transfers-container page-enter">
      {/* 1. Header */}
      <TransferHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onNewTransfer={() => setIsNewDrawerOpen(true)}
        onExport={() => setIsExportModalOpen(true)}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* 2. Stats Grid (6 KPIs) */}
      <TransferStats stats={stats} />

      {/* 3. Filters Toolbar */}
      <TransferFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
      />

      {/* 4. Main View: Table or Flow */}
      {loading ? (
        <TransferSkeleton />
      ) : error ? (
        <TransferErrorState message={error} onRetry={loadData} />
      ) : transfers.length === 0 ? (
        <TransferEmptyState
          hasFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
          onNewTransfer={() => setIsNewDrawerOpen(true)}
        />
      ) : viewMode === 'table' ? (
        <TransferTable
          transfers={transfers}
          total={total}
          page={filters.page || 1}
          pageSize={filters.pageSize || 10}
          totalPages={totalPages}
          isCostRedacted={isCostRedacted}
          sortField={filters.sortField}
          sortDirection={filters.sortDirection}
          onSort={handleSort}
          onPageChange={(page) => handleFilterChange('page', page)}
          onPageSizeChange={(pageSize) => handleFilterChange('pageSize', pageSize)}
          onSelectTransfer={(t) => setSelectedTransfer(t)}
          onDispatchTransfer={handleDispatch}
          onReceiveTransfer={handleOpenReceive}
        />
      ) : (
        <TransferFlowView
          transfers={transfers}
          onSelectTransfer={(t) => setSelectedTransfer(t)}
          onDispatchTransfer={handleDispatch}
          onReceiveTransfer={handleOpenReceive}
        />
      )}

      {/* 5. Drawers and Modals */}
      <TransferDetailDrawer
        transfer={selectedTransfer}
        isOpen={Boolean(selectedTransfer)}
        isCostRedacted={isCostRedacted}
        userContext={userContext}
        onClose={() => setSelectedTransfer(null)}
        onDispatch={handleDispatch}
        onReceive={handleOpenReceive}
        onReject={handleOpenReject}
        onViewKardex={(code) => {
          if (onNavigate) onNavigate('Kardex')
          else window.location.href = `/kardex?query=${code}`
        }}
      />

      <TransferNewDrawer
        isOpen={isNewDrawerOpen}
        initialOriginLocationId={initialLocationId || 'loc-01'}
        initialProductId={initialProductId}
        userContext={userContext}
        onClose={() => setIsNewDrawerOpen(false)}
        onSuccess={(code) => {
          showToast('Transferencia Creada', `Se generó la orden de traslado ${code}.`, 'success')
          loadData()
        }}
      />

      <TransferReceiveModal
        isOpen={receiveModalState.isOpen}
        transfer={receiveModalState.transfer}
        onClose={() => setReceiveModalState({ isOpen: false, transfer: null })}
        onConfirm={handleConfirmReceive}
      />

      <TransferRejectModal
        isOpen={rejectModalState.isOpen}
        transfer={rejectModalState.transfer}
        onClose={() => setRejectModalState({ isOpen: false, transfer: null })}
        onConfirm={handleConfirmReject}
      />

      <TransferExportModal
        isOpen={isExportModalOpen}
        transfers={transfers}
        isCostRedacted={isCostRedacted}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* Toast Notifications */}
      <TransferToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
