'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { PurchaseReceipt, UserPermissionContext } from '../types'
import { purchaseService } from '../services/purchase.service'

interface ReceiptsPageProps {
  onNavigate?: (view: string) => void
  userContext?: UserPermissionContext
}

export function ReceiptsPage({ onNavigate, userContext }: ReceiptsPageProps) {
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseReceipt | null>(null)

  const fetchReceipts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await purchaseService.getReceipts(undefined, userContext)
      setReceipts(data)
    } catch (err: any) {
      setError(err.message || 'Error al cargar el historial de recepciones.')
    } finally {
      setLoading(false)
    }
  }, [userContext])

  useEffect(() => {
    fetchReceipts()
  }, [fetchReceipts])

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—'
    const d = new Date(isoString)
    return d.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const filteredReceipts = receipts.filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      r.receptionNumber.toLowerCase().includes(q) ||
      (r.supplierRemissionNumber && r.supplierRemissionNumber.toLowerCase().includes(q)) ||
      (r.receivedByUserName && r.receivedByUserName.toLowerCase().includes(q)) ||
      (r.notes && r.notes.toLowerCase().includes(q)) ||
      r.purchaseId.toLowerCase().includes(q)
    )
  })

  return (
    <div className="purchases-page-container" style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #1e3a8a, #0284c7)',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
              }}
            >
              <AppIcon name="warehouse" size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--navy)' }}>
                Recepciones de Mercancía
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                Historial de actas de recepción física e ingresos al inventario / Kardex
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="outline-button"
            onClick={fetchReceipts}
            title="Refrescar lista"
          >
            <AppIcon name="refresh" size={15} />
            <span>Refrescar</span>
          </button>

          {onNavigate && (
            <button
              type="button"
              className="primary-button"
              onClick={() => onNavigate('/compras')}
              title="Ir a órdenes de compra"
            >
              <AppIcon name="purchases" size={15} />
              <span>Ver Órdenes</span>
            </button>
          )}
        </div>
      </div>

      {/* Search / Filter toolbar */}
      <div
        className="kardex-filters-panel"
        style={{
          padding: 16,
          marginBottom: 20,
          background: '#fff',
          borderRadius: 12,
          border: '1px solid var(--border)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted)',
            }}
          >
            <AppIcon name="search" size={16} />
          </span>
          <input
            type="text"
            className="filter-input-text"
            placeholder="Buscar por acta, remisión de proveedor o responsable..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 38, width: '100%', height: 38, borderRadius: 8 }}
          />
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 'auto' }}>
          Total actas registradas: <strong>{filteredReceipts.length}</strong>
        </div>
      </div>

      {/* Main Table or States */}
      {loading ? (
        <div
          style={{
            padding: 60,
            textAlign: 'center',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>Cargando actas de recepción...</div>
        </div>
      ) : error ? (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #fecaca',
            color: '#dc2626',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>{error}</p>
          <button
            type="button"
            className="outline-button"
            style={{ marginTop: 12 }}
            onClick={fetchReceipts}
          >
            Reintentar
          </button>
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div
          style={{
            padding: '60px 24px',
            textAlign: 'center',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid var(--border)',
            color: 'var(--muted)',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 12px',
            }}
          >
            <AppIcon name="warehouse" size={26} />
          </div>
          <h3 style={{ fontSize: 16, color: 'var(--navy)', margin: '0 0 6px' }}>
            No hay recepciones registradas
          </h3>
          <p style={{ margin: 0, fontSize: 13, maxWidth: 450, marginInline: 'auto' }}>
            Las actas de recepción física se generan automáticamente cuando confirmas el ingreso parcial o total de una orden de compra en bodega.
          </p>
        </div>
      ) : (
        <div className="table-panel products-table-panel page-enter">
          <div className="table-scroll" tabIndex={0} aria-label="Tabla de recepciones de mercancía">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 140 }}>N° Acta</th>
                  <th style={{ minWidth: 150 }}>Fecha Recepción</th>
                  <th style={{ minWidth: 150 }}>Remisión Proveedor</th>
                  <th style={{ minWidth: 100, textAlign: 'center' }}>Líneas</th>
                  <th style={{ minWidth: 160 }}>Responsable</th>
                  <th style={{ minWidth: 220 }}>Observaciones</th>
                  <th style={{ width: 120, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((rec) => {
                  const totalUnits = rec.items?.reduce((acc, i) => acc + (i.quantityReceived || 0), 0) || 0

                  return (
                    <tr
                      key={rec.id}
                      className="table-row-clickable"
                      onClick={() => setSelectedReceipt(rec)}
                    >
                      <td className="product-code-col">
                        <span className="sku-badge" style={{ fontWeight: 700 }}>
                          {rec.receptionNumber}
                        </span>
                      </td>

                      <td>
                        <span className="product-date-cell">{formatDate(rec.receptionDate)}</span>
                      </td>

                      <td>
                        <span className="secondary-meta" style={{ fontWeight: 600 }}>
                          {rec.supplierRemissionNumber || '—'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className="kardex-type-badge type-badge-blue">
                          {rec.items?.length || 0} ítems ({totalUnits} u.)
                        </span>
                      </td>

                      <td>
                        <span className="secondary-meta" style={{ fontSize: 12 }}>
                          {rec.receivedByUserName || 'Almacenista'}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--muted)',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {rec.notes || '—'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="icon-button inspect-row-btn"
                          onClick={() => setSelectedReceipt(rec)}
                          title="Ver detalle del acta de recepción"
                          aria-label="Ver detalle"
                        >
                          <AppIcon name="eye" size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Detalle de Acta de Recepción */}
      {selectedReceipt && (
        <div
          className="drawer-backdrop"
          onClick={() => setSelectedReceipt(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="product-drawer product-detail-drawer page-enter"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 650, width: '92vw' }}
          >
            <div className="drawer-header product-detail-header-v2">
              <div className="product-detail-hero-layout">
                <div
                  className="stat-icon blue"
                  style={{ width: 44, height: 44, borderRadius: 12 }}
                >
                  <AppIcon name="warehouse" size={24} />
                </div>
                <div className="product-detail-header-info">
                  <span className="product-category-eyebrow">
                    Acta de Recepción Física
                  </span>
                  <h2 className="product-detail-title-v2" style={{ fontSize: 18 }}>
                    {selectedReceipt.receptionNumber}
                  </h2>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    Registrada el: {formatDate(selectedReceipt.receptionDate)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setSelectedReceipt(null)}
                aria-label="Cerrar detalle"
              >
                <AppIcon name="close" size={18} />
              </button>
            </div>

            <div className="drawer-body" style={{ padding: 24, overflowY: 'auto' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12,
                  marginBottom: 20,
                  background: '#f8fafc',
                  padding: 16,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Orden de Compra / Proveedor</div>
                  <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
                    {selectedReceipt.purchaseNumber || 'Compra'} — {selectedReceipt.supplierName || 'Proveedor'}
                  </strong>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Bodega de Ingreso</div>
                  <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
                    {selectedReceipt.locationName || 'Bodega'} ({selectedReceipt.locationCode || 'BOD'})
                  </strong>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Remisión de Proveedor</div>
                  <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
                    {selectedReceipt.supplierRemissionNumber || 'No especificada'}
                  </strong>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Recibido por</div>
                  <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
                    {selectedReceipt.receivedByUserName || 'Almacenista'}
                  </strong>
                </div>
                {selectedReceipt.notes && (
                  <div style={{ gridColumn: 'span 2', marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Notas de Entrega</div>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--foreground)' }}>
                      {selectedReceipt.notes}
                    </p>
                  </div>
                )}
              </div>

              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--navy)' }}>
                Mercancía Ingresada al Inventario
              </h3>

              <div
                className="table-responsive"
                style={{ border: '1px solid var(--border)', borderRadius: 8 }}
              >
                <table className="products-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="numeric" style={{ textAlign: 'right' }}>
                        Cantidad Recibida
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReceipt.items?.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td>
                          <strong>{item.productName || `Línea de Compra #${idx + 1}`}</strong>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {item.sku ? `SKU: ${item.sku}` : `ID Ítem: ${item.purchaseItemId}`}
                          </div>
                        </td>
                        <td className="numeric font-tabular" style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              color: '#16a34a',
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            +{item.quantityReceived} u.
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="drawer-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                className="outline-button"
                onClick={() => setSelectedReceipt(null)}
                style={{ width: '100%' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
