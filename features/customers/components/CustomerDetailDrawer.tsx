'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { CustomerDetail } from '../types'
import { CustomerOverviewTab } from './detail/tabs/CustomerOverviewTab'
import { CustomerSalesTab } from './detail/tabs/CustomerSalesTab'
import { CustomerInvoicesTab } from './detail/tabs/CustomerInvoicesTab'
import { CustomerRemissionsTab } from './detail/tabs/CustomerRemissionsTab'
import { CustomerWebOrdersTab } from './detail/tabs/CustomerWebOrdersTab'
import { CustomerPaymentsTab } from './detail/tabs/CustomerPaymentsTab'
import { CustomerDocumentsTab } from './detail/tabs/CustomerDocumentsTab'
import { CustomerAuditTab } from './detail/tabs/CustomerAuditTab'

interface CustomerDetailDrawerProps {
  isOpen: boolean
  customer: CustomerDetail | null
  loading: boolean
  onClose: () => void
  onEdit: () => void
  onAddPayment: () => void
  onAddDocument: (dto: any) => Promise<void>
}

type TabType =
  | 'summary'
  | 'sales'
  | 'invoices'
  | 'remissions'
  | 'webOrders'
  | 'payments'
  | 'documents'
  | 'audit'

const TABS: { id: TabType; label: string; icon: LightIconName; badgeCount?: (c: CustomerDetail) => number }[] = [
  { id: 'summary', label: 'Resumen', icon: 'dashboard' },
  { id: 'sales', label: 'Ventas', icon: 'sales', badgeCount: (c) => c.sales.length },
  { id: 'invoices', label: 'Facturas', icon: 'invoices', badgeCount: (c) => c.invoices.length },
  { id: 'remissions', label: 'Remisiones', icon: 'remisiones', badgeCount: (c) => c.remissions.length },
  { id: 'webOrders', label: 'Pedidos Web', icon: 'webOrders', badgeCount: (c) => c.webOrders.length },
  { id: 'payments', label: 'Pagos / Cartera', icon: 'wallet', badgeCount: (c) => c.payments.length },
  { id: 'documents', label: 'Documentos', icon: 'fileText', badgeCount: (c) => c.documents.length },
  { id: 'audit', label: 'Auditoría', icon: 'audit', badgeCount: (c) => c.auditLogs.length },
]

export function CustomerDetailDrawer({
  isOpen,
  customer,
  loading,
  onClose,
  onEdit,
  onAddPayment,
  onAddDocument,
}: CustomerDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('summary')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="product-drawer"
        style={{ width: 'min(100%, 780px)', maxWidth: '780px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Expediente del Cliente"
      >
        {loading || !customer ? (
          <div style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="skeleton-box" style={{ height: 32, width: '60%' }} />
            <div className="skeleton-box" style={{ height: 16, width: '40%' }} />
            <div className="skeleton-box" style={{ height: 120, width: '100%', borderRadius: 12 }} />
            <div className="skeleton-box" style={{ height: 200, width: '100%', borderRadius: 12 }} />
          </div>
        ) : (
          <>
            {/* Drawer Header */}
            <div className="drawer-header" style={{ alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: customer.customerType === 'COMPANY' ? '#e9eef8' : '#f0fbf6',
                    color: customer.customerType === 'COMPANY' ? 'var(--navy)' : 'var(--green)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {customer.customerType === 'COMPANY' ? (
                    <AppIcon name="warehouse" size={22} />
                  ) : (
                    <AppIcon name="users" size={22} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h2
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={customer.displayName}
                    >
                      {customer.displayName}
                    </h2>
                    <span
                      className={`state ${customer.status === 'ACTIVE' ? 'disponible' : 'crítico'}`}
                    >
                      <AppIcon name={customer.status === 'ACTIVE' ? 'check' : 'close'} size={11} />
                      <span>{customer.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span>
                    </span>
                  </div>

                  <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginTop: 3 }}>
                    <strong style={{ color: 'var(--foreground)' }}>
                      {customer.documentType} {customer.documentNumber}
                    </strong>{' '}
                    • {customer.city}, {customer.department} • {customer.phone}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="outline-button compact"
                  onClick={onEdit}
                  title="Editar datos del cliente"
                >
                  <AppIcon name="edit" size={13} />
                  <span>Editar</span>
                </button>

                <button
                  type="button"
                  className="icon-button"
                  onClick={onClose}
                  aria-label="Cerrar detalle"
                >
                  <AppIcon name="close" size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable Tabs Bar */}
            <div className="drawer-tabs" style={{ marginBottom: 20 }}>
              {TABS.map((tab) => {
                const count = tab.badgeCount ? tab.badgeCount(customer) : undefined
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={activeTab === tab.id ? 'active' : ''}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <AppIcon name={tab.icon} size={13} />
                    <span>{tab.label}</span>
                    {count !== undefined && count > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 10,
                          background: activeTab === tab.id ? 'var(--red)' : '#e2e8f0',
                          color: activeTab === tab.id ? '#ffffff' : '#475569',
                          fontWeight: 700,
                          marginLeft: 4,
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Tab Contents */}
            <div>
              {activeTab === 'summary' && (
                <CustomerOverviewTab
                  customer={customer}
                  onAddPaymentClick={onAddPayment}
                />
              )}

              {activeTab === 'sales' && (
                <CustomerSalesTab sales={customer.sales} />
              )}

              {activeTab === 'invoices' && (
                <CustomerInvoicesTab
                  invoices={customer.invoices}
                  onAddPaymentClick={onAddPayment}
                />
              )}

              {activeTab === 'remissions' && (
                <CustomerRemissionsTab remissions={customer.remissions} />
              )}

              {activeTab === 'webOrders' && (
                <CustomerWebOrdersTab orders={customer.webOrders} />
              )}

              {activeTab === 'payments' && (
                <CustomerPaymentsTab
                  payments={customer.payments}
                  currentBalance={customer.currentBalance}
                  onAddPaymentClick={onAddPayment}
                />
              )}

              {activeTab === 'documents' && (
                <CustomerDocumentsTab
                  documents={customer.documents}
                  customerId={customer.id}
                  onAddDocument={onAddDocument}
                />
              )}

              {activeTab === 'audit' && (
                <CustomerAuditTab auditLogs={customer.auditLogs} />
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
