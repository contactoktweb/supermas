'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import {
  accountsReceivableService,
  CustomerAccountStatement,
} from '../services/accounts-receivable.service'
import { customerService } from '../services/customer.service'
import { Customer } from '../types'
import { CustomerPaymentModal } from './CustomerPaymentModal'

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

export function CustomerStatementPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [statement, setStatement] = useState<CustomerAccountStatement | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'receivables' | 'payments'>('receivables')

  // Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedSaleForPayment, setSelectedSaleForPayment] = useState<any | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  // Cargar lista de clientes para el selector
  useEffect(() => {
    async function loadCustomers() {
      const list = await customerService.getAll()
      setCustomers(list)
      if (list.length > 0) {
        // Seleccionar cliente con mayor saldo o el primero
        const withBalance = list.find((c) => c.currentBalance > 0)
        setSelectedCustomerId(withBalance ? withBalance.id : list[0].id)
      }
    }
    loadCustomers()
  }, [])

  // Cargar estado de cuenta al cambiar cliente seleccionado
  const loadStatement = useCallback(async () => {
    if (!selectedCustomerId) {
      setStatement(null)
      return
    }
    try {
      setLoading(true)
      const data = await accountsReceivableService.getCustomerAccountStatement(selectedCustomerId)
      setStatement(data)
    } catch (err) {
      console.error('Error al cargar estado de cuenta:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedCustomerId])

  useEffect(() => {
    loadStatement()
  }, [loadStatement])

  const handleOpenPayment = (saleItem?: any) => {
    setSelectedSaleForPayment(saleItem || null)
    setIsPaymentModalOpen(true)
  }

  const handlePaymentSubmit = async (dto: any) => {
    if (!statement) return
    const targetSaleId = selectedSaleForPayment?.saleId || statement.receivables.find((r) => r.pendingBalance > 0)?.saleId
    if (!targetSaleId) {
      alert('No hay ventas con saldo pendiente para aplicar este abono.')
      return
    }

    const res = await accountsReceivableService.registerPayment({
      saleId: targetSaleId,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      reference: dto.reference,
      notes: dto.notes,
    })

    setIsPaymentModalOpen(false)
    setSelectedSaleForPayment(null)
    setSuccessToast(`Abono ${res.paymentNumber} registrado con éxito. Nuevo saldo: ${formatCOP(res.newPendingBalance)}`)
    setTimeout(() => setSuccessToast(null), 5000)

    await loadStatement()
  }

  const customerForModal: Customer | null = statement
    ? ({
        id: statement.customer.id,
        displayName: statement.customer.displayName,
        documentNumber: statement.customer.documentNumber,
        currentBalance: statement.customer.currentBalance,
        creditLimit: statement.customer.creditLimit,
        customerType: 'NATURAL',
        documentType: 'CC',
        phone: statement.customer.phone,
        email: statement.customer.email,
        address: statement.customer.address,
        city: statement.customer.city,
        department: '',
        country: 'Colombia',
        category: 'FREQUENT',
        priceList: 'DEFAULT',
        creditDays: statement.customer.creditDays,
        totalPurchased: 0,
        purchasesCount: 0,
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      } as Customer)
    : null

  return (
    <div className="customer-statement-page page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast */}
      {successToast && (
        <div style={{ padding: '12px 18px', borderRadius: 10, background: '#ecfdf5', border: '1.5px solid #a7f3d0', color: '#065f46', fontSize: 13, fontWeight: 600 }}>
          {successToast}
        </div>
      )}

      {/* Header & Customer Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', margin: 0, letterSpacing: '-0.5px' }}>
            Estado de Cuenta del Cliente
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Ficha financiera integral, cupo de crédito disponible y movimientos en PostgreSQL.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>Cliente:</label>
          <select
            className="filter-select"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            style={{ minWidth: 260, fontWeight: 600 }}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName} ({c.documentNumber}) {c.currentBalance > 0 ? `• Saldo: ${formatCOP(c.currentBalance)}` : ''}
              </option>
            ))}
          </select>

          {statement && statement.summary.totalPendingBalance > 0 && (
            <button type="button" className="primary-button" onClick={() => handleOpenPayment()}>
              <AppIcon name="plus" size={15} color="#fff" />
              <span>Registrar Abono</span>
            </button>
          )}
        </div>
      </div>

      {loading || !statement ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Cargando estado de cuenta...</div>
      ) : (
        <>
          {/* Customer Profile & Credit Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {/* Info Card */}
            <div style={{ padding: '18px 22px', borderRadius: 14, background: '#ffffff', border: '1.5px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
                    Ficha del Cliente
                  </span>
                  <strong style={{ display: 'block', fontSize: 18, color: 'var(--navy)', marginTop: 4 }}>
                    {statement.customer.displayName}
                  </strong>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {statement.customer.documentType} {statement.customer.documentNumber}
                  </span>
                </div>
                <span className={`status-badge ${statement.customer.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}>
                  {statement.customer.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
                {statement.customer.phone && <div>📞 {statement.customer.phone}</div>}
                {statement.customer.email && <div>✉️ {statement.customer.email}</div>}
                {statement.customer.address && <div>📍 {statement.customer.address}, {statement.customer.city}</div>}
              </div>
            </div>

            {/* Credit Financial Health Card */}
            <div style={{ padding: '18px 22px', borderRadius: 14, background: '#ffffff', border: '1.5px solid #cbd5e1' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
                Control de Crédito y Cupo
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <small style={{ fontSize: 11, color: 'var(--muted)' }}>Límite Aprobado:</small>
                  <strong style={{ display: 'block', fontSize: 16, color: 'var(--navy)' }}>
                    {formatCOP(statement.customer.creditLimit)}
                  </strong>
                </div>

                <div>
                  <small style={{ fontSize: 11, color: 'var(--muted)' }}>Plazo Concedido:</small>
                  <strong style={{ display: 'block', fontSize: 16, color: 'var(--navy)' }}>
                    {statement.customer.creditDays} días
                  </strong>
                </div>

                <div>
                  <small style={{ fontSize: 11, color: '#b45309' }}>Saldo Actual (Deuda):</small>
                  <strong style={{ display: 'block', fontSize: 18, color: statement.customer.currentBalance > 0 ? '#b45309' : '#15803d' }}>
                    {formatCOP(statement.customer.currentBalance)}
                  </strong>
                </div>

                <div>
                  <small style={{ fontSize: 11, color: '#047857' }}>Crédito Disponible:</small>
                  <strong style={{ display: 'block', fontSize: 18, color: '#047857' }}>
                    {formatCOP(statement.customer.availableCredit)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Balances Summary Card */}
            <div style={{ padding: '18px 22px', borderRadius: 14, background: statement.summary.totalOverdueBalance > 0 ? '#fff1f2' : '#f0fbf6', border: `1.5px solid ${statement.summary.totalOverdueBalance > 0 ? '#fecdd3' : '#a7f3d0'}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: statement.summary.totalOverdueBalance > 0 ? '#be123c' : '#047857' }}>
                {statement.summary.totalOverdueBalance > 0 ? 'Cartera Vencida en Mora' : 'Cliente al Día'}
              </span>
              <strong style={{ display: 'block', fontSize: 24, color: statement.summary.totalOverdueBalance > 0 ? '#be123c' : '#047857', marginTop: 6 }}>
                {formatCOP(statement.summary.totalPendingBalance)}
              </strong>
              <small style={{ display: 'block', marginTop: 4, fontSize: 12, color: statement.summary.totalOverdueBalance > 0 ? '#be123c' : '#047857' }}>
                {statement.summary.totalOverdueBalance > 0
                  ? `Vencido en mora: ${formatCOP(statement.summary.totalOverdueBalance)}`
                  : 'No presenta facturas vencidas'}
              </small>
            </div>
          </div>

          {/* Aging Distribution */}
          <div style={{ display: 'flex', gap: 10, padding: 14, background: '#ffffff', borderRadius: 12, border: '1.5px solid #cbd5e1', overflowX: 'auto' }}>
            {statement.aging.map((b) => (
              <div key={b.bucket} style={{ flex: 1, minWidth: 120, padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>{b.bucket}</span>
                <strong style={{ display: 'block', fontSize: 14, color: 'var(--navy)', marginTop: 2 }}>{formatCOP(b.amount)}</strong>
                <small style={{ fontSize: 10, color: 'var(--muted)' }}>{b.count} doc.</small>
              </div>
            ))}
          </div>

          {/* Tabs for Statement Tables */}
          <div style={{ display: 'flex', gap: 12, borderBottom: '2px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={() => setActiveTab('receivables')}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 14,
                color: activeTab === 'receivables' ? 'var(--navy)' : 'var(--muted)',
                borderBottom: activeTab === 'receivables' ? '2px solid var(--navy)' : 'none',
                marginBottom: -2,
              }}
            >
              Ventas y Cuentas por Cobrar ({statement.receivables.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('payments')}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 14,
                color: activeTab === 'payments' ? 'var(--navy)' : 'var(--muted)',
                borderBottom: activeTab === 'payments' ? '2px solid var(--navy)' : 'none',
                marginBottom: -2,
              }}
            >
              Comprobantes de Abono / Pago ({statement.payments.length})
            </button>
          </div>

          {/* Table Content */}
          <div className="table-container" style={{ background: '#ffffff', borderRadius: 14, border: '1.5px solid #cbd5e1', overflow: 'hidden' }}>
            {activeTab === 'receivables' ? (
              statement.receivables.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No se registran ventas para este cliente.</div>
              ) : (
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 16px' }}>Venta / Fecha</th>
                      <th style={{ padding: '12px 16px' }}>Vencimiento</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Abonado</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Saldo Pendiente</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Estado</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.receivables.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                        <td style={{ padding: '12px 16px' }}>
                          <strong style={{ color: 'var(--navy)', display: 'block' }}>{r.saleNumber}</strong>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(r.issueDate)}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span>{formatDate(r.dueDate)}</span>
                          {r.isOverdue && <span style={{ display: 'block', fontSize: 10, color: 'var(--red)' }}>Vencida</span>}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{formatCOP(r.originalAmount)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#0369a1' }}>{formatCOP(r.paidAmount)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <strong style={{ color: r.pendingBalance > 0 ? '#b45309' : '#15803d' }}>
                            {formatCOP(r.pendingBalance)}
                          </strong>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span className={`status-badge ${r.status === 'PAGADA' ? 'status-active' : r.status === 'VENCIDA' ? 'status-rejected' : 'status-pending'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {r.pendingBalance > 0 && (
                            <button
                              type="button"
                              className="primary-button"
                              style={{ padding: '5px 10px', fontSize: 11 }}
                              onClick={() => handleOpenPayment(r)}
                            >
                              Abonar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : statement.payments.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No se registran abonos ni pagos para este cliente.</div>
            ) : (
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px' }}>Comprobante / Fecha</th>
                    <th style={{ padding: '12px 16px' }}>Venta</th>
                    <th style={{ padding: '12px 16px' }}>Medio de Pago</th>
                    <th style={{ padding: '12px 16px' }}>Referencia</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor Abonado</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.payments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                      <td style={{ padding: '12px 16px' }}>
                        <strong style={{ color: 'var(--navy)', display: 'block' }}>{p.paymentNumber}</strong>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(p.date)}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#0369a1', fontWeight: 600 }}>{p.saleNumber || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>{p.paymentMethod}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>{p.reference || '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                        {formatCOP(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && customerForModal && (
        <CustomerPaymentModal
          isOpen={isPaymentModalOpen}
          customer={customerForModal}
          selectedInvoice={
            selectedSaleForPayment
              ? {
                  id: selectedSaleForPayment.saleId,
                  invoiceNumber: selectedSaleForPayment.saleNumber,
                  date: selectedSaleForPayment.issueDate,
                  dueDate: selectedSaleForPayment.dueDate,
                  locationId: selectedSaleForPayment.locationId,
                  locationName: selectedSaleForPayment.locationName,
                  subtotal: selectedSaleForPayment.originalAmount,
                  taxTotal: 0,
                  total: selectedSaleForPayment.originalAmount,
                  pendingBalance: selectedSaleForPayment.pendingBalance,
                  status: 'PAYMENT_PENDING',
                  paymentMethod: selectedSaleForPayment.paymentTerms,
                  dianStatus: 'PENDIENTE',
                  itemsCount: 1,
                  saleId: selectedSaleForPayment.saleId,
                }
              : null
          }
          onClose={() => {
            setIsPaymentModalOpen(false)
            setSelectedSaleForPayment(null)
          }}
          onSubmit={handlePaymentSubmit}
        />
      )}
    </div>
  )
}
