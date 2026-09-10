'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Purchase, UserPermissionContext } from '../types'
import { getPurchaseStatusBadge, getPaymentTypeBadge } from './PurchaseTable'

interface PurchaseDetailDrawerProps {
  purchase: Purchase | null
  isOpen: boolean
  isCostRedacted: boolean
  userContext?: UserPermissionContext
  onClose: () => void
  onReceive?: (purchase: Purchase) => void
  onRegisterPayment?: (purchase: Purchase) => void
  onCancel?: (purchase: Purchase) => void
  onViewKardex?: (purchaseNumber: string, locationId: string) => void
}

export function PurchaseDetailDrawer({
  purchase,
  isOpen,
  isCostRedacted,
  userContext,
  onClose,
  onReceive,
  onRegisterPayment,
  onCancel,
  onViewKardex,
}: PurchaseDetailDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'items' | 'payments' | 'documents'>('items')

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !purchase || !mounted) return null

  const formatCurrency = (val: number) => {
    if (isCostRedacted) return '••••••'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—'
    const d = new Date(isoString)
    return d.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const canReceive =
    purchase.status === 'PENDING_RECEPTION' || purchase.status === 'DRAFT'
  const canPay =
    purchase.pendingBalance > 0 && purchase.status !== 'CANCELLED'
  const canCancel =
    purchase.status !== 'RECEIVED' &&
    purchase.status !== 'CANCELLED' &&
    purchase.status !== 'PAID'

  return createPortal(
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-detail-title"
    >
      <div
        className="product-drawer product-detail-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 760, width: '92vw' }}
      >
        {/* Header */}
        <div className="drawer-header product-detail-header-v2">
          <div className="product-detail-hero-layout">
            <div
              className="stat-icon blue"
              style={{ width: 44, height: 44, borderRadius: 12 }}
            >
              <AppIcon name="purchases" size={24} />
            </div>

            <div className="product-detail-header-info">
              <span className="product-category-eyebrow">
                Orden de Compra • {purchase.purchaseNumber}
              </span>
              <h2
                id="purchase-detail-title"
                className="product-detail-title-v2"
                style={{ fontSize: 18 }}
              >
                {purchase.supplierName}
              </h2>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 4,
                  flexWrap: 'wrap',
                }}
              >
                {getPurchaseStatusBadge(purchase.status)}
                {getPaymentTypeBadge(purchase.paymentType)}
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Factura: <strong>{purchase.supplierInvoiceNumber}</strong>
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  • {formatDate(purchase.date)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div
          style={{
            padding: '12px 24px',
            background: 'var(--bg-subtle, #f8fafc)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Botón Ver Kardex */}
            {onViewKardex && (
              <button
                type="button"
                className="outline-button"
                onClick={() =>
                  onViewKardex(
                    purchase.purchaseNumber,
                    purchase.destinationLocationId
                  )
                }
                title="Ver trazabilidad de movimientos en Kardex"
              >
                <AppIcon name="kardex" size={15} />
                <span>Ver Kardex</span>
              </button>
            )}

            {/* Recibir Compra */}
            {canReceive && onReceive && (
              <button
                type="button"
                className="primary-button"
                onClick={() => onReceive(purchase)}
                title="Confirmar recepción física en bodega e ingresar existencias"
              >
                <AppIcon name="warehouse" size={15} />
                <span>Recibir compra</span>
              </button>
            )}

            {/* Registrar Pago */}
            {canPay && onRegisterPayment && (
              <button
                type="button"
                className="outline-button"
                onClick={() => onRegisterPayment(purchase)}
                title="Registrar pago o abono a la factura"
                style={{ color: '#7c3aed', borderColor: '#c4b5fd' }}
              >
                <AppIcon name="wallet" size={15} />
                <span>Registrar pago</span>
              </button>
            )}
          </div>

          {/* Anular */}
          {canCancel && onCancel && (
            <button
              type="button"
              className="outline-button"
              onClick={() => onCancel(purchase)}
              title="Anular compra"
              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
            >
              <AppIcon name="close" size={14} />
              <span>Anular orden</span>
            </button>
          )}
        </div>

        {/* Executive Summary Cards */}
        <div
          style={{
            padding: '16px 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              padding: 10,
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Bodega destino
            </div>
            <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
              {purchase.destinationLocationName}
            </strong>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              {purchase.destinationLocationCode}
            </div>
          </div>

          <div
            style={{
              padding: 10,
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Total compra
            </div>
            <strong
              style={{ fontSize: 14, color: 'var(--navy)' }}
              className="font-tabular"
            >
              {formatCurrency(purchase.total)}
            </strong>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              IVA: {formatCurrency(purchase.taxTotal)}
            </div>
          </div>

          <div
            style={{
              padding: 10,
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Saldo pendiente
            </div>
            <strong
              style={{
                fontSize: 14,
                color: purchase.pendingBalance > 0 ? '#b45309' : '#16a34a',
              }}
              className="font-tabular"
            >
              {formatCurrency(purchase.pendingBalance)}
            </strong>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              Pagado: {formatCurrency(purchase.paidAmount)}
            </div>
          </div>

          <div
            style={{
              padding: 10,
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Registrado por
            </div>
            <strong style={{ fontSize: 12, color: 'var(--text-main)' }}>
              {purchase.createdByUserName}
            </strong>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              {formatDate(purchase.createdAt)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            padding: '0 24px',
            background: '#fff',
          }}
        >
          <button
            type="button"
            className={`period-tab-btn ${activeTab === 'items' ? 'selected' : ''}`}
            onClick={() => setActiveTab('items')}
            style={{
              padding: '12px 16px',
              borderBottom:
                activeTab === 'items'
                  ? '2px solid var(--navy)'
                  : '2px solid transparent',
              borderRadius: 0,
            }}
          >
            <AppIcon name="products" size={14} />
            <span>Productos ({purchase.items?.length || 0})</span>
          </button>

          <button
            type="button"
            className={`period-tab-btn ${activeTab === 'payments' ? 'selected' : ''}`}
            onClick={() => setActiveTab('payments')}
            style={{
              padding: '12px 16px',
              borderBottom:
                activeTab === 'payments'
                  ? '2px solid var(--navy)'
                  : '2px solid transparent',
              borderRadius: 0,
            }}
          >
            <AppIcon name="wallet" size={14} />
            <span>Pagos y Abonos ({purchase.payments?.length || 0})</span>
          </button>

          <button
            type="button"
            className={`period-tab-btn ${activeTab === 'documents' ? 'selected' : ''}`}
            onClick={() => setActiveTab('documents')}
            style={{
              padding: '12px 16px',
              borderBottom:
                activeTab === 'documents'
                  ? '2px solid var(--navy)'
                  : '2px solid transparent',
              borderRadius: 0,
            }}
          >
            <AppIcon name="invoices" size={14} />
            <span>Documentos ({purchase.attachments?.length || 0})</span>
          </button>
        </div>

        {/* Body Content */}
        <div
          className="drawer-body"
          style={{ padding: 24, overflowY: 'auto', flex: 1 }}
        >
          {/* TAB 1: PRODUCTOS */}
          {activeTab === 'items' && (
            <div className="page-enter">
              <div
                className="table-responsive"
                style={{ border: '1px solid var(--border)', borderRadius: 8 }}
              >
                <table className="products-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="numeric">Cant.</th>
                      <th className="numeric">Recibido</th>
                      <th className="numeric">Costo Unit.</th>
                      <th className="numeric">IVA</th>
                      <th className="numeric">Subtotal</th>
                      <th className="numeric">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.items?.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div>
                            <strong
                              style={{
                                fontSize: 12,
                                color: 'var(--text-main)',
                              }}
                            >
                              {item.productName}
                            </strong>
                            <div
                              style={{ fontSize: 10, color: 'var(--muted)' }}
                            >
                              SKU: {item.sku} • {item.unitOfMeasure}
                            </div>
                          </div>
                        </td>
                        <td className="numeric font-tabular">{item.quantity}</td>
                        <td className="numeric font-tabular">
                          <span
                            style={{
                              color:
                                item.receivedQuantity >= item.quantity
                                  ? '#16a34a'
                                  : '#b45309',
                              fontWeight: 600,
                            }}
                          >
                            {item.receivedQuantity}
                          </span>
                        </td>
                        <td className="numeric font-tabular">
                          {formatCurrency(item.unitCost)}
                        </td>
                        <td className="numeric font-tabular">
                          {formatCurrency(item.taxAmount)}
                          <div style={{ fontSize: 9, color: 'var(--muted)' }}>
                            {item.taxRatePercent}%
                          </div>
                        </td>
                        <td className="numeric font-tabular">
                          {formatCurrency(item.subtotal)}
                        </td>
                        <td className="numeric font-tabular">
                          <strong>{formatCurrency(item.total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totales Resumen */}
              <div
                style={{
                  marginTop: 16,
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <div
                  style={{
                    width: 280,
                    background: '#f8fafc',
                    padding: 14,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ color: 'var(--muted)' }}>Subtotal:</span>
                    <span className="font-tabular">
                      {formatCurrency(purchase.subtotal)}
                    </span>
                  </div>
                  {purchase.discountTotal > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        marginBottom: 6,
                        color: '#b45309',
                      }}
                    >
                      <span>Descuentos:</span>
                      <span className="font-tabular">
                        -{formatCurrency(purchase.discountTotal)}
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ color: 'var(--muted)' }}>IVA liquidado:</span>
                    <span className="font-tabular">
                      {formatCurrency(purchase.taxTotal)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 14,
                      fontWeight: 800,
                      color: 'var(--navy)',
                      borderTop: '1px solid var(--border)',
                      paddingTop: 8,
                    }}
                  >
                    <span>Total Orden:</span>
                    <span className="font-tabular" style={{ color: '#16a34a' }}>
                      {formatCurrency(purchase.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Datos de recepción si fue recibida */}
              {purchase.receptionInfo && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    background: '#f0fdf4',
                    borderRadius: 8,
                    border: '1px solid #bbf7d0',
                    fontSize: 12,
                    color: '#166534',
                  }}
                >
                  <strong>Mercancía Recibida en Bodega:</strong>
                  <div style={{ marginTop: 4 }}>
                    Recibido por {purchase.receptionInfo.receivedByUserName} el{' '}
                    {formatDate(purchase.receptionInfo.receivedAt)}.
                    {purchase.receptionInfo.notes && (
                      <p style={{ margin: '4px 0 0', fontStyle: 'italic' }}>
                        Nota: "{purchase.receptionInfo.notes}"
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PAGOS Y ABONOS */}
          {activeTab === 'payments' && (
            <div className="page-enter">
              {/* Barra de progreso de pago */}
              <div
                style={{
                  background: '#f8fafc',
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  <span>
                    Pagado:{' '}
                    <strong>{formatCurrency(purchase.paidAmount)}</strong> (
                    {(
                      (purchase.paidAmount / (purchase.total || 1)) *
                      100
                    ).toFixed(0)}
                    %)
                  </span>
                  <span>
                    Saldo:{' '}
                    <strong style={{ color: '#b45309' }}>
                      {formatCurrency(purchase.pendingBalance)}
                    </strong>
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: '#e2e8f0',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      background:
                        purchase.pendingBalance === 0 ? '#16a34a' : '#7c3aed',
                      width: `${Math.min(
                        100,
                        (purchase.paidAmount / (purchase.total || 1)) * 100
                      )}%`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* Tabla de pagos */}
              {!purchase.payments || purchase.payments.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px dashed var(--border)',
                    color: 'var(--muted)',
                    fontSize: 13,
                  }}
                >
                  No se han registrado abonos ni pagos a esta factura.
                </div>
              ) : (
                <div
                  className="table-responsive"
                  style={{ border: '1px solid var(--border)', borderRadius: 8 }}
                >
                  <table className="products-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Método</th>
                        <th>Referencia</th>
                        <th>Registrado por</th>
                        <th className="numeric">Valor Pagado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchase.payments.map((p) => (
                        <tr key={p.id}>
                          <td>{formatDate(p.date)}</td>
                          <td>
                            <span className="sku-badge">{p.paymentMethod}</span>
                          </td>
                          <td>{p.reference}</td>
                          <td>{p.registeredByUserName}</td>
                          <td className="numeric font-tabular">
                            <strong style={{ color: '#16a34a' }}>
                              {formatCurrency(p.amount)}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DOCUMENTOS */}
          {activeTab === 'documents' && (
            <div className="page-enter">
              {!purchase.attachments || purchase.attachments.length === 0 ? (
                <div
                  style={{
                    padding: 28,
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px dashed var(--border)',
                    color: 'var(--muted)',
                    fontSize: 13,
                  }}
                >
                  <AppIcon name="invoices" size={24} />
                  <p style={{ margin: '8px 0 0' }}>
                    No se adjuntaron facturas ni documentos digitales a esta orden.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {purchase.attachments.map((att) => (
                    <div
                      key={att.id}
                      style={{
                        padding: 14,
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 8,
                            background: '#eff6ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--navy)',
                          }}
                        >
                          <AppIcon name="invoices" size={20} />
                        </div>
                        <div>
                          <strong
                            style={{
                              fontSize: 13,
                              color: 'var(--navy)',
                              display: 'block',
                            }}
                          >
                            {att.fileName}
                          </strong>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {(att.fileSize / 1024).toFixed(1)} KB • Subido por{' '}
                            {att.uploadedBy} el {formatDate(att.uploadedAt)}
                          </span>
                        </div>
                      </div>

                      <a
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="outline-button-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <AppIcon name="eye" size={14} />
                        <span>Visualizar factura</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="drawer-footer"
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: '#fff',
          }}
        >
          <button type="button" className="outline-button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
