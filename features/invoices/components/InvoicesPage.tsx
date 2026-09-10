'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { InvoiceStats } from './InvoiceStats'
import { InvoiceFilters } from './InvoiceFilters'
import { InvoiceTable } from './InvoiceTable'
import { InvoiceDetailDrawer } from './InvoiceDetailDrawer'
import { InvoiceGenerateModal } from './InvoiceGenerateModal'
import { CreditNoteModal } from './CreditNoteModal'
import { InvoiceCancelModal } from './InvoiceCancelModal'
import { DIANXmlModal } from './DIANXmlModal'
import { useInvoices } from '../hooks/useInvoices'
import { Invoice } from '../types'

interface InvoicesPageProps {
  onNavigate?: (view: string) => void
}

export function InvoicesPage({ onNavigate }: InvoicesPageProps) {
  const {
    invoices,
    total,
    loading,
    error,
    stats,
    statsLoading,
    refreshInvoices,
    refreshStats,
    // Filters
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    selectedType,
    setSelectedType,
    selectedDianStatus,
    setSelectedDianStatus,
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
    // Drawer
    selectedInvoice,
    isDrawerOpen,
    openDetailDrawer,
    closeDetailDrawer,
    // Generate Modal
    isGenerateModalOpen,
    openGenerateModal,
    closeGenerateModal,
    pendingSales,
    pendingSalesLoading,
    handleGenerateInvoice,
    // Credit Note Modal
    invoiceForCreditNote,
    isCreditNoteModalOpen,
    openCreditNoteModal,
    closeCreditNoteModal,
    handleCreateCreditNote,
    // Cancel Modal
    invoiceForCancel,
    isCancelModalOpen,
    openCancelModal,
    closeCancelModal,
    handleCancelInvoice,
    // XML Modal
    invoiceForXml,
    isXmlModalOpen,
    openXmlModal,
    closeXmlModal,
    // DIAN Actions
    handleSendToDIAN,
  } = useInvoices()

  const handleResetFilters = () => {
    setSearchQuery('')
    setActiveTab('Todas')
    setSelectedType('ALL')
    setSelectedDianStatus('ALL')
    setSelectedLocation('ALL')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  // Export CSV
  const handleExportCSV = () => {
    if (invoices.length === 0) return

    const headers = [
      'N° Factura',
      'Prefijo',
      'Fecha',
      'Hora',
      'Cliente',
      'Documento',
      'Tipo',
      'Venta Ref',
      'Bodega',
      'Vendedor',
      'Ítems',
      'Subtotal',
      'Descuento',
      'Impuestos',
      'Total',
      'Estado',
      'Estado DIAN',
      'CUFE',
    ]

    const rows = invoices.map((inv) => [
      inv.invoiceNumber,
      inv.prefix,
      new Date(inv.date).toLocaleDateString('es-CO'),
      inv.issuedAtBogota || '',
      `"${inv.customerName}"`,
      inv.customerDoc,
      inv.type,
      inv.saleNumber || '',
      `"${inv.locationName}"`,
      `"${inv.sellerName || ''}"`,
      inv.itemsCount,
      inv.subtotal,
      inv.discountTotal,
      inv.taxTotal,
      inv.total,
      inv.status,
      inv.dianStatus,
      inv.dianCufe || '',
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `SuperMas_Facturacion_${new Date().toISOString().slice(0, 10)}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Page Header */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">Documentos Fiscales & DIAN</p>
          <h1>Facturación</h1>
          <p className="welcome-subtitle">
            Administra documentos generados, facturas electrónicas y comprobantes de venta.
          </p>
        </div>

        <div className="heading-actions">
          <button
            type="button"
            className="outline-button"
            onClick={handleExportCSV}
            disabled={invoices.length === 0}
          >
            <AppIcon name="download" size={15} /> Exportar
          </button>

          <button
            type="button"
            className="primary-button compact"
            onClick={openGenerateModal}
          >
            <AppIcon name="plus" size={15} /> Facturar Venta
          </button>
        </div>
      </div>

      {/* 2. Key Performance Indicators (KPIs) */}
      <InvoiceStats stats={stats} loading={statsLoading} />

      {/* 3. Filters Toolbar */}
      <InvoiceFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedDianStatus={selectedDianStatus}
        onDianStatusChange={setSelectedDianStatus}
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

      {/* 4. Main Invoices Data Table */}
      <InvoiceTable
        invoices={invoices}
        loading={loading}
        error={error}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onViewDetail={openDetailDrawer}
        onSendToDIAN={handleSendToDIAN}
        onOpenCreditNote={openCreditNoteModal}
        onOpenCancel={openCancelModal}
        onOpenXml={openXmlModal}
        onRetryFetch={() => {
          refreshInvoices()
          refreshStats()
        }}
      />

      {/* 5. Detail Slide-over Drawer */}
      <InvoiceDetailDrawer
        isOpen={isDrawerOpen}
        invoice={selectedInvoice}
        onClose={closeDetailDrawer}
        onSendToDIAN={handleSendToDIAN}
        onOpenCreditNote={(inv) => {
          closeDetailDrawer()
          openCreditNoteModal(inv)
        }}
        onOpenCancel={(inv) => {
          closeDetailDrawer()
          openCancelModal(inv)
        }}
        onOpenXml={openXmlModal}
      />

      {/* 6. Invoice Generation Modal (Facturar Venta) */}
      <InvoiceGenerateModal
        isOpen={isGenerateModalOpen}
        onClose={closeGenerateModal}
        pendingSales={pendingSales}
        loadingPendingSales={pendingSalesLoading}
        onGenerateInvoice={handleGenerateInvoice}
      />

      {/* 7. Credit Note Modal */}
      <CreditNoteModal
        isOpen={isCreditNoteModalOpen}
        invoice={invoiceForCreditNote}
        onClose={closeCreditNoteModal}
        onCreateCreditNote={handleCreateCreditNote}
      />

      {/* 8. Cancellation Modal */}
      <InvoiceCancelModal
        isOpen={isCancelModalOpen}
        invoice={invoiceForCancel}
        onClose={closeCancelModal}
        onConfirmCancel={handleCancelInvoice}
      />

      {/* 9. UBL 2.1 XML Structure Modal */}
      <DIANXmlModal
        isOpen={isXmlModalOpen}
        invoice={invoiceForXml}
        onClose={closeXmlModal}
      />
    </div>
  )
}
