'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import {
  accountsReceivableService,
  AccountReceivableItem,
  AccountsReceivableStats,
  AgingBucketSummary,
  AccountsReceivableFilterParams,
} from '../services/accounts-receivable.service'
import { CustomerPaymentModal } from './CustomerPaymentModal'
import { Customer } from '../types'

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

  return (
    <div className="accounts-receivable-page page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast */}
      {successToast && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 10,
            background: '#ecfdf5',
            border: '1.5px solid #a7f3d0',
            color: '#065f46',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{successToast}</span>
          <button type="button" onClick={() => setSuccessToast(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700 }}>
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', margin: 0, letterSpacing: '-0.5px' }}>
            Cuentas por Cobrar (CxC)
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Gestión fiduciaria de cartera, franjas de vencimiento y recaudos de clientes en PostgreSQL.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              loadData()
              loadStats()
            }}
          >
            <AppIcon name="refresh" size={15} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* KPIs Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div style={{ padding: '16px 20px', borderRadius: 14, background: '#ffffff', border: '1.5px solid #cbd5e1' }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
            Cartera Total Pendiente
          </span>
          <strong style={{ display: 'block', fontSize: 22, color: 'var(--navy)', marginTop: 6, letterSpacing: '-0.5px' }}>
            {statsLoading ? '...' : formatCOP(stats?.totalPendingBalance || 0)}
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>
            {stats?.pendingInvoicesCount || 0} obligaciones con saldo
          </small>
        </div>

        <div style={{ padding: '16px 20px', borderRadius: 14, background: '#ffffff', border: '1.5px solid #cbd5e1' }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#15803d' }}>
            Cartera Corriente (Al Día)
          </span>
          <strong style={{ display: 'block', fontSize: 22, color: '#15803d', marginTop: 6, letterSpacing: '-0.5px' }}>
            {statsLoading ? '...' : formatCOP(stats?.totalCurrentBalance || 0)}
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>
            Obligaciones sin vencer
          </small>
        </div>

        <div style={{ padding: '16px 20px', borderRadius: 14, background: '#fff1f2', border: '1.5px solid #fecdd3' }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#be123c' }}>
            Cartera Vencida (En Mora)
          </span>
          <strong style={{ display: 'block', fontSize: 22, color: '#be123c', marginTop: 6, letterSpacing: '-0.5px' }}>
            {statsLoading ? '...' : formatCOP(stats?.totalOverdueBalance || 0)}
          </strong>
          <small style={{ fontSize: 11, color: '#be123c' }}>
            {stats?.overdueInvoicesCount || 0} facturas vencidas ({stats?.customersOverdueCount || 0} clientes)
          </small>
        </div>

        <div style={{ padding: '16px 20px', borderRadius: 14, background: '#ffffff', border: '1.5px solid #cbd5e1' }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
            Total Recaudado Este Mes
          </span>
          <strong style={{ display: 'block', fontSize: 22, color: '#0284c7', marginTop: 6, letterSpacing: '-0.5px' }}>
            {statsLoading ? '...' : formatCOP(stats?.totalCollectedThisMonth || 0)}
          </strong>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>
            Ingresos a Caja y Bancos
          </small>
        </div>
      </div>

      {/* Aging Distribution Bar */}
      <div style={{ padding: '14px 20px', borderRadius: 14, background: '#ffffff', border: '1.5px solid #cbd5e1' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase' }}>
            Clasificación Dinámica de Cartera (Aging)
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            Basado en fecha de vencimiento y saldo pendiente
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {agingSummary.map((b) => (
            <button
              key={b.bucket}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, agingBucket: prev.agingBucket === b.bucket ? 'ALL' : b.bucket, page: 1 }))}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                textAlign: 'left',
                border: filters.agingBucket === b.bucket ? '2px solid var(--navy)' : '1px solid #e2e8f0',
                background: filters.agingBucket === b.bucket ? '#f1f5f9' : '#fafafa',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>{b.bucket}</div>
              <strong style={{ display: 'block', fontSize: 14, color: 'var(--navy)', marginTop: 2 }}>
                {formatCOP(b.amount)}
              </strong>
              <small style={{ fontSize: 10, color: 'var(--muted)' }}>{b.count} doc.</small>
            </button>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#ffffff', borderRadius: 12, border: '1.5px solid #cbd5e1' }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260 }}>
          <input
            type="text"
            className="filter-input"
            placeholder="Buscar por cliente, documento, venta..."
            value={filters.query || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value, page: 1 }))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="filter-select"
            value={filters.status || 'ALL'}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as any, page: 1 }))}
          >
            <option value="ALL">Todos los Estados</option>
            <option value="PENDIENTE">Pendientes de Pago</option>
            <option value="PAGO_PARCIAL">Con Abonos Parciales</option>
            <option value="VENCIDA">Vencidas en Mora</option>
            <option value="PAGADA">Totalmente Pagadas</option>
            <option value="ANULADA">Anuladas</option>
          </select>

          {(filters.query || filters.status !== 'ALL' || filters.agingBucket !== 'ALL') && (
            <button
              type="button"
              className="text-button"
              onClick={() => setFilters({ page: 1, pageSize: 15, status: 'ALL', agingBucket: 'ALL', query: '' })}
              style={{ fontSize: 12 }}
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Main Receivables Table */}
      <div className="table-container" style={{ background: '#ffffff', borderRadius: 14, border: '1.5px solid #cbd5e1', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            Cargando cartera fiduciaria desde PostgreSQL...
          </div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)' }}>
            Error: {error}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 50, textAlign: 'center', color: 'var(--muted)' }}>
            <AppIcon name="wallet" size={32} />
            <p style={{ marginTop: 8, fontSize: 14, fontWeight: 500 }}>No se encontraron obligaciones de cartera con los filtros actuales.</p>
          </div>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Venta / Fecha</th>
                <th style={{ padding: '12px 16px' }}>Cliente</th>
                <th style={{ padding: '12px 16px' }}>Vencimiento</th>
                <th style={{ padding: '12px 16px' }}>Antigüedad</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Venta</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Abonado</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Saldo Pendiente</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <td style={{ padding: '14px 16px' }}>
                    <strong style={{ color: 'var(--navy)', display: 'block' }}>{row.saleNumber}</strong>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(row.issueDate)}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <strong style={{ display: 'block', color: 'var(--navy)' }}>{row.customerName}</strong>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{row.customerDoc}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontWeight: 600 }}>{formatDate(row.dueDate)}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{row.creditDays} días plazo</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {getAgingBadge(row.agingBucket)}
                    {row.isOverdue && (
                      <span style={{ display: 'block', fontSize: 10, color: 'var(--red)' }}>
                        {Math.abs(row.daysRemainingOrOverdue)} días vencido
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600 }}>
                    {formatCOP(row.originalAmount)}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', color: '#0369a1' }}>
                    {formatCOP(row.paidAmount)}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <strong style={{ color: row.pendingBalance > 0 ? '#b45309' : '#15803d', fontSize: 14 }}>
                      {formatCOP(row.pendingBalance)}
                    </strong>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    {getStatusBadge(row.status)}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      {row.pendingBalance > 0 && row.status !== 'ANULADA' && (
                        <button
                          type="button"
                          className="primary-button"
                          style={{ padding: '6px 10px', fontSize: 11 }}
                          onClick={() => handleOpenPayment(row)}
                        >
                          <AppIcon name="plus" size={13} color="#fff" />
                          <span>Abonar</span>
                        </button>
                      )}
                      {row.paymentsCount > 0 && (
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ padding: '6px 10px', fontSize: 11 }}
                          onClick={() => handleViewHistory(row)}
                          title="Ver recibos de pago"
                        >
                          <AppIcon name="receipt" size={13} />
                          <span>{row.paymentsCount}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderTop: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Total: {total} obligaciones (Página {filters.page} de {totalPages})
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="secondary-button"
                style={{ padding: '4px 10px', fontSize: 12 }}
                disabled={filters.page === 1}
                onClick={() => setFilters((p) => ({ ...p, page: Math.max(1, (p.page || 1) - 1) }))}
              >
                Anterior
              </button>
              <button
                type="button"
                className="secondary-button"
                style={{ padding: '4px 10px', fontSize: 12 }}
                disabled={filters.page === totalPages}
                onClick={() => setFilters((p) => ({ ...p, page: Math.min(totalPages, (p.page || 1) + 1) }))}
              >
                Siguiente
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
              <button type="button" className="close-button" onClick={() => setIsHistoryOpen(false)}>
                ×
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
                        {formatDate(p.date)} • {p.paymentMethod}
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
