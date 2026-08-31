'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { InventoryMovement, UserPermissionContext } from '../types'
import { getMovementTypeBadge } from './KardexTable'

interface KardexDetailDrawerProps {
  movement: InventoryMovement | null
  isOpen: boolean
  isCostRedacted: boolean
  userContext?: UserPermissionContext
  onClose: () => void
  onNavigateDocument?: (docType: string, docNumber: string) => void
  onOpenRevertModal?: (movement: InventoryMovement) => void
}

export function KardexDetailDrawer({
  movement,
  isOpen,
  isCostRedacted,
  userContext,
  onClose,
  onNavigateDocument,
  onOpenRevertModal,
}: KardexDetailDrawerProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !movement || !mounted) return null

  const isEntry = movement.quantityIn > 0
  const deltaQty = isEntry ? movement.quantityIn : movement.quantityOut
  const canRevert =
    !userContext ||
    userContext.userRole === 'ADMIN' ||
    userContext.permissions.includes('kardex.revert')

  const formatFullDate = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }

  // Stock variation calculation
  const maxStockReference = Math.max(
    movement.previousStock,
    movement.resultingStock,
    1
  )
  const resultPct = Math.min(100, Math.round((movement.resultingStock / maxStockReference) * 100))

  return createPortal(
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="product-drawer product-detail-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="drawer-header product-detail-header-v2">
          <div className="product-detail-hero-layout">
            <div className="product-detail-avatar-container">
              {movement.imageUrl ? (
                <div className="product-detail-image-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={movement.imageUrl}
                    alt={movement.productName}
                    className="product-detail-img-element"
                  />
                </div>
              ) : (
                <div className="product-detail-fallback-avatar">
                  <AppIcon name="products" size={28} />
                </div>
              )}
            </div>

            <div className="product-detail-header-info">
              <span className="product-category-eyebrow">
                Auditoría Kardex · {movement.movementNumber}
              </span>
              <h2 className="product-title-heading">{movement.productName}</h2>
              <div className="detail-badges-row">
                <span className="code-badge">{movement.sku}</span>
                {getMovementTypeBadge(movement.type)}
                {movement.isReversion && (
                  <span className="status-indicator-pill inactive" style={{ background: '#ede9fe', color: '#6d28d9', borderColor: '#c4b5fd' }}>
                    <AppIcon name="refresh" size={12} /> Revertido
                  </span>
                )}
              </div>
            </div>
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

        {/* Drawer Body Sections */}
        <div className="detail-tab-body" style={{ paddingTop: 18 }}>
          {/* SECTION 1: DETALLE DEL MOVIMIENTO */}
          <div className="drawer-section" style={{ padding: '0 0 16px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--navy)' }}>
              1. Información General
            </h4>
            <div className="info-list-grid">
              <div className="info-kv-item">
                <span>Tipo de movimiento:</span>
                <strong>{movement.type}</strong>
              </div>

              <div className="info-kv-item">
                <span>Fecha y hora exacta:</span>
                <strong>{formatFullDate(movement.createdAt)}</strong>
              </div>

              <div className="info-kv-item">
                <span>Producto:</span>
                <strong>{movement.productName}</strong>
              </div>

              <div className="info-kv-item">
                <span>SKU / Categoría:</span>
                <strong>{movement.sku} · {movement.category}</strong>
              </div>

              <div className="info-kv-item">
                <span>Bodega de operación:</span>
                <strong>
                  {movement.locationName} ({movement.locationCode})
                </strong>
              </div>

              {movement.destinationLocationName && (
                <div className="info-kv-item">
                  <span>Bodega destino (Transferencia):</span>
                  <strong style={{ color: 'var(--navy)' }}>{movement.destinationLocationName}</strong>
                </div>
              )}

              {movement.originLocationName && (
                <div className="info-kv-item">
                  <span>Bodega origen (Transferencia):</span>
                  <strong style={{ color: 'var(--navy)' }}>{movement.originLocationName}</strong>
                </div>
              )}

              <div className="info-kv-item">
                <span>Usuario responsable:</span>
                <strong>
                  {movement.userName} ({movement.userRole})
                </strong>
              </div>

              <div className="info-kv-item">
                <span>Unidad de medida:</span>
                <strong>{movement.unitOfMeasure}</strong>
              </div>
            </div>
          </div>

          {/* SECTION 2: INVENTARIO Y CANTIDADES */}
          <div className="drawer-section">
            <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--navy)' }}>
              2. Inventario y Variación de Stock
            </h4>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div className="stat-card" style={{ minHeight: 90, padding: 12 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Saldo anterior</span>
                <strong style={{ fontSize: 18 }}>
                  {movement.previousStock} {movement.unitOfMeasure}
                </strong>
              </div>

              <div className="stat-card" style={{ minHeight: 90, padding: 12 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                  {isEntry ? 'Entrada (+)' : 'Salida (-)'}
                </span>
                <strong
                  style={{
                    fontSize: 18,
                    color: isEntry ? 'var(--green)' : 'var(--red)',
                  }}
                >
                  {isEntry ? `+${movement.quantityIn}` : `-${movement.quantityOut}`} {movement.unitOfMeasure}
                </strong>
              </div>

              <div className="stat-card" style={{ minHeight: 90, padding: 12, borderColor: 'var(--navy)' }}>
                <span style={{ fontSize: 10, color: 'var(--navy)', fontWeight: 700 }}>
                  Saldo resultante
                </span>
                <strong style={{ fontSize: 18, color: 'var(--navy)' }}>
                  {movement.resultingStock} {movement.unitOfMeasure}
                </strong>
              </div>
            </div>

            {/* Visual Balance Progression */}
            <div className="balance-bar-visual" style={{ marginTop: 14 }}>
              <div className="distribution-info-head">
                <span>Flujo de existencia:</span>
                <small>
                  {movement.previousStock} → <strong>{isEntry ? `+${deltaQty}` : `-${deltaQty}`}</strong> → <strong>{movement.resultingStock} {movement.unitOfMeasure}s</strong>
                </small>
              </div>
              <div className="distribution-bar" style={{ height: 9 }}>
                <i
                  style={{
                    width: `${resultPct}%`,
                    background: isEntry
                      ? 'linear-gradient(90deg, #159a67, #34d399)'
                      : 'linear-gradient(90deg, #001b5c, #e02424)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: COSTOS Y VALORIZACIÓN (RBAC) */}
          <div className="drawer-section">
            <div className="panel-heading" style={{ marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 13, color: 'var(--navy)' }}>3. Costos y Valorización</h4>
              {isCostRedacted && (
                <span className="redacted-pill">
                  <AppIcon name="lock" size={12} /> Confidencial RBAC
                </span>
              )}
            </div>

            <div className="price-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div className="margin-preview-card" style={{ padding: 10 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Costo unitario</span>
                <strong style={{ fontSize: 14 }}>
                  {isCostRedacted ? '••••••••' : `$${movement.unitCost.toLocaleString('es-CO')}`}
                </strong>
              </div>

              <div className="margin-preview-card" style={{ padding: 10 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Costo promedio post</span>
                <strong style={{ fontSize: 14 }}>
                  {isCostRedacted ? '••••••••' : `$${movement.averageCostAfter.toLocaleString('es-CO')}`}
                </strong>
              </div>

              <div className="margin-preview-card" style={{ padding: 10, borderColor: '#001b5c33' }}>
                <span style={{ fontSize: 10, color: 'var(--navy)', fontWeight: 700 }}>
                  Valor total
                </span>
                <strong style={{ fontSize: 14, color: 'var(--navy)' }}>
                  {isCostRedacted ? '••••••••' : `$${movement.totalValue.toLocaleString('es-CO')}`}
                </strong>
              </div>
            </div>
          </div>

          {/* SECTION 4: DOCUMENTO ORIGEN */}
          <div className="drawer-section" style={{ borderBottom: 0 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--navy)' }}>4. Documento Origen</h4>

            <div className="doc-origin-card">
              <div className="doc-origin-head">
                <div className="stat-icon blue" style={{ width: 34, height: 34 }}>
                  <AppIcon name="fileText" size={18} />
                </div>
                <div>
                  <strong className="doc-number-highlight">
                    {movement.sourceDocumentNumber}
                  </strong>
                  <span className="doc-type-text">{movement.sourceDocumentType}</span>
                </div>

                {onNavigateDocument && (
                  <button
                    type="button"
                    className="outline-button browse-doc-btn"
                    onClick={() =>
                      onNavigateDocument(
                        movement.sourceDocumentType,
                        movement.sourceDocumentNumber
                      )
                    }
                  >
                    <span>Ver documento origen</span>
                    <AppIcon name="chevronRight" size={13} />
                  </button>
                )}
              </div>

              {movement.notes && (
                <div className="doc-notes-box">
                  <strong>Observaciones / Justificación:</strong>
                  <p>{movement.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="detail-drawer-footer" style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <button
            type="button"
            className="outline-button"
            onClick={onClose}
          >
            Cerrar
          </button>

          {canRevert && !movement.isReversion && onOpenRevertModal && (
            <button
              type="button"
              className="danger-button"
              onClick={() => onOpenRevertModal(movement)}
            >
              <AppIcon name="refresh" size={14} />
              <span>Revertir movimiento</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
