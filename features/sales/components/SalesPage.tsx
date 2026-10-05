'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { SalesStats } from './SalesStats'
import { SalesFilters } from './SalesFilters'
import { SalesTable } from './SalesTable'
import { NewSaleDrawer } from './NewSaleDrawer'
import { SaleDetailDrawer } from './SaleDetailDrawer'
import { SaleCancelModal } from './SaleCancelModal'
import { SaleReturnModal } from './SaleReturnModal'
import { SaleInvoiceModal } from './SaleInvoiceModal'
import { SaleRemissionModal } from './SaleRemissionModal'
import { useSales } from '../hooks/useSales'
import { useSaleDetail } from '../hooks/useSaleDetail'
import { Sale, CreateSaleDTO, SaleReturnDTO } from '../types'
import { supabaseClient } from '@/lib/supabase/client'
import { getAuthenticatedCompany } from '@/lib/supabase/tenant'

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
    processReturn,
  } = useSales()

  // Modal / Drawer UI states
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false)
  const [selectedSaleIdForDetail, setSelectedSaleIdForDetail] = useState<string | null>(null)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)

  const [saleForCancel, setSaleForCancel] = useState<Sale | null>(null)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)

  const [saleForReturn, setSaleForReturn] = useState<Sale | null>(null)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)

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

  // Real locations & sellers from PostgreSQL
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [sellers, setSellers] = useState<string[]>([])

  useEffect(() => {
    let isMounted = true
    Promise.all([
      supabaseClient
        .from('locations')
        .select('id, name, code')
        .eq('status', 'ACTIVE')
        .order('name', { ascending: true }),
      supabaseClient
        .from('users')
        .select('id, full_name, email')
        .order('full_name', { ascending: true }),
    ])
      .then(([locsRes, usersRes]) => {
        if (isMounted) {
          if (locsRes.data) {
            setLocations(
              locsRes.data.map((l: any) => ({
                id: l.id,
                name: l.code ? `[${l.code}] ${l.name}` : l.name,
              }))
            )
          }
          if (usersRes.data) {
            setSellers(
              usersRes.data
                .map((u: any) => u.full_name || u.email)
                .filter(Boolean)
            )
          }
        }
      })
      .catch((err) => console.error('Error cargando ubicaciones o vendedores en SalesPage:', err))

    return () => {
      isMounted = false
    }
  }, [])

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

  const handleOpenReturn = (sale: Sale) => {
    setSaleForReturn(sale)
    setIsReturnModalOpen(true)
  }

  const handleConfirmReturn = async (dto: SaleReturnDTO) => {
    await processReturn(dto)
    if (selectedSaleIdForDetail === dto.saleId) {
      await refreshDetail()
    }
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

  const [isCompanyConfigured, setIsCompanyConfigured] = useState(true)

  useEffect(() => {
    async function checkCompany() {
      try {
        const comp = await getAuthenticatedCompany()
        if (comp) {
          setIsCompanyConfigured(Boolean((comp.business_name || comp.trade_name) && comp.tax_id))
        }
      } catch {
        setIsCompanyConfigured(true)
      }
    }
    checkCompany()
  }, [])

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Alerta si la empresa no ha sido configurada */}
      {!isCompanyConfigured && (
        <div
          className="alert-banner warning"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderRadius: 8,
            background: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#92400e',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AppIcon name="warning" size={22} />
            <div>
              <strong style={{ fontSize: 14 }}>Configure la empresa antes de operar</strong>
              <p style={{ margin: 0, fontSize: 13, color: '#b45309' }}>
                Debes registrar la información legal y tributaria de tu empresa para habilitar la facturación y ventas.
              </p>
            </div>
          </div>
          <a
            href="/configuracion"
            className="primary-button compact"
            style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Configurar Empresa
          </a>
        </div>
      )}

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
            disabled={!isCompanyConfigured}
            title={!isCompanyConfigured ? 'Configure la empresa antes de operar' : undefined}
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
        onProcessReturn={(s) => {
          setSaleForReturn(s)
          setIsReturnModalOpen(true)
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

      {/* 7b. Return Modal */}
      <SaleReturnModal
        isOpen={isReturnModalOpen}
        sale={saleForReturn}
        onClose={() => {
          setIsReturnModalOpen(false)
          setSaleForReturn(null)
        }}
        onConfirm={handleConfirmReturn}
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
