'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { AppIcon } from '@/components/ui/Icon'
import {
  ConsolidatedProductStock,
  InventoryStockLevel,
  InventoryViewMode,
  InventorySortField,
  InventoryColumnVisibility,
  StockHealthStatus,
} from '../types'
import { inventoryService } from '../services/inventory.service'

interface InventoryTableProps {
  viewMode: InventoryViewMode
  consolidatedData: ConsolidatedProductStock[]
  byLocationData: InventoryStockLevel[]
  totalRecords: number
  page: number
  pageSize: number
  sortField: InventorySortField
  sortDirection: 'asc' | 'desc'
  visibility: InventoryColumnVisibility
  canSeeCost: boolean
  isLoading: boolean
  onPageChange: (newPage: number) => void
  onPageSizeChange: (newSize: number) => void
  onSortChange: (field: InventorySortField) => void
  onSelectProduct: (productId: string) => void
  onOpenAdjust: (productId: string, locationId?: string) => void
  onOpenTransfer: (productId: string, originLocationId?: string) => void
  onOpenKardex: (productId: string, locationId?: string) => void
}

export function InventoryTable({
  viewMode,
  consolidatedData,
  byLocationData,
  totalRecords,
  page,
  pageSize,
  sortField,
  sortDirection,
  visibility,
  canSeeCost,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onSelectProduct,
  onOpenAdjust,
  onOpenTransfer,
  onOpenKardex,
}: InventoryTableProps) {
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set())
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const toggleExpand = (prodId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = new Set(expandedProductIds)
    if (next.has(prodId)) {
      next.delete(prodId)
    } else {
      next.add(prodId)
    }
    setExpandedProductIds(next)
  }

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))

  const renderSortIndicator = (field: InventorySortField) => {
    if (sortField !== field) {
      return <AppIcon name="chevronDown" size={11} color="#94a3b8" />
    }
    return sortDirection === 'asc' ? (
      <AppIcon name="arrowUpRight" size={12} color="var(--navy)" />
    ) : (
      <AppIcon name="arrowDownRight" size={12} color="var(--navy)" />
    )
  }

  const renderHealthBadge = (health: StockHealthStatus, units: number) => {
    switch (health) {
      case 'AVAILABLE':
        return (
          <span className="state disponible" title="Stock saludable y por encima del mínimo">
            <AppIcon name="check" size={12} />
            <span>{units.toLocaleString('es-CO')} uds</span>
          </span>
        )
      case 'LOW_STOCK':
        return (
          <span className="state stock-bajo" title="Stock bajo (por debajo del mínimo)">
            <AppIcon name="warning" size={12} />
            <span>{units.toLocaleString('es-CO')} uds</span>
          </span>
        )
      case 'CRITICAL':
        return (
          <span className="state critico" title="Stock crítico (atención urgente requerida)">
            <AppIcon name="warning" size={12} />
            <span>{units.toLocaleString('es-CO')} uds</span>
          </span>
        )
      case 'OUT_OF_STOCK':
        return (
          <span className="state agotado" title="Producto agotado (0 unidades)">
            <AppIcon name="close" size={12} />
            <span>Agotado</span>
          </span>
        )
      default:
        return <span>{units} uds</span>
    }
  }

  return (
    <div className="table-panel inventory-table-panel">
      <div className="table-scroll">
        <table className="inventory-data-table" aria-label="Tabla de existencias de inventario">
          <thead>
            <tr>
              {/* Expand column in consolidated mode */}
              {viewMode === 'CONSOLIDATED' && (
                <th style={{ width: '40px', textAlign: 'center' }} aria-label="Expandir">
                  #
                </th>
              )}

              {/* Producto */}
              {visibility.product && (
                <th style={{ minWidth: '240px' }}>
                  <button
                    type="button"
                    className="table-sort-btn"
                    onClick={() => onSortChange('productName')}
                  >
                    <span>Producto</span>
                    {renderSortIndicator('productName')}
                  </button>
                </th>
              )}

              {/* SKU */}
              {visibility.sku && (
                <th style={{ minWidth: '120px' }}>
                  <button
                    type="button"
                    className="table-sort-btn"
                    onClick={() => onSortChange('sku')}
                  >
                    <span>SKU</span>
                    {renderSortIndicator('sku')}
                  </button>
                </th>
              )}

              {/* Código de barras */}
              {visibility.barcode && (
                <th style={{ minWidth: '130px' }}>
                  <span>Cód. Barras</span>
                </th>
              )}

              {/* Categoría */}
              {visibility.category && (
                <th style={{ minWidth: '140px' }}>
                  <button
                    type="button"
                    className="table-sort-btn"
                    onClick={() => onSortChange('category')}
                  >
                    <span>Categoría</span>
                    {renderSortIndicator('category')}
                  </button>
                </th>
              )}

              {/* Bodega (solo en modo por bodega) */}
              {visibility.location && viewMode === 'BY_LOCATION' && (
                <th style={{ minWidth: '160px' }}>
                  <button
                    type="button"
                    className="table-sort-btn"
                    onClick={() => onSortChange('locationName')}
                  >
                    <span>Bodega</span>
                    {renderSortIndicator('locationName')}
                  </button>
                </th>
              )}

              {/* Existencia / Stock Total */}
              {visibility.currentStock && (
                <th style={{ minWidth: '130px', textAlign: 'right' }}>
                  <button
                    type="button"
                    className="table-sort-btn"
                    style={{ justifyContent: 'flex-end' }}
                    onClick={() =>
                      onSortChange(viewMode === 'CONSOLIDATED' ? 'totalStock' : 'currentStock')
                    }
                  >
                    <span>{viewMode === 'CONSOLIDATED' ? 'Stock Total' : 'Existencia'}</span>
                    {renderSortIndicator(
                      viewMode === 'CONSOLIDATED' ? 'totalStock' : 'currentStock'
                    )}
                  </button>
                </th>
              )}

              {/* Stock Mínimo */}
              {visibility.minStock && (
                <th style={{ minWidth: '100px', textAlign: 'center' }}>
                  <span>Mínimo</span>
                </th>
              )}

              {/* Stock Crítico */}
              {visibility.criticalStock && (
                <th style={{ minWidth: '100px', textAlign: 'center' }}>
                  <span>Crítico</span>
                </th>
              )}

              {/* Estado */}
              {visibility.status && (
                <th style={{ minWidth: '130px', textAlign: 'center' }}>
                  <button
                    type="button"
                    className="table-sort-btn"
                    style={{ justifyContent: 'center' }}
                    onClick={() => onSortChange('stockHealth')}
                  >
                    <span>Estado</span>
                    {renderSortIndicator('stockHealth')}
                  </button>
                </th>
              )}

              {/* Costo Promedio */}
              {visibility.averageCost && canSeeCost && (
                <th style={{ minWidth: '120px', textAlign: 'right' }}>
                  <span>Costo Unit.</span>
                </th>
              )}

              {/* Valor a Costo */}
              {visibility.totalValue && canSeeCost && (
                <th style={{ minWidth: '130px', textAlign: 'right' }}>
                  <button
                    type="button"
                    className="table-sort-btn"
                    style={{ justifyContent: 'flex-end' }}
                    onClick={() => onSortChange('totalValueAtCost')}
                  >
                    <span>Valor a costo</span>
                    {renderSortIndicator('totalValueAtCost')}
                  </button>
                </th>
              )}

              {/* Último Movimiento */}
              {visibility.lastMovement && (
                <th style={{ minWidth: '150px' }}>
                  <span>Último mov.</span>
                </th>
              )}

              {/* Acciones */}
              {visibility.actions && (
                <th style={{ width: '70px', textAlign: 'center' }}>
                  <span>Acciones</span>
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={14}
                  style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}
                >
                  <div className="table-loading-spinner">
                    <span className="spinner-dot" />
                    <span>Cargando existencias de inventario...</span>
                  </div>
                </td>
              </tr>
            ) : viewMode === 'CONSOLIDATED' ? (
              // ----------------- VISTA CONSOLIDADA -----------------
              consolidatedData.map((product) => {
                const isExpanded = expandedProductIds.has(product.productId)
                const isMenuOpen = activeMenuId === product.productId

                return (
                  <React.Fragment key={product.productId}>
                    <tr
                      className={`inventory-master-row ${isExpanded ? 'is-expanded' : ''}`}
                      onClick={() => onSelectProduct(product.productId)}
                    >
                      {/* Expand Toggle */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-expand-subrow"
                          onClick={(e) => toggleExpand(product.productId, e)}
                          title={isExpanded ? 'Contraer bodegas' : 'Ver desglose por bodega'}
                          aria-expanded={isExpanded}
                        >
                          <AppIcon
                            name={isExpanded ? 'chevronDown' : 'chevronRight'}
                            size={13}
                            color="var(--navy)"
                          />
                        </button>
                      </td>

                      {/* Producto */}
                      {visibility.product && (
                        <td>
                          <div className="product-cell">
                            <div className="product-thumb">
                              {product.imageUrl ? (
                                <Image
                                  src={product.imageUrl}
                                  alt={product.productName}
                                  width={34}
                                  height={34}
                                  className="product-img"
                                  unoptimized
                                />
                              ) : (
                                <AppIcon name="products" size={16} color="var(--navy)" />
                              )}
                            </div>
                            <div>
                              <strong>{product.productName}</strong>
                              <small>
                                {product.brand} · {product.unitOfMeasure}
                              </small>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* SKU */}
                      {visibility.sku && (
                        <td>
                          <span className="mono">{product.sku}</span>
                        </td>
                      )}

                      {/* Código de barras */}
                      {visibility.barcode && (
                        <td>
                          <span className="mono text-muted">{product.barcode || '—'}</span>
                        </td>
                      )}

                      {/* Categoría */}
                      {visibility.category && (
                        <td>
                          <span className="category-tag">{product.category}</span>
                        </td>
                      )}

                      {/* Stock Total */}
                      {visibility.currentStock && (
                        <td style={{ textAlign: 'right' }}>
                          <strong className="stock-number-lead">
                            {product.totalStock.toLocaleString('es-CO')}
                          </strong>
                          <span className="unit-label"> {product.unitOfMeasure}</span>
                        </td>
                      )}

                      {/* Stock Mínimo */}
                      {visibility.minStock && (
                        <td style={{ textAlign: 'center', color: '#64748b' }}>
                          {product.minStockConsolidated.toLocaleString('es-CO')}
                        </td>
                      )}

                      {/* Stock Crítico */}
                      {visibility.criticalStock && (
                        <td style={{ textAlign: 'center', color: '#dc2626' }}>
                          {product.criticalStockConsolidated.toLocaleString('es-CO')}
                        </td>
                      )}

                      {/* Estado */}
                      {visibility.status && (
                        <td style={{ textAlign: 'center' }}>
                          {renderHealthBadge(product.overallHealth, product.totalStock)}
                        </td>
                      )}

                      {/* Costo Promedio */}
                      {visibility.averageCost && canSeeCost && (
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono font-semibold">
                            {inventoryService.formatCOP(product.averageCost)}
                          </span>
                        </td>
                      )}

                      {/* Valor Total a Costo */}
                      {visibility.totalValue && canSeeCost && (
                        <td style={{ textAlign: 'right' }}>
                          <strong className="positive-text">
                            {inventoryService.formatCOP(product.totalValueAtCost)}
                          </strong>
                        </td>
                      )}

                      {/* Último Movimiento */}
                      {visibility.lastMovement && (
                        <td>
                          <div className="movement-cell">
                            <span className="movement-doc">{product.lastMovementDoc || '—'}</span>
                            <small className="movement-date">
                              {product.lastMovementAt
                                ? new Date(product.lastMovementAt).toLocaleDateString('es-CO', {
                                    day: '2-digit',
                                    month: 'short',
                                  })
                                : 'Sin registro'}
                            </small>
                          </div>
                        </td>
                      )}

                      {/* Acciones */}
                      {visibility.actions && (
                        <td
                          style={{ textAlign: 'center', position: 'relative' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="icon-button row-more-btn"
                            onClick={() =>
                              setActiveMenuId(isMenuOpen ? null : product.productId)
                            }
                            aria-label="Opciones de inventario"
                          >
                            <AppIcon name="more" size={16} />
                          </button>

                          {isMenuOpen && (
                            <div className="row-actions-dropdown animate-fade-in">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null)
                                  onSelectProduct(product.productId)
                                }}
                              >
                                <AppIcon name="eye" size={13} />
                                <span>Ver detalle rápido</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null)
                                  onOpenAdjust(product.productId)
                                }}
                              >
                                <AppIcon name="sliders" size={13} />
                                <span>Ajustar inventario</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null)
                                  onOpenTransfer(product.productId)
                                }}
                              >
                                <AppIcon name="transfers" size={13} />
                                <span>Transferir a otra bodega</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null)
                                  onOpenKardex(product.productId)
                                }}
                              >
                                <AppIcon name="kardex" size={13} />
                                <span>Consultar en Kardex</span>
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>

                    {/* Sub-rows: Desglose por cada bodega física */}
                    {isExpanded && (
                      <tr className="subrow-container">
                        <td colSpan={14} className="subrow-td">
                          <div className="subrow-card-content animate-fade-in">
                            <div className="subrow-header">
                              <span className="subrow-title">
                                <AppIcon name="warehouses" size={14} color="var(--navy)" />
                                Existencias de <strong>{product.productName}</strong> por bodega
                              </span>
                              <span className="subrow-count">
                                {product.locationBreakdown.length} bodegas vinculadas
                              </span>
                            </div>

                            <div className="location-breakdown-grid">
                              {product.locationBreakdown.map((loc) => {
                                const maxCap = Math.max(product.totalStock, 1)
                                const pct = ((loc.stock / maxCap) * 100).toFixed(0)

                                return (
                                  <div key={loc.locationId} className="location-sub-card">
                                    <div className="loc-card-head">
                                      <div>
                                        <strong>{loc.locationName}</strong>
                                        <span className="code-badge">{loc.locationCode}</span>
                                      </div>
                                      {renderHealthBadge(loc.health, loc.stock)}
                                    </div>

                                    <div className="loc-stock-bar-wrap">
                                      <div className="loc-stock-bar-track">
                                        <i
                                          className="loc-stock-bar-fill"
                                          style={{
                                            width: `${pct}%`,
                                            backgroundColor:
                                              loc.health === 'CRITICAL' ||
                                              loc.health === 'OUT_OF_STOCK'
                                                ? 'var(--red)'
                                                : loc.health === 'LOW_STOCK'
                                                ? 'var(--amber)'
                                                : 'var(--navy)',
                                          }}
                                        />
                                      </div>
                                      <div className="loc-stock-subtext">
                                        <span>
                                          Mín: <b>{loc.minStock}</b> · Crít: <b>{loc.criticalStock}</b>
                                        </span>
                                        {canSeeCost && (
                                          <span className="font-semibold">
                                            {inventoryService.formatCOP(loc.valueAtCost, true)}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="loc-card-quick-actions">
                                      <button
                                        type="button"
                                        className="loc-btn"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onOpenAdjust(product.productId, loc.locationId)
                                        }}
                                      >
                                        <AppIcon name="sliders" size={12} />
                                        <span>Ajustar</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="loc-btn"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onOpenTransfer(product.productId, loc.locationId)
                                        }}
                                      >
                                        <AppIcon name="transfers" size={12} />
                                        <span>Transferir</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="loc-btn"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onOpenKardex(product.productId, loc.locationId)
                                        }}
                                      >
                                        <AppIcon name="kardex" size={12} />
                                        <span>Kardex</span>
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            ) : (
              // ----------------- VISTA POR BODEGA -----------------
              byLocationData.map((item) => {
                const isMenuOpen = activeMenuId === item.id

                return (
                  <tr
                    key={item.id}
                    className="inventory-location-row"
                    onClick={() => onSelectProduct(item.productId)}
                  >
                    {/* Producto */}
                    {visibility.product && (
                      <td>
                        <div className="product-cell">
                          <div className="product-thumb">
                            {item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt={item.productName}
                                width={34}
                                height={34}
                                className="product-img"
                                unoptimized
                              />
                            ) : (
                              <AppIcon name="products" size={16} color="var(--navy)" />
                            )}
                          </div>
                          <div>
                            <strong>{item.productName}</strong>
                            <small>
                              {item.brand} · {item.unitOfMeasure}
                            </small>
                          </div>
                        </div>
                      </td>
                    )}

                    {/* SKU */}
                    {visibility.sku && (
                      <td>
                        <span className="mono">{item.sku}</span>
                      </td>
                    )}

                    {/* Código de barras */}
                    {visibility.barcode && (
                      <td>
                        <span className="mono text-muted">{item.barcode || '—'}</span>
                      </td>
                    )}

                    {/* Categoría */}
                    {visibility.category && (
                      <td>
                        <span className="category-tag">{item.category}</span>
                      </td>
                    )}

                    {/* Bodega */}
                    {visibility.location && (
                      <td>
                        <div className="warehouse-name-cell">
                          <strong>{item.locationName}</strong>
                          <span className="code-badge">{item.locationCode}</span>
                        </div>
                      </td>
                    )}

                    {/* Existencia actual */}
                    {visibility.currentStock && (
                      <td style={{ textAlign: 'right' }}>
                        <strong className="stock-number-lead">
                          {item.currentStock.toLocaleString('es-CO')}
                        </strong>
                        <span className="unit-label"> {item.unitOfMeasure}</span>
                      </td>
                    )}

                    {/* Stock Mínimo */}
                    {visibility.minStock && (
                      <td style={{ textAlign: 'center', color: '#64748b' }}>
                        {item.minStock.toLocaleString('es-CO')}
                      </td>
                    )}

                    {/* Stock Crítico */}
                    {visibility.criticalStock && (
                      <td style={{ textAlign: 'center', color: '#dc2626' }}>
                        {item.criticalStock.toLocaleString('es-CO')}
                      </td>
                    )}

                    {/* Estado */}
                    {visibility.status && (
                      <td style={{ textAlign: 'center' }}>
                        {renderHealthBadge(item.stockHealth, item.currentStock)}
                      </td>
                    )}

                    {/* Costo Promedio */}
                    {visibility.averageCost && canSeeCost && (
                      <td style={{ textAlign: 'right' }}>
                        <span className="mono font-semibold">
                          {inventoryService.formatCOP(item.averageCost)}
                        </span>
                      </td>
                    )}

                    {/* Valor a Costo */}
                    {visibility.totalValue && canSeeCost && (
                      <td style={{ textAlign: 'right' }}>
                        <strong className="positive-text">
                          {inventoryService.formatCOP(item.totalValueAtCost)}
                        </strong>
                      </td>
                    )}

                    {/* Último Movimiento */}
                    {visibility.lastMovement && (
                      <td>
                        <div className="movement-cell">
                          <span className="movement-doc">{item.lastMovementDoc || '—'}</span>
                          <small className="movement-date">
                            {item.lastMovementAt
                              ? new Date(item.lastMovementAt).toLocaleDateString('es-CO', {
                                  day: '2-digit',
                                  month: 'short',
                                })
                              : 'Sin registro'}
                          </small>
                        </div>
                      </td>
                    )}

                    {/* Acciones */}
                    {visibility.actions && (
                      <td
                        style={{ textAlign: 'center', position: 'relative' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="icon-button row-more-btn"
                          onClick={() => setActiveMenuId(isMenuOpen ? null : item.id)}
                          aria-label="Opciones de inventario"
                        >
                          <AppIcon name="more" size={16} />
                        </button>

                        {isMenuOpen && (
                          <div className="row-actions-dropdown animate-fade-in">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null)
                                onSelectProduct(item.productId)
                              }}
                            >
                              <AppIcon name="eye" size={13} />
                              <span>Ver detalle rápido</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null)
                                onOpenAdjust(item.productId, item.locationId)
                              }}
                            >
                              <AppIcon name="sliders" size={13} />
                              <span>Ajustar en esta bodega</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null)
                                onOpenTransfer(item.productId, item.locationId)
                              }}
                            >
                              <AppIcon name="transfers" size={13} />
                              <span>Transferir desde aquí</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null)
                                onOpenKardex(item.productId, item.locationId)
                              }}
                            >
                              <AppIcon name="kardex" size={13} />
                              <span>Kardex de esta bodega</span>
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="table-pagination-footer">
        <div className="pagination-info">
          <span>
            Mostrando <b>{totalRecords === 0 ? 0 : (page - 1) * pageSize + 1}</b> a{' '}
            <b>{Math.min(page * pageSize, totalRecords)}</b> de <b>{totalRecords}</b> registros
          </span>

          <div className="page-size-selector">
            <span>Mostrar:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Registros por página"
            >
              <option value={10}>10 por pág.</option>
              <option value={25}>25 por pág.</option>
              <option value={50}>50 por pág.</option>
              <option value={100}>100 por pág.</option>
            </select>
          </div>
        </div>

        <div className="pagination-controls">
          <button
            type="button"
            className="pagination-btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            <AppIcon name="chevronLeft" size={14} />
            <span>Anterior</span>
          </button>

          <div className="pagination-pages">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
              <button
                key={pNum}
                type="button"
                className={`pagination-number-btn ${pNum === page ? 'active' : ''}`}
                onClick={() => onPageChange(pNum)}
              >
                {pNum}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="pagination-btn"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Página siguiente"
          >
            <span>Siguiente</span>
            <AppIcon name="chevronRight" size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
