'use client'

import React from 'react'
import Image from 'next/image'
import { AppIcon } from '@/components/ui/Icon'
import { ConsolidatedProductStock } from '../types'
import { inventoryService } from '../services/inventory.service'

interface InventoryProductDrawerProps {
  product: ConsolidatedProductStock | null
  isOpen: boolean
  canSeeCost: boolean
  onClose: () => void
  onOpenAdjust: (productId: string, locationId?: string) => void
  onOpenTransfer: (productId: string, originLocationId?: string) => void
  onOpenKardex: (productId: string) => void
}

export function InventoryProductDrawer({
  product,
  isOpen,
  canSeeCost,
  onClose,
  onOpenAdjust,
  onOpenTransfer,
  onOpenKardex,
}: InventoryProductDrawerProps) {
  if (!isOpen || !product) return null

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="product-drawer inventory-detail-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Detalle de existencias del producto"
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div>
            <span className="drawer-eyebrow">Detalle de existencias</span>
            <h2>{product.productName}</h2>
          </div>
          <button
            type="button"
            className="icon-button close-drawer-btn"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>

        {/* Product Identity Banner */}
        <div className="drawer-product-banner">
          <div className="drawer-product-avatar">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.productName}
                width={56}
                height={56}
                className="drawer-avatar-img"
                unoptimized
              />
            ) : (
              <AppIcon name="products" size={24} color="var(--navy)" />
            )}
          </div>
          <div className="drawer-product-meta">
            <strong>{product.productName}</strong>
            <span>
              SKU: <b className="mono">{product.sku}</b> · {product.brand}
            </span>
            <small className="category-pill">{product.category}</small>
          </div>
        </div>

        {/* Consolidated Stock Highlight */}
        <div className="drawer-stock-summary-card">
          <div className="summary-col">
            <span>Existencia total consolidada</span>
            <strong className="lead-stock-number">
              {product.totalStock.toLocaleString('es-CO')}
              <small> {product.unitOfMeasure}</small>
            </strong>
          </div>
          {canSeeCost && (
            <div className="summary-col text-right">
              <span>Valor total a costo</span>
              <strong className="lead-value-number">
                {inventoryService.formatCOP(product.totalValueAtCost)}
              </strong>
            </div>
          )}
        </div>

        {/* Availability per Warehouse */}
        <div className="drawer-section">
          <div className="drawer-section-title">
            <AppIcon name="warehouses" size={15} color="var(--navy)" />
            <h3>Disponibilidad por bodega</h3>
          </div>

          <div className="drawer-warehouse-distribution-list">
            {product.locationBreakdown.map((loc) => {
              const maxStock = Math.max(product.totalStock, 1)
              const pct = ((loc.stock / maxStock) * 100).toFixed(0)

              return (
                <div key={loc.locationId} className="drawer-loc-row">
                  <div className="loc-row-top">
                    <div className="loc-name-group">
                      <strong>{loc.locationName}</strong>
                      <span className="code-badge">{loc.locationCode}</span>
                    </div>
                    <div className="loc-stock-badge-wrap">
                      <strong className="loc-stock-qty">
                        {loc.stock.toLocaleString('es-CO')} uds
                      </strong>
                    </div>
                  </div>

                  {/* Distribution Progress Bar */}
                  <div className="loc-progress-bar">
                    <div className="progress-track">
                      <i
                        className="progress-fill"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            loc.health === 'CRITICAL' || loc.health === 'OUT_OF_STOCK'
                              ? 'var(--red)'
                              : loc.health === 'LOW_STOCK'
                              ? 'var(--amber)'
                              : 'var(--navy)',
                        }}
                      />
                    </div>
                    <span className="progress-pct">{pct}%</span>
                  </div>

                  <div className="loc-row-footer">
                    <span>
                      Mínimo: <b>{loc.minStock}</b> · Crítico: <b>{loc.criticalStock}</b>
                    </span>
                    {canSeeCost && (
                      <span className="loc-val">
                        {inventoryService.formatCOP(loc.valueAtCost, true)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Last Movement Quick Audit */}
        <div className="drawer-section">
          <div className="drawer-section-title">
            <AppIcon name="kardex" size={15} color="var(--navy)" />
            <h3>Última actividad registrada</h3>
          </div>

          <div className="drawer-movement-box">
            <div className="movement-box-header">
              <span className="state disponible">
                <AppIcon name="check" size={11} />
                <span>{product.lastMovementType || 'MOVIMIENTO'}</span>
              </span>
              <span className="mono">{product.lastMovementDoc || 'N/A'}</span>
            </div>
            <p className="movement-box-date">
              Fecha:{' '}
              {product.lastMovementAt
                ? new Date(product.lastMovementAt).toLocaleString('es-CO')
                : 'Sin registros recientes'}
            </p>
          </div>
        </div>

        {/* Action Shortcuts */}
        <div className="drawer-actions-footer">
          <button
            type="button"
            className="outline-button compact"
            onClick={() => onOpenKardex(product.productId)}
          >
            <AppIcon name="kardex" size={14} />
            <span>Ver Kardex</span>
          </button>

          <button
            type="button"
            className="outline-button compact"
            onClick={() => onOpenTransfer(product.productId)}
          >
            <AppIcon name="transfers" size={14} />
            <span>Transferir</span>
          </button>

          <button
            type="button"
            className="primary-button compact"
            onClick={() => onOpenAdjust(product.productId)}
          >
            <AppIcon name="sliders" size={14} />
            <span>Ajustar inventario</span>
          </button>
        </div>
      </aside>
    </div>
  )
}
