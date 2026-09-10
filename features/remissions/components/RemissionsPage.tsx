'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { RemissionStats } from './RemissionStats'
import { RemissionFilters } from './RemissionFilters'
import { RemissionTable } from './RemissionTable'
import { RemissionDetailDrawer } from './RemissionDetailDrawer'
import { NewRemissionDrawer } from './NewRemissionDrawer'
import { CreateFromSaleModal } from './CreateFromSaleModal'
import { DispatchModal } from './DispatchModal'
import { DeliverModal } from './DeliverModal'
import { RemissionCancelModal } from './RemissionCancelModal'
import { useRemissions } from '../hooks/useRemissions'
import { Remission } from '../types'

interface RemissionsPageProps {
  onNavigate?: (view: string) => void
}

export function RemissionsPage({ onNavigate }: RemissionsPageProps) {
  const {
    remissions,
    total,
    loading,
    error,
    stats,
    statsLoading,
    refreshRemissions,
    refreshStats,
    // Filters
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    selectedStatus,
    setSelectedStatus,
    selectedLocation,
    setSelectedLocation,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    page,
    setPage,
    pageSize,
    setPageSize,
    // Detail Drawer
    selectedRemission,
    isDrawerOpen,
    openDetailDrawer,
    closeDetailDrawer,
    // Wizard Drawer
    isNewRemissionOpen,
    openNewRemission,
    closeNewRemission,
    handleCreateRemission,
    // From Sale Modal
    isFromSaleModalOpen,
    openFromSaleModal,
    closeFromSaleModal,
    pendingSales,
    pendingSalesLoading,
    handleCreateFromSale,
    // Dispatch Modal
    remissionForDispatch,
    isDispatchModalOpen,
    openDispatchModal,
    closeDispatchModal,
    handleConfirmDispatch,
    // Deliver Modal
    remissionForDeliver,
    isDeliverModalOpen,
    openDeliverModal,
    closeDeliverModal,
    handleConfirmDeliver,
    // Cancel Modal
    remissionForCancel,
    isCancelModalOpen,
    openCancelModal,
    closeCancelModal,
    handleConfirmCancel,
  } = useRemissions()

  const handleResetFilters = () => {
    setSearchQuery('')
    setActiveTab('Todas')
    setSelectedStatus('ALL')
    setSelectedLocation('ALL')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  // Export CSV
  const handleExportCSV = () => {
    if (remissions.length === 0) return

    const headers = [
      'N° Remisión',
      'Fecha',
      'Cliente',
      'NIT/Documento',
      'Venta Ref.',
      'Factura Ref.',
      'Bodega Origen',
      'Ítems',
      'Unidades',
      'Estado',
      'Transportador',
      'Placa',
      'Conductor',
      'Recibido Por',
      'Fecha Entrega',
      'Usuario Creador',
    ]

    const rows = remissions.map((rem) => [
      rem.remissionNumber,
      new Date(rem.date).toLocaleDateString('es-CO'),
      `"${rem.customerName}"`,
      rem.customerDoc,
      rem.saleNumber || '',
      rem.invoiceNumber || '',
      `"${rem.locationName}"`,
      rem.itemsCount,
      rem.totalUnits,
      rem.status,
      `"${rem.carrierName || ''}"`,
      rem.vehiclePlate || '',
      `"${rem.driverName || ''}"`,
      `"${rem.receivedBy || ''}"`,
      rem.deliveredAt ? new Date(rem.deliveredAt).toLocaleDateString('es-CO') : '',
      `"${rem.createdBy}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `SuperMas_Remisiones_${new Date().toISOString().slice(0, 10)}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Page Heading */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">Despachos & Logística de Entrega</p>
          <h1>Remisiones</h1>
          <p className="welcome-subtitle">
            Gestiona entregas de mercancía, despachos y documentos asociados a clientes.
          </p>
        </div>

        <div className="heading-actions">
          <button
            type="button"
            className="outline-button"
            onClick={handleExportCSV}
            disabled={remissions.length === 0}
          >
            <AppIcon name="download" size={15} /> Exportar
          </button>

          <button
            type="button"
            className="outline-button"
            onClick={openFromSaleModal}
          >
            <AppIcon name="sales" size={15} /> Crear desde Venta
          </button>

          <button
            type="button"
            className="primary-button compact"
            onClick={openNewRemission}
          >
            <AppIcon name="plus" size={15} /> Nueva Remisión
          </button>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <RemissionStats stats={stats} loading={statsLoading} />

      {/* 3. Filters Toolbar */}
      <RemissionFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        selectedLocation={selectedLocation}
        onLocationChange={setSelectedLocation}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateRangeChange={(from, to) => {
          setDateFrom(from)
          setDateTo(to)
        }}
        onResetFilters={handleResetFilters}
      />

      {/* 4. Main Remissions Data Table */}
      <RemissionTable
        remissions={remissions}
        loading={loading}
        error={error}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onViewDetail={openDetailDrawer}
        onOpenDispatch={openDispatchModal}
        onOpenDeliver={openDeliverModal}
        onOpenCancel={openCancelModal}
        onGenerateInvoice={(rem) => {
          if (onNavigate) {
            onNavigate('Facturación')
          } else {
            window.location.href = '/facturacion'
          }
        }}
        onRetryFetch={() => {
          refreshRemissions()
          refreshStats()
        }}
      />

      {/* 5. Detail Slide-over Drawer */}
      <RemissionDetailDrawer
        isOpen={isDrawerOpen}
        remission={selectedRemission}
        onClose={closeDetailDrawer}
        onOpenDispatch={(rem) => {
          closeDetailDrawer()
          openDispatchModal(rem)
        }}
        onOpenDeliver={(rem) => {
          closeDetailDrawer()
          openDeliverModal(rem)
        }}
        onOpenCancel={(rem) => {
          closeDetailDrawer()
          openCancelModal(rem)
        }}
      />

      {/* 6. Multi-step Creation Drawer */}
      <NewRemissionDrawer
        isOpen={isNewRemissionOpen}
        onClose={closeNewRemission}
        onSubmit={handleCreateRemission}
      />

      {/* 7. Create from Sale Modal */}
      <CreateFromSaleModal
        isOpen={isFromSaleModalOpen}
        onClose={closeFromSaleModal}
        pendingSales={pendingSales}
        loadingPendingSales={pendingSalesLoading}
        onCreateFromSale={handleCreateFromSale}
      />

      {/* 8. Dispatch Logistics Modal */}
      <DispatchModal
        isOpen={isDispatchModalOpen}
        remission={remissionForDispatch}
        onClose={closeDispatchModal}
        onConfirmDispatch={handleConfirmDispatch}
      />

      {/* 9. Delivery Confirmation Modal */}
      <DeliverModal
        isOpen={isDeliverModalOpen}
        remission={remissionForDeliver}
        onClose={closeDeliverModal}
        onConfirmDeliver={handleConfirmDeliver}
      />

      {/* 10. Cancellation Modal */}
      <RemissionCancelModal
        isOpen={isCancelModalOpen}
        remission={remissionForCancel}
        onClose={closeCancelModal}
        onConfirmCancel={handleConfirmCancel}
      />
    </div>
  )
}
