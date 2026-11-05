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
import { SelectField } from '@/components/ui/SelectField'
import { PageHeader } from '@/components/ui/PageHeader'
import { KpiCard } from '@/components/ui/KpiCard'
import { displayLabel, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, ID_DOCUMENT_LABELS } from '@/lib/labels/display-labels'

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
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

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
      setToast({ tone: 'error', message: 'No hay ventas con saldo pendiente para aplicar este abono.' })
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
    setToast({ tone: 'success', message: `Abono ${res.paymentNumber} registrado con éxito. Nuevo saldo: ${formatCOP(res.newPendingBalance)}` })
    setTimeout(() => setToast(null), 5000)

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

  const overdue = statement ? statement.summary.totalOverdueBalance : 0

  return (
    <div className="products-module-wrapper customer-statement-module-wrapper page-enter">
      {toast && (
        <div className={`toast-banner ${toast.tone === 'success' ? 'toast-success' : 'toast-error'} toast-pop-in`} role="status" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AppIcon name={toast.tone === 'success' ? 'check' : 'warning'} size={16} />
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button type="button" className="icon-button" onClick={() => setToast(null)} aria-label="Cerrar aviso">
            <AppIcon name="close" size={14} />
          </button>
        </div>
      )}

      <PageHeader
        eyebrow="Clientes y cartera"
        title="Estado de Cuenta"
        subtitle="Ficha financiera del cliente: cupo de crédito, ventas pendientes y abonos registrados."
        actions={
          statement && statement.summary.totalPendingBalance > 0 ? (
            <button type="button" className="primary-button" onClick={() => handleOpenPayment()}>
              <AppIcon name="plus" size={15} color="#fff" />
              <span>Registrar abono</span>
            </button>
          ) : undefined
        }
      />

      <div className="products-toolbar toolbar inventory-toolbar flex-wrap">
        <div className="filter-select-group filter-select-item flex-1 min-w-[260px]">
          <label htmlFor="statement-customer" className="sr-only">Cliente</label>
          <SelectField
            id="statement-customer"
            value={selectedCustomerId}
            size="sm"
            onChange={(value) => setSelectedCustomerId(value)}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName} ({c.documentNumber}) {c.currentBalance > 0 ? `- Saldo: ${formatCOP(c.currentBalance)}` : ''}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {loading || !statement ? (
        <p role="status" className="table-panel products-table-panel" style={{ margin: 0, padding: 60, textAlign: 'center', color: 'var(--muted)' }}>
          {customers.length === 0 && !loading ? 'No hay clientes registrados.' : 'Cargando estado de cuenta...'}
        </p>
      ) : (
        <>
          <section className="stats-grid dashboard-primary-grid page-enter" aria-label="Resumen financiero del cliente">
            <KpiCard
              title="Saldo actual"
              value={formatCOP(statement.customer.currentBalance)}
              iconName="wallet"
              tone="blue"
              badge="Deuda"
              note={`${statement.receivables.filter((r) => r.pendingBalance > 0).length} ventas con saldo`}
              subtext="Pendiente por cobrar"
              index={1}
            />
            <KpiCard
              title="Crédito disponible"
              value={formatCOP(statement.customer.availableCredit)}
              iconName="creditCard"
              tone="teal"
              badge="Cupo"
              note={`Límite ${formatCOP(statement.customer.creditLimit)}`}
              subtext={`Plazo de ${statement.customer.creditDays} días`}
              index={2}
            />
            <KpiCard
              title="Cartera vencida"
              value={formatCOP(overdue)}
              iconName="alertTriangle"
              tone="red"
              badge={overdue > 0 ? 'En mora' : 'Al día'}
              isPositive={overdue === 0}
              note={overdue > 0 ? 'Requiere gestión de cobro' : 'Sin facturas vencidas'}
              subtext="Saldo después del vencimiento"
              index={3}
            />
            <KpiCard
              title="Abonos registrados"
              value={formatCOP(statement.payments.reduce((acc, p) => acc + p.amount, 0))}
              iconName="receipt"
              tone="purple"
              badge="Pagos"
              note={`${statement.payments.length} comprobantes`}
              subtext="Histórico del cliente"
              index={4}
            />
          </section>

          <div className="statement-overview-grid">
            <section className="table-panel products-table-panel page-enter" aria-labelledby="statement-customer-title" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div className="product-info-cell">
                  <span className="aging-bucket-label">Ficha del cliente</span>
                  <h2 id="statement-customer-title" style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 800, color: 'var(--navy)' }}>
                    {statement.customer.displayName}
                  </h2>
                  <span className="sku-meta-text">
                    {displayLabel(ID_DOCUMENT_LABELS, statement.customer.documentType, '')} {statement.customer.documentNumber}
                  </span>
                </div>
                <span className={`status-badge ${statement.customer.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}>
                  {statement.customer.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <ul className="statement-contact-list">
                {statement.customer.phone && (
                  <li>
                    <AppIcon name="phone" size={14} aria-hidden="true" />
                    <span><span className="sr-only">Teléfono: </span>{statement.customer.phone}</span>
                  </li>
                )}
                {statement.customer.email && (
                  <li>
                    <AppIcon name="mail" size={14} aria-hidden="true" />
                    <span><span className="sr-only">Correo: </span>{statement.customer.email}</span>
                  </li>
                )}
                {statement.customer.address && (
                  <li>
                    <AppIcon icon="solar:map-point-linear" size={14} aria-hidden="true" />
                    <span><span className="sr-only">Dirección: </span>{statement.customer.address}{statement.customer.city ? `, ${statement.customer.city}` : ''}</span>
                  </li>
                )}
              </ul>
            </section>

            <section className="table-panel products-table-panel page-enter" aria-labelledby="statement-aging-title" style={{ padding: '16px 18px' }}>
              <h2 id="statement-aging-title" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>
                Antigüedad del saldo
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                {statement.aging.map((b) => (
                  <div key={b.bucket} className="aging-bucket-card is-static">
                    <span className="aging-bucket-label">{b.bucket}</span>
                    <strong className="aging-bucket-amount">{formatCOP(b.amount)}</strong>
                    <span className="aging-bucket-count">{b.count} documentos</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="products-toolbar toolbar inventory-toolbar flex-wrap">
            <div className="period-segmented-tabs" role="tablist" aria-label="Movimientos del cliente">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'receivables'}
                className={`period-tab-btn ${activeTab === 'receivables' ? 'selected' : ''}`}
                onClick={() => setActiveTab('receivables')}
              >
                Ventas y saldos ({statement.receivables.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'payments'}
                className={`period-tab-btn ${activeTab === 'payments' ? 'selected' : ''}`}
                onClick={() => setActiveTab('payments')}
              >
                Abonos y pagos ({statement.payments.length})
              </button>
            </div>
          </div>

          <div className="table-panel products-table-panel page-enter">
            {activeTab === 'receivables' ? (
              statement.receivables.length === 0 ? (
                <p style={{ margin: 0, padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No se registran ventas para este cliente.</p>
              ) : (
                <div className="table-scroll" tabIndex={0} aria-label="Ventas y saldos del cliente">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 150 }}>Venta</th>
                        <th style={{ minWidth: 120 }}>Vencimiento</th>
                        <th style={{ minWidth: 120, textAlign: 'right' }}>Total</th>
                        <th style={{ minWidth: 120, textAlign: 'right' }}>Abonado</th>
                        <th style={{ minWidth: 130, textAlign: 'right' }}>Saldo pendiente</th>
                        <th style={{ minWidth: 110, textAlign: 'center' }}>Estado</th>
                        <th style={{ width: 90, textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.receivables.map((r) => (
                        <tr key={r.id} className="table-row-hover">
                          <td className="product-code-col">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span className="sku-badge" style={{ fontWeight: 700 }}>{r.saleNumber}</span>
                              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(r.issueDate)}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 13 }}>{formatDate(r.dueDate)}</span>
                            {r.isOverdue && <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--red)' }}>Vencida</span>}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCOP(r.originalAmount)}</td>
                          <td style={{ textAlign: 'right', color: '#0369a1' }}>{formatCOP(r.paidAmount)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <strong style={{ color: r.pendingBalance > 0 ? '#b45309' : '#15803d' }}>{formatCOP(r.pendingBalance)}</strong>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`status-badge ${r.status === 'PAGADA' ? 'status-active' : r.status === 'VENCIDA' ? 'status-rejected' : 'status-pending'}`}>
                              {displayLabel(PAYMENT_STATUS_LABELS, r.status)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="action-buttons-group" style={{ justifyContent: 'center' }}>
                              {r.pendingBalance > 0 ? (
                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={() => handleOpenPayment(r)}
                                  title={`Registrar abono a ${r.saleNumber}`}
                                  aria-label={`Registrar abono a ${r.saleNumber}`}
                                >
                                  <AppIcon name="wallet" size={16} />
                                </button>
                              ) : (
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : statement.payments.length === 0 ? (
              <p style={{ margin: 0, padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No se registran abonos ni pagos para este cliente.</p>
            ) : (
              <div className="table-scroll" tabIndex={0} aria-label="Abonos y pagos del cliente">
                <table className="products-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 150 }}>Comprobante</th>
                      <th style={{ minWidth: 140 }}>Venta</th>
                      <th style={{ minWidth: 130 }}>Medio de pago</th>
                      <th style={{ minWidth: 120 }}>Referencia</th>
                      <th style={{ minWidth: 130, textAlign: 'right' }}>Valor abonado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.payments.map((p) => (
                      <tr key={p.id} className="table-row-hover">
                        <td className="product-code-col">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span className="sku-badge" style={{ fontWeight: 700 }}>{p.paymentNumber}</span>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(p.date)}</span>
                          </div>
                        </td>
                        <td style={{ color: '#0369a1', fontWeight: 600, fontSize: 12 }}>{p.saleNumber || '—'}</td>
                        <td>
                          <span className="kardex-type-badge type-badge-blue">{displayLabel(PAYMENT_METHOD_LABELS, p.paymentMethod)}</span>
                        </td>
                        <td style={{ color: '#64748b', fontSize: 12 }}>{p.reference || '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <strong style={{ color: '#047857', fontSize: 14 }}>{formatCOP(p.amount)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
