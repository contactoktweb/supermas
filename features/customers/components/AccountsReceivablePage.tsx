'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import {
  accountsReceivableService,
  AccountReceivableItem,
  AccountsReceivableStats,
  AgingBucketSummary,
  AccountsReceivableFilterParams,
} from '../services/accounts-receivable.service'
import { CustomerPaymentModal } from './CustomerPaymentModal'
import { Customer } from '../types'
import { PageHeader } from '@/components/ui/PageHeader'
import { KpiCard } from '@/components/ui/KpiCard'
import { displayLabel, PAYMENT_METHOD_LABELS } from '@/lib/labels/display-labels'

function formatCOP(val: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(val || 0)
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function AccountsReceivablePage() {
  const [items, setItems] = useState<AccountReceivableItem[]>([])
  const [stats, setStats] = useState<AccountsReceivableStats | null>(null)
  const [agingSummary, setAgingSummary] = useState<AgingBucketSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  // Filters
  const [filters, setFilters] = useState<AccountsReceivableFilterParams>({
    page: 1,
    pageSize: 15,
    status: 'ALL',
    agingBucket: 'ALL',
    query: '',
  })
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Payment Modal
  const [selectedReceivableForPayment, setSelectedReceivableForPayment] = useState<AccountReceivableItem | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  // History Drawer / Modal
  const [selectedReceivableHistory, setSelectedReceivableHistory] = useState<any[] | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [historySaleNumber, setHistorySaleNumber] = useState<string>('')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await accountsReceivableService.list(filters)
      setItems(res.items)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (err: any) {
      console.error('Error cargando cuentas por cobrar:', err)
      setError(err.message || 'Error al cargar cuentas por cobrar')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const [sData, aData] = await Promise.all([
        accountsReceivableService.getStats(),
        accountsReceivableService.getAgingSummary(),
      ])
      setStats(sData)
      setAgingSummary(aData)
    } catch (err) {
      console.error('Error cargando estadísticas de cartera:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const handleOpenPayment = (item: AccountReceivableItem) => {
    setSelectedReceivableForPayment(item)
    setIsPaymentModalOpen(true)
  }

  const handleViewHistory = async (item: AccountReceivableItem) => {
    try {
      setHistorySaleNumber(item.saleNumber)
      const history = await accountsReceivableService.getPaymentHistory(item.saleId)
      setSelectedReceivableHistory(history)
      setIsHistoryOpen(true)
    } catch (err: any) {
      alert('Error cargando historial de pagos: ' + err.message)
    }
  }

  const handlePaymentSubmit = async (dto: any) => {
    if (!selectedReceivableForPayment) return
    const res = await accountsReceivableService.registerPayment({
      saleId: selectedReceivableForPayment.saleId,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      reference: dto.reference,
      notes: dto.notes,
    })

    setIsPaymentModalOpen(false)
    setSelectedReceivableForPayment(null)
    setSuccessToast(
      `Comprobante ${res.paymentNumber} registrado exitosamente. Nuevo saldo: ${formatCOP(res.newPendingBalance)}.`
    )
    setTimeout(() => setSuccessToast(null), 5000)

    await Promise.all([loadData(), loadStats()])
  }

  // Convert selected receivable to dummy Customer structure for modal compatibility
  const customerForModal: Customer | null = selectedReceivableForPayment
    ? ({
        id: selectedReceivableForPayment.customerId,
        displayName: selectedReceivableForPayment.customerName,
        documentNumber: selectedReceivableForPayment.customerDoc,
        currentBalance: selectedReceivableForPayment.pendingBalance,
        creditLimit: 0,
        customerType: 'NATURAL',
        documentType: 'CC',
        phone: '',
        email: '',
        address: '',
        city: '',
        department: '',
        country: 'Colombia',
        category: 'FREQUENT',
        priceList: 'DEFAULT',
        creditDays: 0,
        totalPurchased: 0,
        purchasesCount: 0,
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      } as Customer)
    : null

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAGADA':
        return <span className="status-badge status-active">Pagada</span>
      case 'VENCIDA':
        return <span className="status-badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>Vencida</span>
      case 'PAGO_PARCIAL':
        return <span className="status-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>Abono Parcial</span>
      case 'ANULADA':
        return <span className="status-badge status-inactive">Anulada</span>
      default:
        return <span className="status-badge" style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>Pendiente</span>
    }
  }

  const getAgingBadge = (bucket: string) => {
    switch (bucket) {
      case 'CORRIENTE':
        return <span style={{ fontSize: 11, fontWeight: 600, color: '#15803d' }}>Corriente</span>
      case '1-30 DÍAS':
        return <span style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>1-30 d. mora</span>
      case '31-60 DÍAS':
        return <span style={{ fontSize: 11, fontWeight: 600, color: '#c2410c' }}>31-60 d. mora</span>
      case '61-90 DÍAS':
        return <span style={{ fontSize: 11, fontWeight: 600, color: '#b91c1c' }}>61-90 d. mora</span>
      default:
        return <span style={{ fontSize: 11, fontWeight: 700, color: '#7f1d1d' }}>&gt; 90 d. mora</span>
    }
  }

  const statusTabs = [
    { key: 'ALL', label: 'Todas' },
    { key: 'PENDIENTE', label: 'Pendientes' },
    { key: 'PAGO_PARCIAL', label: 'Abonadas' },
    { key: 'VENCIDA', label: 'Vencidas' },
    { key: 'PAGADA', label: 'Pagadas' },
  ] as const
  const activeFilterCount = [Boolean(filters.query), filters.status !== 'ALL', filters.agingBucket !== 'ALL'].filter(Boolean).length
  const kpiValue = (value?: number) => (statsLoading ? '...' : formatCOP(value || 0))
  const page = filters.page || 1
  const pageSize = filters.pageSize || 15

  return (
    <div className="products-module-wrapper accounts-receivable-module-wrapper page-enter">
      {successToast && (
        <div className="toast-banner toast-success toast-pop-in" role="status" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AppIcon name="check" size={16} />
          <span style={{ flex: 1 }}>{successToast}</span>
          <button type="button" className="icon-button" onClick={() => setSuccessToast(null)} aria-label="Cerrar aviso">
            <AppIcon name="close" size={14} />
          </button>
        </div>
      )}

      <PageHeader
        eyebrow="Clientes y cartera"
        title="Cuentas por Cobrar"
        subtitle="Ventas a crédito de clientes: vencimientos, abonos y saldo pendiente."
        actions={
          <button
            type="button"
            className="outline-button"
            onClick={() => {
              loadData()
              loadStats()
            }}
            disabled={loading}
          >
            <AppIcon name="refresh" size={15} className={loading ? 'spin' : ''} />
            <span>Actualizar</span>
          </button>
        }
      />

      <section className="stats-grid dashboard-primary-grid page-enter" aria-label="Métricas de cuentas por cobrar">
        <KpiCard
          title="Cartera total pendiente"
          value={kpiValue(stats?.totalPendingBalance)}
          iconName="wallet"
          tone="blue"
          badge="Cartera"
          note={`${stats?.pendingInvoicesCount || 0} obligaciones con saldo`}
          subtext="Total por cobrar a clientes"
          index={1}
        />
        <KpiCard
          title="Cartera corriente"
          value={kpiValue(stats?.totalCurrentBalance)}
          iconName="clock"
          tone="teal"
          badge="Al día"
          note="Dentro del plazo"
          subtext="Obligaciones sin vencer"
          index={2}
        />
        <KpiCard
          title="Cartera vencida"
          value={kpiValue(stats?.totalOverdueBalance)}
          iconName="warning"
          tone="red"
          badge="En mora"
          note={`${stats?.overdueInvoicesCount || 0} facturas · ${stats?.customersOverdueCount || 0} clientes`}
          isPositive={false}
          subtext="Plazo de crédito superado"
          index={3}
        />
        <KpiCard
          title="Recaudado este mes"
          value={kpiValue(stats?.totalCollectedThisMonth)}
          iconName="receipt"
          tone="purple"
          badge="Ingresos"
          note="Abonos recibidos"
          subtext="Ingresos a caja y bancos"
          index={4}
        />
      </section>

      <section className="table-panel products-table-panel page-enter" aria-labelledby="aging-title" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          <h2 id="aging-title" style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>
            Antigüedad de la cartera
          </h2>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Según la fecha de vencimiento. Toque una franja para filtrar.</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {agingSummary.map((b) => {
            const selected = filters.agingBucket === b.bucket
            return (
              <button
                key={b.bucket}
                type="button"
                className="aging-bucket-card"
                aria-pressed={selected}
                onClick={() => setFilters((prev) => ({ ...prev, agingBucket: prev.agingBucket === b.bucket ? 'ALL' : b.bucket, page: 1 }))}
              >
                <span className="aging-bucket-label">{b.bucket}</span>
                <strong className="aging-bucket-amount">{formatCOP(b.amount)}</strong>
                <span className="aging-bucket-count">{b.count} documentos</span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="products-toolbar toolbar inventory-toolbar flex-wrap">
        <div className="period-segmented-tabs" role="tablist" aria-label="Filtrar por estado">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={filters.status === tab.key}
              className={`period-tab-btn ${filters.status === tab.key ? 'selected' : ''}`}
              onClick={() => setFilters((prev) => ({ ...prev, status: tab.key, page: 1 }))}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="products-search-box search-box flex-1 min-w-[220px]">
          <AppIcon name="search" size={16} className="search-icon" />
          <input
            type="text"
            aria-label="Buscar cuentas por cobrar"
            placeholder="Buscar por cliente, documento o venta..."
            value={filters.query || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value, page: 1 }))}
          />
          {filters.query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setFilters((prev) => ({ ...prev, query: '', page: 1 }))}
              title="Limpiar búsqueda"
            >
              <AppIcon name="close" size={13} />
            </button>
          )}
        </div>

        {activeFilterCount > 0 && (
          <div className="filter-select-group">
            <button
              type="button"
              className="reset-filters-pill"
              onClick={() => setFilters({ page: 1, pageSize, status: 'ALL', agingBucket: 'ALL', query: '' })}
              title="Restablecer filtros"
            >
              <AppIcon name="close" size={12} />
              <span>Limpiar filtros</span>
              <span className="active-filter-badge">{activeFilterCount}</span>
            </button>
          </div>
        )}
      </div>

      <div className="table-panel products-table-panel page-enter">
        {loading ? (
          <p role="status" style={{ margin: 0, padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            Cargando cartera...
          </p>
        ) : error ? (
          <p role="alert" style={{ margin: 0, padding: 40, textAlign: 'center', color: 'var(--red)' }}>
            {error}
          </p>
        ) : items.length === 0 ? (
          <div style={{ padding: 50, textAlign: 'center', color: 'var(--muted)' }}>
            <AppIcon name="wallet" size={32} />
            <p style={{ marginTop: 8, fontSize: 14, fontWeight: 500 }}>No hay cuentas por cobrar con los filtros actuales.</p>
          </div>
        ) : (
          <div className="table-scroll" tabIndex={0} aria-label="Tabla de cuentas por cobrar">
            <table className="products-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 150 }}>Venta</th>
                  <th style={{ minWidth: 200 }}>Cliente</th>
                  <th style={{ minWidth: 140 }}>Vencimiento</th>
                  <th style={{ minWidth: 120 }}>Antigüedad</th>
                  <th style={{ minWidth: 120, textAlign: 'right' }}>Total venta</th>
                  <th style={{ minWidth: 120, textAlign: 'right' }}>Abonado</th>
                  <th style={{ minWidth: 130, textAlign: 'right' }}>Saldo</th>
                  <th style={{ minWidth: 110 }}>Estado</th>
                  <th className="sticky-right-col" style={{ minWidth: 130, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="table-row-hover">
                    <td className="product-code-col">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="sku-badge" style={{ fontWeight: 700 }}>{row.saleNumber}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(row.issueDate)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="product-info-cell">
                        <strong className="product-name-text" style={{ fontSize: 13 }}>{row.customerName}</strong>
                        <span className="sku-meta-text">{row.customerDoc}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{formatDate(row.dueDate)}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{row.creditDays} días de plazo</span>
                    </td>
                    <td>
                      {getAgingBadge(row.agingBucket)}
                      {row.isOverdue && (
                        <span style={{ display: 'block', fontSize: 10, color: 'var(--red)' }}>
                          {Math.abs(row.daysRemainingOrOverdue)} días vencido
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCOP(row.originalAmount)}</td>
                    <td style={{ textAlign: 'right', color: '#0369a1' }}>{formatCOP(row.paidAmount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ color: row.pendingBalance > 0 ? '#b45309' : '#15803d', fontSize: 14 }}>
                        {formatCOP(row.pendingBalance)}
                      </strong>
                    </td>
                    <td>{getStatusBadge(row.status)}</td>
                    <td className="sticky-right-col" style={{ textAlign: 'center' }}>
                      <div className="action-buttons-group" style={{ justifyContent: 'center' }}>
                        {row.pendingBalance > 0 && row.status !== 'ANULADA' && (
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => handleOpenPayment(row)}
                            title="Registrar abono"
                            aria-label={`Registrar abono a ${row.saleNumber}`}
                            style={{ color: '#7c3aed' }}
                          >
                            <AppIcon name="wallet" size={15} />
                          </button>
                        )}
                        {row.paymentsCount > 0 && (
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => handleViewHistory(row)}
                            title={`Ver ${row.paymentsCount} recibos de abono`}
                            aria-label={`Ver recibos de abono de ${row.saleNumber}`}
                            style={{ color: 'var(--navy)' }}
                          >
                            <AppIcon name="receipt" size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && total > 0 && (
          <div className="table-pagination-footer">
            <div className="pagination-info">
              <span>
                Mostrando <strong>{(page - 1) * pageSize + 1}</strong> - <strong>{Math.min(page * pageSize, total)}</strong> de{' '}
                <strong>{total}</strong> obligaciones
              </span>
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="pagination-btn"
                disabled={page <= 1}
                onClick={() => setFilters((p) => ({ ...p, page: Math.max(1, page - 1) }))}
              >
                ‹ Anterior
              </button>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', padding: '0 8px' }}>
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                className="pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setFilters((p) => ({ ...p, page: Math.min(totalPages, page + 1) }))}
              >
                Siguiente ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && customerForModal && selectedReceivableForPayment && (
        <CustomerPaymentModal
          isOpen={isPaymentModalOpen}
          customer={customerForModal}
          selectedInvoice={{
            id: selectedReceivableForPayment.saleId,
            invoiceNumber: selectedReceivableForPayment.saleNumber,
            date: selectedReceivableForPayment.issueDate,
            dueDate: selectedReceivableForPayment.dueDate,
            locationId: selectedReceivableForPayment.locationId,
            locationName: selectedReceivableForPayment.locationName,
            subtotal: selectedReceivableForPayment.originalAmount,
            taxTotal: 0,
            total: selectedReceivableForPayment.originalAmount,
            pendingBalance: selectedReceivableForPayment.pendingBalance,
            status: 'PAYMENT_PENDING',
            paymentMethod: selectedReceivableForPayment.paymentTerms,
            dianStatus: 'PENDIENTE',
            itemsCount: 1,
            saleId: selectedReceivableForPayment.saleId,
          }}
          onClose={() => {
            setIsPaymentModalOpen(false)
            setSelectedReceivableForPayment(null)
          }}
          onSubmit={handlePaymentSubmit}
        />
      )}

      {/* Payment History Modal */}
      {isHistoryOpen && (
        <div className="drawer-backdrop" onClick={() => setIsHistoryOpen(false)}>
          <div
            className="product-drawer"
            style={{ width: 'min(100%, 550px)', padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--navy)' }}>
                Recibos de Abono: {historySaleNumber}
              </h2>
              <button type="button" className="drawer-close-btn" onClick={() => setIsHistoryOpen(false)} aria-label="Cerrar recibos">
                <AppIcon name="close" size={16} />
              </button>
            </div>

            {selectedReceivableHistory && selectedReceivableHistory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedReceivableHistory.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', color: 'var(--navy)', fontSize: 13 }}>
                        {p.paymentNumber}
                      </strong>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {formatDate(p.date)} • {displayLabel(PAYMENT_METHOD_LABELS, p.paymentMethod)}
                      </span>
                      {p.reference && (
                        <span style={{ display: 'block', fontSize: 10, color: '#64748b' }}>
                          Ref: {p.reference}
                        </span>
                      )}
                    </div>
                    <strong style={{ fontSize: 15, color: '#0369a1' }}>
                      {formatCOP(p.amount)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>
                No se registran comprobantes de abono para esta venta.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
