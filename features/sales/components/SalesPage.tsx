'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { SalesStats } from './SalesStats'
import { SalesFilters } from './SalesFilters'
import { SalesTable } from './SalesTable'
import { NewSaleDrawer } from './NewSaleDrawer'
import { SaleDetailDrawer } from './SaleDetailDrawer'
import { SaleCancelModal } from './SaleCancelModal'
import { SaleInvoiceModal } from './SaleInvoiceModal'
import { SaleRemissionModal } from './SaleRemissionModal'
import { useSales } from '../hooks/useSales'
import { useSaleDetail } from '../hooks/useSaleDetail'
import { Sale, CreateSaleDTO } from '../types'
import { db } from '@/lib/supabase'

interface SalesPageProps {
  onNavigate?: (view: string) => void
}

export function SalesPage({ onNavigate }: SalesPageProps) {
  const {
    items: sales,
    stats,
    filters,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    statsLoading,
    setFilter,
    resetFilters,
    refresh,
    createSale,
    cancelSale,
    generateInvoice,
    generateRemission,
  } = useSales()

  // Modal / Drawer UI states
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false)
  const [selectedSaleIdForDetail, setSelectedSaleIdForDetail] = useState<string | null>(null)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)

  const [saleForCancel, setSaleForCancel] = useState<Sale | null>(null)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)

  const [saleForInvoice, setSaleForInvoice] = useState<Sale | null>(null)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)

  const [saleForRemission, setSaleForRemission] = useState<Sale | null>(null)
  const [isRemissionModalOpen, setIsRemissionModalOpen] = useState(false)

  // Sale Detail Hook
  const {
    sale: saleDetail,
    loading: detailLoading,
    refresh: refreshDetail,
  } = useSaleDetail(selectedSaleIdForDetail)

  // Locations for filters and new sale
  const locations = db.locations.map((l) => ({
    id: l.id,
    name: l.name,
  }))

  // Extract unique sellers from sales
  const sellers = Array.from(
    new Set((db.sales as unknown as Sale[]).map((s) => s.sellerName).filter(Boolean))
  )

  // Handlers
  const handleOpenNewSale = () => {
    setIsNewSaleOpen(true)
  }

  const handleViewDetail = (sale: Sale) => {
    setSelectedSaleIdForDetail(sale.id)
    setIsDetailDrawerOpen(true)
  }

  const handleOpenCancel = (sale: Sale) => {
    setSaleForCancel(sale)
    setIsCancelModalOpen(true)
  }

  const handleOpenInvoice = (sale: Sale) => {
    setSaleForInvoice(sale)
    setIsInvoiceModalOpen(true)
  }

  const handleOpenRemission = (sale: Sale) => {
    setSaleForRemission(sale)
    setIsRemissionModalOpen(true)
  }

  const handleCreateSaleSubmit = async (dto: CreateSaleDTO) => {
    await createSale(dto)
  }

  const handleConfirmCancel = async (reason: string) => {
    if (!saleForCancel) return
    await cancelSale({ saleId: saleForCancel.id, reason })
    if (selectedSaleIdForDetail === saleForCancel.id) {
      await refreshDetail()
    }
  }

  const handleConfirmInvoice = async (type: 'FACTURA_ELECTRONICA' | 'FACTURA_POS') => {
    if (!saleForInvoice) return
    await generateInvoice({ saleId: saleForInvoice.id, type })
    if (selectedSaleIdForDetail === saleForInvoice.id) {
      await refreshDetail()
    }
  }

  const handleConfirmRemission = async (details: { driverName?: string; deliveredBy?: string; receivedBy?: string; notes?: string }) => {
    if (!saleForRemission) return
    await generateRemission({ saleId: saleForRemission.id, ...details })
    if (selectedSaleIdForDetail === saleForRemission.id) {
      await refreshDetail()
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    if (sales.length === 0) return

    const headers = [
      'N° Venta',
      'Fecha',
      'Cliente',
      'Documento',
      'Bodega',
      'Vendedor',
      'Ítems',
      'Unidades',
      'Subtotal',
      'Descuentos',
      'Impuestos',
      'Total',
      'Método Pago',
      'Estado',
      'Documento Fiscal',
    ]

    const rows = sales.map((s) => [
      s.saleNumber,
      new Date(s.date).toLocaleDateString('es-CO'),
      `"${s.customerName}"`,
      s.customerDoc,
      `"${s.locationName}"`,
      `"${s.sellerName}"`,
      s.itemsCount,
      s.totalUnits,
      s.subtotal,
      s.discountTotal,
      s.taxTotal,
      s.totalAmount,
      s.paymentMethod,
      s.status,
      s.invoiceNumber || s.remissionNumber || 'N/A',
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `SuperMas_Ventas_${new Date().toISOString().slice(0, 10)}.csv`
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
          <p className="eyebrow">Rendimiento Comercial & Facturación</p>
          <h1>Ventas</h1>
          <p className="welcome-subtitle">
            Administra ventas realizadas, documentos asociados y movimientos comerciales.
          </p>
        </div>

        <div className="heading-actions">
          <button
            type="button"
            className="outline-button"
            onClick={handleExportCSV}
            disabled={sales.length === 0}
          >
            <AppIcon name="download" size={15} /> Exportar
          </button>

          <button
            type="button"
            className="primary-button compact"
            onClick={handleOpenNewSale}
          >
            <AppIcon name="plus" size={15} /> Nueva Venta
          </button>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <SalesStats stats={stats} loading={statsLoading} />

      {/* 3. Filters */}
      <SalesFilters
        filters={filters}
        locations={locations}
        sellers={sellers}
        onFilterChange={setFilter}
        onResetFilters={resetFilters}
      />

      {/* 4. Main Sales Table */}
      <SalesTable
        sales={sales}
        loading={loading}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        sortBy={filters.sortBy}
        sortDirection={filters.sortDirection}
        onSort={(field) => {
          const isSame = filters.sortBy === field
          const newDir = isSame && filters.sortDirection === 'asc' ? 'desc' : 'asc'
          setFilter('sortBy', field)
          setFilter('sortDirection', newDir)
        }}
        onPageChange={(p) => setFilter('page', p)}
        onViewDetail={handleViewDetail}
        onGenerateInvoice={handleOpenInvoice}
        onGenerateRemission={handleOpenRemission}
        onCancelSale={handleOpenCancel}
        onViewKardex={() => {
          if (onNavigate) {
            onNavigate('Kardex')
          } else {
            window.location.href = '/kardex'
          }
        }}
      />

      {/* 5. New Sale Drawer (POS Wizard) */}
      <NewSaleDrawer
        isOpen={isNewSaleOpen}
        onClose={() => setIsNewSaleOpen(false)}
        onSubmit={handleCreateSaleSubmit}
        locations={locations}
      />

      {/* 6. Sale Detail Drawer */}
      <SaleDetailDrawer
        isOpen={isDetailDrawerOpen}
        sale={saleDetail}
        loading={detailLoading}
        onClose={() => setIsDetailDrawerOpen(false)}
        onGenerateInvoice={(s) => {
          setSaleForInvoice(s)
          setIsInvoiceModalOpen(true)
        }}
        onGenerateRemission={(s) => {
          setSaleForRemission(s)
          setIsRemissionModalOpen(true)
        }}
        onCancelSale={(s) => {
          setSaleForCancel(s)
          setIsCancelModalOpen(true)
        }}
        onViewKardex={() => {
          if (onNavigate) {
            onNavigate('Kardex')
          } else {
            window.location.href = '/kardex'
          }
        }}
      />

      {/* 7. Cancellation Modal */}
      <SaleCancelModal
        isOpen={isCancelModalOpen}
        sale={saleForCancel}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
      />

      {/* 8. Invoice Generation Modal */}
      <SaleInvoiceModal
        isOpen={isInvoiceModalOpen}
        sale={saleForInvoice}
        onClose={() => setIsInvoiceModalOpen(false)}
        onConfirm={handleConfirmInvoice}
      />

      {/* 9. Remission Generation Modal */}
      <SaleRemissionModal
        isOpen={isRemissionModalOpen}
        sale={saleForRemission}
        onClose={() => setIsRemissionModalOpen(false)}
        onConfirm={handleConfirmRemission}
      />
    </div>
  )
}
