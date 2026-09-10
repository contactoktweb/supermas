'use client'

import React, { useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { SaleDetail, SaleStatus } from '../types'

interface SaleDetailDrawerProps {
  isOpen: boolean
  sale: SaleDetail | null
  loading: boolean
  onClose: () => void
  onGenerateInvoice: (sale: SaleDetail) => void
  onGenerateRemission: (sale: SaleDetail) => void
  onCancelSale: (sale: SaleDetail) => void
  onViewKardex?: (sale: SaleDetail) => void
}

type TabType = 'summary' | 'products' | 'documents' | 'kardex' | 'audit'

const TABS: { id: TabType; label: string; icon: LightIconName; badgeCount?: (s: SaleDetail) => number }[] = [
  { id: 'summary', label: 'Resumen', icon: 'dashboard' },
  { id: 'products', label: 'Productos', icon: 'products', badgeCount: (s) => s.items?.length || 0 },
  { id: 'documents', label: 'Documentos', icon: 'fileText', badgeCount: (s) => (s.invoiceId ? 1 : 0) + (s.remissionId ? 1 : 0) },
  { id: 'kardex', label: 'Kardex', icon: 'kardex', badgeCount: (s) => s.inventoryMovements?.length || 0 },
  { id: 'audit', label: 'Auditoría', icon: 'audit', badgeCount: (s) => s.auditLogs?.length || 0 },
]

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function SaleDetailDrawer({
  isOpen,
  sale,
  loading,
  onClose,
  onGenerateInvoice,
  onGenerateRemission,
  onCancelSale,
  onViewKardex,
}: SaleDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('summary')

  if (!isOpen) return null

  const getStatusBadge = (status: SaleStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="custom-badge badge-green">Confirmada</span>
      case 'INVOICED':
        return <span className="custom-badge badge-blue">Facturada</span>
      case 'PENDING':
        return <span className="custom-badge badge-amber">Pendiente</span>
      case 'CANCELLED':
        return <span className="custom-badge badge-red">Anulada</span>
      case 'RETURNED':
        return <span className="custom-badge badge-purple">Devuelta</span>
      default:
        return <span className="custom-badge">{status}</span>
    }
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div
        className="drawer-panel page-enter"
        style={{
          width: '100%',
          maxWidth: 750,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="drawer-header" style={{ paddingBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--red)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Venta Comercial
              </span>
              {sale && getStatusBadge(sale.status)}
            </div>
            <h2 style={{ fontSize: 18, color: 'var(--navy)', margin: '4px 0 0' }}>
              {sale ? `${sale.saleNumber} — ${sale.customerName}` : 'Cargando venta...'}
            </h2>
            {sale && (
              <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                Registrada el {formatDate(sale.date)} • Bodega: {sale.locationName}
              </small>
            )}
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 20px',
            borderBottom: '1px solid var(--line)',
            background: '#f8fafc',
            overflowX: 'auto',
          }}
        >
          {TABS.map((tab) => {
            const count = sale && tab.badgeCount ? tab.badgeCount(sale) : 0
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 12px',
                  border: 'none',
                  borderBottom: isActive ? '2.5px solid var(--navy)' : '2.5px solid transparent',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--navy)' : 'var(--muted)',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <AppIcon name={tab.icon} size={15} color={isActive ? 'var(--navy)' : '#64748b'} />
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: isActive ? '#001b5c14' : '#e2e8f0',
                      color: isActive ? 'var(--navy)' : '#475569',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading || !sale ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton-box" style={{ height: 75, width: '100%' }} />
              ))}
            </div>
          ) : (
            <>
              {/* TAB 1: RESUMEN */}
              {activeTab === 'summary' && (
                <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Financial KPI Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    <div className="stat-card" style={{ padding: 12 }}>
                      <div className="stat-text">
                        <span style={{ fontSize: 11 }}>Total Venta</span>
                        <strong style={{ fontSize: 15, color: 'var(--navy)' }}>
                          {formatCOP(sale.totalAmount)}
                        </strong>
                      </div>
                    </div>

                    <div className="stat-card" style={{ padding: 12 }}>
                      <div className="stat-text">
                        <span style={{ fontSize: 11 }}>Costo Total</span>
                        <strong style={{ fontSize: 15, color: '#64748b' }}>
                          {formatCOP(sale.totalCost)}
                        </strong>
                      </div>
                    </div>

                    <div className="stat-card" style={{ padding: 12 }}>
                      <div className="stat-text">
                        <span style={{ fontSize: 11 }}>Utilidad Bruta</span>
                        <strong style={{ fontSize: 15, color: '#10b981' }}>
                          {formatCOP(sale.totalProfit)}
                        </strong>
                      </div>
                    </div>

                    <div className="stat-card" style={{ padding: 12 }}>
                      <div className="stat-text">
                        <span style={{ fontSize: 11 }}>Margen (%)</span>
                        <strong style={{ fontSize: 15, color: 'var(--navy)' }}>
                          {sale.profitMarginPercent}%
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Customer and Sale Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {/* Customer Info Card */}
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: '#f8fafc',
                        border: '1.5px solid #cbd5e1',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        fontSize: 12,
                      }}
                    >
                      <strong style={{ fontSize: 13, color: 'var(--navy)' }}>Información del Cliente</strong>
                      <div>
                        <span style={{ color: 'var(--muted)' }}>Nombre / Razón Social: </span>
                        <strong>{sale.customerName}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted)' }}>Documento / NIT: </span>
                        <span>{sale.customerDoc}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted)' }}>Lista de Precios: </span>
                        <span style={{ fontWeight: 600, color: 'var(--navy)' }}>
                          {sale.priceList === 'WHOLESALE' ? 'Mayorista' : sale.priceList === 'VIP' ? 'VIP' : 'Normal'}
                        </span>
                      </div>
                      {sale.customer && (
                        <>
                          <div>
                            <span style={{ color: 'var(--muted)' }}>Teléfono: </span>
                            <span>{sale.customer.phone || '—'}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--muted)' }}>Ciudad: </span>
                            <span>{sale.customer.city || '—'}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Operational Details Card */}
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: '#f8fafc',
                        border: '1.5px solid #cbd5e1',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        fontSize: 12,
                      }}
                    >
                      <strong style={{ fontSize: 13, color: 'var(--navy)' }}>Detalles de la Operación</strong>
                      <div>
                        <span style={{ color: 'var(--muted)' }}>Bodega de Despacho: </span>
                        <strong>{sale.locationName}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted)' }}>Vendedor / Cajero: </span>
                        <span>{sale.sellerName}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted)' }}>Método de Pago: </span>
                        <strong>{sale.paymentMethod}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted)' }}>Documento Emitido: </span>
                        <span>{sale.documentType}</span>
                      </div>
                      {sale.notes && (
                        <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--line)' }}>
                          <span style={{ color: 'var(--muted)', display: 'block' }}>Observaciones:</span>
                          <span style={{ fontStyle: 'italic' }}>{sale.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {sale.cancellationReason && (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: '#fef2f2',
                        border: '1.5px solid #fecaca',
                        color: '#991b1b',
                        fontSize: 13,
                      }}
                    >
                      <strong>Venta Anulada</strong>
                      <p style={{ margin: '4px 0 0', fontSize: 12 }}>
                        Motivo: {sale.cancellationReason} • Anulado por: {sale.cancelledBy} ({formatDate(sale.cancelledAt || '')})
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PRODUCTOS */}
              {activeTab === 'products' && (
                <div className="page-enter">
                  <div className="table-scroll">
                    <table style={{ width: '100%', fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th style={{ textAlign: 'center' }}>Cant</th>
                          <th style={{ textAlign: 'right' }}>Precio Unit</th>
                          <th style={{ textAlign: 'center' }}>Dcto</th>
                          <th style={{ textAlign: 'center' }}>IVA</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale.items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <strong style={{ color: 'var(--navy)', display: 'block' }}>
                                {item.productName}
                              </strong>
                              <small style={{ color: 'var(--muted)' }}>SKU: {item.sku}</small>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>
                              {item.quantity} {item.unitOfMeasure}
                            </td>
                            <td style={{ textAlign: 'right' }}>{formatCOP(item.unitPrice)}</td>
                            <td style={{ textAlign: 'center' }}>
                              {item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>{item.taxRatePercent}%</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>
                              {formatCOP(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div
                    style={{
                      marginTop: 16,
                      padding: 14,
                      borderRadius: 10,
                      background: '#f8fafc',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Subtotal:</span>
                        <span>{formatCOP(sale.subtotal)}</span>
                      </div>
                      {sale.discountTotal > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                          <span>Descuentos:</span>
                          <span>-{formatCOP(sale.discountTotal)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Impuestos (IVA):</span>
                        <span>+{formatCOP(sale.taxTotal)}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          borderTop: '1px solid var(--line)',
                          paddingTop: 6,
                          fontWeight: 700,
                          fontSize: 14,
                          color: 'var(--navy)',
                        }}
                      >
                        <span>Total:</span>
                        <span>{formatCOP(sale.totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: DOCUMENTOS */}
              {activeTab === 'documents' && (
                <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Factura */}
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      background: '#ffffff',
                      border: '1.5px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: '#eef4fd',
                          color: 'var(--navy)',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <AppIcon name="fileText" size={20} />
                      </div>
                      <div>
                        <strong style={{ fontSize: 13, color: 'var(--navy)', display: 'block' }}>
                          Factura Fiscal / Electrónica
                        </strong>
                        {sale.invoice ? (
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {sale.invoice.invoiceNumber} • {sale.invoice.dianStatus} • {formatCOP(sale.invoice.total)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            No se ha emitido factura electrónica formal para esta venta.
                          </span>
                        )}
                      </div>
                    </div>

                    {sale.invoice ? (
                      <span className="custom-badge badge-green">Emitida</span>
                    ) : (
                      sale.status !== 'CANCELLED' && (
                        <button
                          type="button"
                          className="primary-button compact"
                          onClick={() => onGenerateInvoice(sale)}
                        >
                          <AppIcon name="invoices" size={14} /> Facturar
                        </button>
                      )
                    )}
                  </div>

                  {/* Remisión */}
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      background: '#ffffff',
                      border: '1.5px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: '#f5f3ff',
                          color: '#7c3aed',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <AppIcon name="remisiones" size={20} />
                      </div>
                      <div>
                        <strong style={{ fontSize: 13, color: 'var(--navy)', display: 'block' }}>
                          Guía de Remisión y Entrega
                        </strong>
                        {sale.remission ? (
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {sale.remission.remissionNumber} • {sale.remission.status} • {sale.remission.deliveredBy}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            No se ha generado guía de remisión para este despacho.
                          </span>
                        )}
                      </div>
                    </div>

                    {sale.remission ? (
                      <span className="custom-badge badge-purple">Entregada</span>
                    ) : (
                      sale.status !== 'CANCELLED' && (
                        <button
                          type="button"
                          className="primary-button compact"
                          onClick={() => onGenerateRemission(sale)}
                        >
                          <AppIcon name="remisiones" size={14} /> Crear Remisión
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: KARDEX */}
              {activeTab === 'kardex' && (
                <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                      Movimientos Generados en Kardex ({sale.inventoryMovements?.length || 0})
                    </span>
                    {onViewKardex && (
                      <button
                        type="button"
                        className="outline-button compact"
                        onClick={() => onViewKardex(sale)}
                      >
                        <AppIcon name="kardex" size={13} /> Ver en Módulo Kardex
                      </button>
                    )}
                  </div>

                  {sale.inventoryMovements?.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                      No se encontraron movimientos registrados en Kardex para esta venta.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {sale.inventoryMovements?.map((m) => (
                        <div
                          key={m.id}
                          style={{
                            padding: 12,
                            borderRadius: 10,
                            border: '1.5px solid #cbd5e1',
                            background: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            fontSize: 12,
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <strong style={{ color: 'var(--navy)' }}>{m.movementNumber}</strong>
                              <span className="custom-badge badge-red">{m.type}</span>
                            </div>
                            <span style={{ color: 'var(--muted)', marginTop: 2, display: 'block' }}>
                              {m.productName} ({m.sku}) • {formatDate(m.createdAt)}
                            </span>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <strong style={{ color: 'var(--red)', fontSize: 13 }}>
                              -{m.quantityOut} unidades
                            </strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: AUDITORÍA */}
              {activeTab === 'audit' && (
                <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sale.auditLogs?.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                      Sin registros de auditoría adicionales.
                    </div>
                  ) : (
                    sale.auditLogs?.map((log) => (
                      <div
                        key={log.id}
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          border: '1.5px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <strong style={{ color: 'var(--navy)' }}>{log.action}</strong>
                          <span style={{ color: 'var(--muted)', fontSize: 11 }}>{formatDate(log.timestamp)}</span>
                        </div>
                        <p style={{ margin: 0, color: '#334155' }}>{log.details}</p>
                        <small style={{ color: 'var(--muted)', display: 'block', marginTop: 4 }}>
                          Usuario: {log.user}
                        </small>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="drawer-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {sale && sale.status !== 'CANCELLED' && (
              <button
                type="button"
                className="outline-button"
                style={{ color: 'var(--red)', borderColor: 'rgba(254, 17, 12, 0.3)' }}
                onClick={() => onCancelSale(sale)}
              >
                <AppIcon name="close" size={14} /> Anular Venta
              </button>
            )}
          </div>

          <button type="button" className="primary-button" onClick={onClose}>
            Cerrar Detalle
          </button>
        </div>
      </div>
    </>
  )
}
