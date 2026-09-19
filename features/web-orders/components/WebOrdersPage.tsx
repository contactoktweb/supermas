'use client'

/**
 * SUPER MÁS ERP/POS - Contenedor Principal del Módulo Pedidos Web
 *
 * Conecta el ecommerce con el ERP administrativo.
 * Integra estadísticas con count-up, filtros reactivos, tabla paginada,
 * drawer de trazabilidad con timeline interactivo y modales de ciclo de vida.
 */

import React, { useState } from 'react'
import { useWebOrders } from '../hooks/useWebOrders'
import { useWebOrderPermissions } from '../hooks/useWebOrderPermissions'
import { WebOrder } from '../types'
import { WebOrderHeader } from './WebOrderHeader'
import { WebOrderStats } from './WebOrderStats'
import { WebOrderFilters } from './WebOrderFilters'
import { WebOrderTable } from './WebOrderTable'
import { WebOrderToast } from './WebOrderToast'
import { WebOrderDetailDrawer } from './drawers/WebOrderDetailDrawer'
import { WebOrderPreparationModal } from './modals/WebOrderPreparationModal'
import { WebOrderDispatchModal } from './modals/WebOrderDispatchModal'
import { WebOrderCancelModal } from './modals/WebOrderCancelModal'

export function WebOrdersPage() {
  const permissions = useWebOrderPermissions('SUPERADMIN')

  const {
    orders,
    stats,
    loading,
    statsLoading,
    actionLoading,
    error,
    feedback,
    filters,
    total,
    totalPages,
    setFilters,
    handleSearchChange,
    confirmOrder,
    startPreparation,
    completePreparationChecklist,
    dispatchOrder,
    deliverOrder,
    generateInvoice,
    cancelOrder,
    checkAvailability,
    exportToCsv,
    refresh,
  } = useWebOrders()

  // Estados de apertura de modales y drawers
  const [selectedOrder, setSelectedOrder] = useState<WebOrder | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const [prepOrder, setPrepOrder] = useState<WebOrder | null>(null)
  const [isPrepModalOpen, setIsPrepModalOpen] = useState(false)

  const [dispatchOrderTarget, setDispatchOrderTarget] = useState<WebOrder | null>(null)
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false)

  const [cancelOrderTarget, setCancelOrderTarget] = useState<WebOrder | null>(null)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)

  // Acciones sobre el pedido
  const handleViewDetail = (order: WebOrder) => {
    setSelectedOrder(order)
    setIsDetailOpen(true)
  }

  const handleOpenPrepare = (order: WebOrder) => {
    setPrepOrder(order)
    setIsPrepModalOpen(true)
  }

  const handleOpenDispatch = (order: WebOrder) => {
    setDispatchOrderTarget(order)
    setIsDispatchModalOpen(true)
  }

  const handleOpenCancel = (order: WebOrder) => {
    setCancelOrderTarget(order)
    setIsCancelModalOpen(true)
  }

  const handleConfirmOrder = async (order: WebOrder) => {
    const updated = await confirmOrder(order.id)
    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder(updated)
    }
  }

  const handleDeliverOrder = async (order: WebOrder) => {
    const updated = await deliverOrder(order.id)
    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder(updated)
    }
  }

  const handleInvoiceOrder = async (order: WebOrder) => {
    const updated = await generateInvoice(order.id)
    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder(updated)
    }
  }

  const handleResetFilters = () => {
    setFilters({
      search: '',
      status: 'ALL',
      channel: 'ALL',
      paymentMethod: 'ALL',
      locationId: 'ALL',
      invoiceStatus: 'ALL',
      sortBy: 'date',
      sortOrder: 'desc',
      page: 1,
      pageSize: 10,
    })
  }

  return (
    <div className="web-orders-page space-y-6">
      {/* Toast Notification */}
      <WebOrderToast feedback={feedback} onClose={() => {}} />

      {/* Header con Semántica H1 y Acciones */}
      <WebOrderHeader
        onRefresh={refresh}
        onExport={exportToCsv}
        canExport={permissions.canExport}
        isRefreshing={actionLoading}
      />

      {/* Dashboard KPI Cards con Count-up */}
      <WebOrderStats stats={stats} loading={statsLoading} />

      {/* Barra de Filtros y Búsqueda */}
      <WebOrderFilters
        filters={filters}
        onSearchChange={handleSearchChange}
        onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onReset={handleResetFilters}
      />

      {/* Tabla Principal de Pedidos Web */}
      <WebOrderTable
        orders={orders}
        loading={loading}
        error={error}
        page={filters.page || 1}
        totalPages={totalPages}
        total={total}
        onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
        onViewDetail={handleViewDetail}
        onConfirm={handleConfirmOrder}
        onPrepare={handleOpenPrepare}
        onDispatch={handleOpenDispatch}
        onInvoice={handleInvoiceOrder}
        onCancel={handleOpenCancel}
        canConfirm={permissions.canConfirm}
        canPrepare={permissions.canPrepare}
        canDispatch={permissions.canDispatch}
        canInvoice={permissions.canInvoice}
        canCancel={permissions.canCancel}
      />

      {/* Drawer de Detalle Lateral con Timeline Interactivo */}
      <WebOrderDetailDrawer
        isOpen={isDetailOpen}
        order={selectedOrder}
        onClose={() => setIsDetailOpen(false)}
        onConfirm={handleConfirmOrder}
        onPrepare={handleOpenPrepare}
        onDispatch={handleOpenDispatch}
        onDeliver={handleDeliverOrder}
        onInvoice={handleInvoiceOrder}
        onCancel={handleOpenCancel}
        checkAvailability={checkAvailability}
        canConfirm={permissions.canConfirm}
        canPrepare={permissions.canPrepare}
        canDispatch={permissions.canDispatch}
        canInvoice={permissions.canInvoice}
        canCancel={permissions.canCancel}
      />

      {/* Modal de Checklist de Preparación */}
      <WebOrderPreparationModal
        isOpen={isPrepModalOpen}
        order={prepOrder}
        onClose={() => setIsPrepModalOpen(false)}
        onStartPreparation={async (orderId) => {
          const updated = await startPreparation(orderId)
          if (selectedOrder && selectedOrder.id === orderId) {
            setSelectedOrder(updated)
          }
        }}
        onCompleteChecklist={async (orderId, checklist) => {
          const updated = await completePreparationChecklist(orderId, checklist)
          if (selectedOrder && selectedOrder.id === orderId) {
            setSelectedOrder(updated)
          }
        }}
      />

      {/* Modal de Despacho */}
      <WebOrderDispatchModal
        isOpen={isDispatchModalOpen}
        order={dispatchOrderTarget}
        onClose={() => setIsDispatchModalOpen(false)}
        onConfirmDispatch={async (orderId, data) => {
          const updated = await dispatchOrder(orderId, data)
          if (selectedOrder && selectedOrder.id === orderId) {
            setSelectedOrder(updated)
          }
        }}
      />

      {/* Modal de Cancelación */}
      <WebOrderCancelModal
        isOpen={isCancelModalOpen}
        order={cancelOrderTarget}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirmCancel={async (orderId, reason) => {
          const updated = await cancelOrder(orderId, reason)
          if (selectedOrder && selectedOrder.id === orderId) {
            setSelectedOrder(updated)
          }
        }}
      />
    </div>
  )
}
