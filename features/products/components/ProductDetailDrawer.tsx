'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { ScrollableTabs } from '@/components/ui/ScrollableTabs'
import {
  Product,
  ProductMovementSummary,
  UserPermissionContext,
} from '../types'
import { productService } from '../services/product.service'

interface ProductDetailDrawerProps {
  product: Product | null
  isOpen: boolean
  isCostRedacted: boolean
  userContext?: UserPermissionContext
  onClose: () => void
  onEdit: (product: Product) => void
  onViewKardex: (product: Product) => void
  onTransfer: (product: Product) => void
  onAdjustStock: (product: Product) => void
}

export function ProductDetailDrawer({
  product,
  isOpen,
  isCostRedacted,
  userContext,
  onClose,
  onEdit,
  onViewKardex,
  onTransfer,
  onAdjustStock,
}: ProductDetailDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary' | 'inventory' | 'prices' | 'movements' | 'web'>('summary')
  const [movements, setMovements] = useState<ProductMovementSummary[]>([])
  const [loadingMovements, setLoadingMovements] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen && product) {
      setActiveTab('summary')
      setLoadingMovements(true)
      productService
        .getProductMovements(product.id)
        .then(setMovements)
        .finally(() => setLoadingMovements(false))
    }
  }, [isOpen, product])

  if (!isOpen || !product || !mounted) return null

  const canEdit = !userContext || userContext.userRole === 'ADMIN' || userContext.permissions.includes('product.update')

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
              {product.imageUrl ? (
                <div className="product-detail-image-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.imageUrl}
                    alt={product.name}
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
              <span className="product-category-eyebrow">{product.category}</span>
              <h2 className="product-title-heading">{product.name}</h2>
              <div className="detail-badges-row">
                <span className="code-badge">{product.sku}</span>
                {product.barcode && (
                  <span className="barcode-text">{product.barcode}</span>
                )}
                <span
                  className={`status-indicator-pill ${
                    product.status === 'ACTIVE' ? 'active' : 'inactive'
                  }`}
                >
                  {product.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </span>
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

        {/* Tab Navigation */}
        <ScrollableTabs>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'summary'}
            className={activeTab === 'summary' ? 'active' : ''}
            onClick={() => setActiveTab('summary')}
          >
            <AppIcon name="products" size={14} />
            <span>Resumen</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'inventory'}
            className={activeTab === 'inventory' ? 'active' : ''}
            onClick={() => setActiveTab('inventory')}
          >
            <AppIcon name="warehouse" size={14} />
            <span>Inventario</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'prices'}
            className={activeTab === 'prices' ? 'active' : ''}
            onClick={() => setActiveTab('prices')}
          >
            <AppIcon name="sales" size={14} />
            <span>Precios</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'movements'}
            className={activeTab === 'movements' ? 'active' : ''}
            onClick={() => setActiveTab('movements')}
          >
            <AppIcon name="kardex" size={14} />
            <span>Movimientos</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'web'}
            className={activeTab === 'web' ? 'active' : ''}
            onClick={() => setActiveTab('web')}
          >
            <AppIcon name="webOrders" size={14} />
            <span>Web</span>
          </button>
        </ScrollableTabs>

        {/* TAB 1: RESUMEN */}
        {activeTab === 'summary' && (
          <div className="detail-tab-body page-enter">
            {/* Quick Metrics Grid */}
            <div className="price-grid detail-kpi-grid">
              <div>
                <span>Stock Total</span>
                <strong style={{ fontSize: 20 }}>
                  {product.totalStock} {product.unitOfMeasure}s
                </strong>
                <small className="field-hint">
                  {product.availableUnits} disponibles para despacho
                </small>
              </div>

              <div>
                <span>Precio Normal (Público)</span>
                <strong style={{ fontSize: 20, color: 'var(--navy)' }}>
                  {productService.formatCurrency(product.normalPrice)}
                </strong>
                <small className="field-hint">
                  Mayorista: {productService.formatCurrency(product.wholesalePrice)}
                </small>
              </div>

              <div>
                <span>Costo Promedio (RBAC)</span>
                {isCostRedacted ? (
                  <span className="redacted-pill">••••••••</span>
                ) : (
                  <strong style={{ fontSize: 18 }}>
                    {productService.formatCurrency(product.averageCost)}
                  </strong>
                )}
                <small className="field-hint">Ponderado todas las bodegas</small>
              </div>

              <div>
                <span>Margen de Utilidad (RBAC)</span>
                {isCostRedacted ? (
                  <span className="redacted-pill">••••</span>
                ) : (
                  <strong
                    style={{
                      fontSize: 18,
                      color:
                        product.profitMarginPercent >= 20
                          ? 'var(--green)'
                          : 'var(--amber)',
                    }}
                  >
                    {product.profitMarginPercent.toFixed(1)}% (
                    {productService.formatCurrency(product.profitMarginAmount)})
                  </strong>
                )}
                <small className="field-hint">Antes de IVA</small>
              </div>
            </div>

            {/* Specifications Card */}
            <div className="drawer-section">
              <h3>Ficha Técnica</h3>
              <div className="info-list">
                <p>
                  <span>Marca:</span>
                  <b>{product.brand}</b>
                </p>
                <p>
                  <span>Categoría:</span>
                  <b>{product.category}</b>
                </p>
                <p>
                  <span>Unidad de Medida:</span>
                  <b>{product.unitOfMeasure}</b>
                </p>
                <p>
                  <span>Régimen de IVA:</span>
                  <b>
                    {product.taxProfile} ({product.vatRatePercent}%)
                  </b>
                </p>
                {product.description && (
                  <div style={{ marginTop: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                      Descripción:
                    </span>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
                      {product.description}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Web Publication Status */}
            <div className="drawer-section">
              <h3>Canales Digitales Activos</h3>
              <div className="detail-web-channels-preview">
                <div className={`web-badge-box ${product.webSuperMas ? 'active' : ''}`}>
                  <AppIcon name={product.webSuperMas ? 'check' : 'close'} size={14} />
                  <div>
                    <strong>Catálogo Super Más</strong>
                    <small>{product.webSuperMas ? 'Compra directa web habilitada' : 'No publicado'}</small>
                  </div>
                </div>

                <div className={`web-badge-box ${product.webDistribuidora ? 'active' : ''}`}>
                  <AppIcon name={product.webDistribuidora ? 'check' : 'close'} size={14} />
                  <div>
                    <strong>Catálogo Distribuidora</strong>
                    <small>{product.webDistribuidora ? 'Contacto WhatsApp activo' : 'No publicado'}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INVENTARIO POR BODEGA CON BARRAS DE DISTRIBUCIÓN */}
        {activeTab === 'inventory' && (
          <div className="detail-tab-body page-enter">
            <div className="info-banner-compact">
              <AppIcon name="warehouse" size={16} />
              <span>
                <strong>Regla Crítica:</strong> El stock nunca se edita directamente.
                Usa <em>Transferir</em> o <em>Ajustar inventario</em> para generar movimientos de Kardex.
              </span>
            </div>

            {/* Distribution percentage bars */}
            <div className="drawer-section">
              <h3>Distribución de Stock por Bodega</h3>
              <div className="warehouse-distribution-list">
                {product.warehouseStock.map((wh) => (
                  <div key={wh.locationId} className="distribution">
                    <div className="distribution-info-head">
                      <div>
                        <strong>{wh.locationName}</strong>
                        <span className="code-badge">{wh.locationCode}</span>
                      </div>
                      <b>
                        {wh.quantity} uds ({wh.percentageOfTotalStock}%)
                      </b>
                    </div>
                    <div className="distribution-bar">
                      <i style={{ width: `${wh.percentageOfTotalStock}%` }} />
                    </div>
                    <div className="distribution-subtext-row">
                      <span>Mín: {wh.minStock} | Crítico: {wh.criticalStock}</span>
                      <span className={`state ${wh.stockHealth.toLowerCase().replace('_', '-')}`}>
                        {wh.stockHealth === 'AVAILABLE'
                          ? 'Óptimo'
                          : wh.stockHealth === 'LOW_STOCK'
                          ? 'Stock bajo'
                          : wh.stockHealth === 'CRITICAL'
                          ? 'Crítico'
                          : 'Agotado'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons inside inventory */}
            <div className="inventory-actions-row">
              <button
                type="button"
                className="outline-button"
                onClick={() => onTransfer(product)}
              >
                <AppIcon name="transfers" size={15} />
                <span>Transferir mercancía</span>
              </button>

              <button
                type="button"
                className="outline-button"
                onClick={() => onAdjustStock(product)}
              >
                <AppIcon name="inventory" size={15} />
                <span>Ajustar inventario</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: PRECIOS Y MÁRGENES */}
        {activeTab === 'prices' && (
          <div className="detail-tab-body page-enter">
            <div className="drawer-section">
              <h3>Listas de Precios Vigentes</h3>
              <div className="price-tiers-table">
                {product.prices.map((tier) => (
                  <div key={tier.id} className="price-tier-row">
                    <div>
                      <strong>{tier.name}</strong>
                      <small>Desde {tier.minQuantity || 1} unidades</small>
                    </div>
                    <strong className="price-primary">
                      {productService.formatCurrency(tier.price)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="drawer-section">
              <h3>Desglose Tributario y Margen</h3>
              <div className="info-list">
                <p>
                  <span>Precio de venta con IVA:</span>
                  <b>{productService.formatCurrency(product.normalPrice)}</b>
                </p>
                <p>
                  <span>Tarifa de IVA:</span>
                  <b>{product.vatRatePercent}%</b>
                </p>
                <p>
                  <span>Precio base sin IVA:</span>
                  <b>
                    {productService.formatCurrency(
                      product.normalPrice / (1 + product.vatRatePercent / 100)
                    )}
                  </b>
                </p>
                <p>
                  <span>Costo promedio:</span>
                  {isCostRedacted ? (
                    <span className="redacted-pill">••••••••</span>
                  ) : (
                    <b>{productService.formatCurrency(product.averageCost)}</b>
                  )}
                </p>
                <p>
                  <span>Utilidad bruta unitaria:</span>
                  {isCostRedacted ? (
                    <span className="redacted-pill">••••••••</span>
                  ) : (
                    <b className="positive-text">
                      {productService.formatCurrency(product.profitMarginAmount)}
                    </b>
                  )}
                </p>
                <p>
                  <span>Margen de rentabilidad:</span>
                  {isCostRedacted ? (
                    <span className="redacted-pill">••••</span>
                  ) : (
                    <b className="positive-text">{product.profitMarginPercent.toFixed(1)}%</b>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MOVIMIENTOS KARDEX */}
        {activeTab === 'movements' && (
          <div className="detail-tab-body page-enter">
            <div className="drawer-section">
              <div className="section-header-compact">
                <h3>Últimos Movimientos de Kardex</h3>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onViewKardex(product)}
                >
                  Ver Kardex completo →
                </button>
              </div>

              {loadingMovements ? (
                <div className="drawer-empty">
                  <AppIcon name="kardex" size={24} />
                  <p>Cargando movimientos...</p>
                </div>
              ) : movements.length === 0 ? (
                <div className="drawer-empty">
                  <AppIcon name="kardex" size={28} />
                  <p>No hay movimientos registrados para este producto.</p>
                </div>
              ) : (
                <div className="kardex-mini-list">
                  {movements.map((mov) => (
                    <div key={mov.id} className="kardex-mini-item">
                      <div className="kardex-mini-head">
                        <span
                          className={`movement-badge ${mov.type
                            .toLowerCase()
                            .replace('_', '-')}`}
                        >
                          {mov.type}
                        </span>
                        <time>{new Date(mov.timestamp).toLocaleDateString()}</time>
                      </div>
                      <div className="kardex-mini-details">
                        <span>
                          <strong>{mov.quantity} uds</strong> en {mov.locationName}
                        </span>
                        <small>Doc: {mov.documentRef} · Por: {mov.userName}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: CANALES WEB */}
        {activeTab === 'web' && (
          <div className="detail-tab-body page-enter">
            <div className="drawer-section">
              <h3>Disponibilidad Pública Calculada</h3>
              <div className="web-public-preview-card">
                <div className="web-public-header">
                  <div>
                    <span className="eyebrow">Vista de cliente final</span>
                    <h4>Disponibilidad en vitrinas públicas</h4>
                  </div>
                  <span
                    className={`state ${
                      product.webAvailability === 'AVAILABLE'
                        ? 'disponible'
                        : product.webAvailability === 'LOW_STOCK'
                        ? 'stock-bajo'
                        : 'agotado'
                    }`}
                  >
                    {product.webAvailability === 'AVAILABLE'
                      ? 'Disponible'
                      : product.webAvailability === 'LOW_STOCK'
                      ? 'Pocas unidades'
                      : 'Agotado'}
                  </span>
                </div>

                <div className="web-security-guarantee">
                  <AppIcon name="audit" size={16} />
                  <span>
                    <strong>Garantía de Privacidad:</strong> La vitrina digital consulta el
                    inventario agregado de todas las bodegas activas. Nunca se publica el
                    stock exacto, costos, márgenes ni nombres de proveedores.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Drawer Footer Actions */}
        <div className="dialog-footer detail-drawer-footer">
          <button
            type="button"
            className="outline-button"
            onClick={() => onViewKardex(product)}
          >
            <AppIcon name="kardex" size={15} />
            <span>Kardex</span>
          </button>

          {canEdit && (
            <button
              type="button"
              className="primary-button"
              onClick={() => onEdit(product)}
            >
              <AppIcon name="edit" size={15} />
              <span>Editar producto</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
