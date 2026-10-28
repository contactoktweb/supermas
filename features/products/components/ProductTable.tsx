'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import {
  Product,
  ProductColumnVisibility,
  ProductSortField,
  ProductSortDirection,
  UserPermissionContext,
} from '../types'
import { productService } from '../services/product.service'
import { SelectField } from '@/components/ui/SelectField'

interface ProductTableProps {
  products: Product[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  isCostRedacted: boolean
  sortField?: ProductSortField
  sortDirection?: ProductSortDirection
  visibility: ProductColumnVisibility
  userContext?: UserPermissionContext
  onSort: (field: ProductSortField) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSelectProduct: (product: Product) => void
  onEditProduct: (product: Product) => void
  onDeactivateProduct: (product: Product) => void
  onDeleteProduct?: (product: Product) => void
  onViewKardex: (product: Product) => void
  onTransferProduct: (product: Product) => void
  onAdjustStock: (product: Product) => void
}

export function ProductTable({
  products,
  total,
  page,
  pageSize,
  totalPages,
  isCostRedacted,
  sortField = 'name',
  sortDirection = 'asc',
  visibility,
  userContext,
  onSort,
  onPageChange,
  onPageSizeChange,
  onSelectProduct,
  onEditProduct,
  onDeactivateProduct,
  onDeleteProduct,
  onViewKardex,
  onTransferProduct,
  onAdjustStock,
}: ProductTableProps) {
  const [activeMenuProduct, setActiveMenuProduct] = useState<Product | null>(null)
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Cerrar el popover al hacer clic afuera, scroll o presionar Escape
  useEffect(() => {
    if (!activeMenuProduct) return

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.product-action-portal-menu') && !target.closest('.row-more-btn')) {
        setActiveMenuProduct(null)
        setMenuRect(null)
      }
    }

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement
      // No cerrar si el scroll ocurre dentro del propio menú desplegable
      if (target && target.closest && target.closest('.product-action-portal-menu')) {
        return
      }
      setActiveMenuProduct(null)
      setMenuRect(null)
    }

    const handleResize = () => {
      setActiveMenuProduct(null)
      setMenuRect(null)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuProduct(null)
        setMenuRect(null)
      }
    }

    window.addEventListener('click', handleOutsideClick)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('click', handleOutsideClick)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeMenuProduct])

  const canUpdate = !userContext || userContext.userRole === 'ADMIN' || userContext.permissions.includes('products.update')
  const canDeactivate = !userContext || userContext.userRole === 'ADMIN' || userContext.permissions.includes('products.delete')

  const getSortIcon = (field: ProductSortField) => {
    if (sortField !== field) {
      return <AppIcon name="chevronDown" size={11} color="#94a3b8" />
    }
    return sortDirection === 'asc' ? (
      <AppIcon name="arrowUpRight" size={12} color="var(--navy)" />
    ) : (
      <AppIcon name="arrowDownRight" size={12} color="var(--navy)" />
    )
  }

  const renderStockHealthBadge = (product: Product) => {
    switch (product.stockHealth) {
      case 'AVAILABLE':
        return (
          <span className="state disponible" title="Stock en niveles óptimos">
            <AppIcon name="check" size={13} />
            <span>{product.totalStock} uds</span>
          </span>
        )
      case 'LOW_STOCK':
        return (
          <span className="state stock-bajo" title="Stock bajo el umbral mínimo">
            <AppIcon name="warning" size={13} />
            <span>{product.totalStock} uds</span>
          </span>
        )
      case 'CRITICAL':
        return (
          <span className="state crítico" title="Stock crítico urgente">
            <AppIcon name="warning" size={13} />
            <span>{product.totalStock} uds</span>
          </span>
        )
      case 'OUT_OF_STOCK':
      default:
        return (
          <span className="state agotado" title="Sin existencias disponibles">
            <AppIcon name="close" size={13} />
            <span>Agotado</span>
          </span>
        )
    }
  }

  const startRecord = (page - 1) * pageSize + 1
  const endRecord = Math.min(total, page * pageSize)

  return (
    <div className="table-panel animated-table products-table-panel page-enter">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {visibility.image && <th style={{ width: 48 }}>Img</th>}

              {visibility.sku && (
                <th
                  onClick={() => onSort('sku')}
                  className="sortable-th"
                >
                  <div className="th-content">
                    <span>SKU</span>
                    {getSortIcon('sku')}
                  </div>
                </th>
              )}

              {visibility.barcode && (
                <th
                  onClick={() => onSort('barcode')}
                  className="sortable-th"
                >
                  <div className="th-content">
                    <span>Código barras</span>
                    {getSortIcon('barcode')}
                  </div>
                </th>
              )}

              {visibility.name && (
                <th
                  onClick={() => onSort('name')}
                  className="sortable-th"
                  style={{ minWidth: 220 }}
                >
                  <div className="th-content">
                    <span>Producto</span>
                    {getSortIcon('name')}
                  </div>
                </th>
              )}

              {visibility.category && (
                <th
                  onClick={() => onSort('category')}
                  className="sortable-th"
                >
                  <div className="th-content">
                    <span>Categoría</span>
                    {getSortIcon('category')}
                  </div>
                </th>
              )}

              {visibility.brand && (
                <th
                  onClick={() => onSort('brand')}
                  className="sortable-th"
                >
                  <div className="th-content">
                    <span>Marca</span>
                    {getSortIcon('brand')}
                  </div>
                </th>
              )}

              {visibility.stock && (
                <th
                  onClick={() => onSort('stock')}
                  className="sortable-th"
                  style={{ textAlign: 'right' }}
                >
                  <div className="th-content right">
                    <span>Stock total</span>
                    {getSortIcon('stock')}
                  </div>
                </th>
              )}

              {visibility.status && <th style={{ textAlign: 'center' }}>Estado</th>}

              {visibility.cost && (
                <th
                  onClick={() => onSort('averageCost')}
                  className="sortable-th"
                  style={{ textAlign: 'right' }}
                >
                  <div className="th-content right">
                    <span>Costo prom.</span>
                    {getSortIcon('averageCost')}
                  </div>
                </th>
              )}

              {visibility.normalPrice && (
                <th
                  onClick={() => onSort('normalPrice')}
                  className="sortable-th"
                  style={{ textAlign: 'right' }}
                >
                  <div className="th-content right">
                    <span>Precio normal</span>
                    {getSortIcon('normalPrice')}
                  </div>
                </th>
              )}

              {visibility.wholesalePrice && (
                <th
                  onClick={() => onSort('wholesalePrice')}
                  className="sortable-th"
                  style={{ textAlign: 'right' }}
                >
                  <div className="th-content right">
                    <span>Mayorista</span>
                    {getSortIcon('wholesalePrice')}
                  </div>
                </th>
              )}

              {visibility.margin && (
                <th
                  onClick={() => onSort('margin')}
                  className="sortable-th"
                  style={{ textAlign: 'right' }}
                >
                  <div className="th-content right">
                    <span>Margen</span>
                    {getSortIcon('margin')}
                  </div>
                </th>
              )}

              {visibility.webSuperMas && (
                <th style={{ textAlign: 'center' }} title="Catálogo Super Más (Compra web)">
                  Web SM
                </th>
              )}

              {visibility.webDistribuidora && (
                <th style={{ textAlign: 'center' }} title="Catálogo Distribuidora (WhatsApp)">
                  Cat. Dist.
                </th>
              )}

              {visibility.actions && (
                <th style={{ width: 80, textAlign: 'center' }}>Acciones</th>
              )}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={14}>
                  <div
                    style={{
                      padding: '48px 24px',
                      textAlign: 'center',
                      color: 'var(--muted)',
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: '#e9eef8',
                        color: 'var(--navy)',
                        display: 'grid',
                        placeItems: 'center',
                        margin: '0 auto 12px',
                      }}
                    >
                      <AppIcon name="products" size={24} />
                    </div>
                    <strong style={{ fontSize: 15, color: 'var(--navy)' }}>
                      No hay productos registrados
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                      No hay productos que coincidan con los filtros o aún no se han registrado artículos en el catálogo.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const isMenuOpen = activeMenuProduct?.id === product.id

              return (
                <tr
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  className="clickable-row"
                >
                  {/* Image */}
                  {visibility.image && (
                    <td>
                      <div className="product-thumb-cell">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            decoding="async"
                            src={product.imageUrl}
                            alt={product.name}
                            className="product-mini-img"
                            loading="lazy"
                          />
                        ) : (
                          <div className="product-thumb">
                            <AppIcon name="products" size={16} />
                          </div>
                        )}
                      </div>
                    </td>
                  )}

                  {/* SKU */}
                  {visibility.sku && (
                    <td>
                      <span className="code-badge product-sku-badge">
                        {product.sku}
                      </span>
                    </td>
                  )}

                  {/* Barcode */}
                  {visibility.barcode && (
                    <td>
                      <span className="mono barcode-text">
                        {product.barcode || '—'}
                      </span>
                    </td>
                  )}

                  {/* Product Name */}
                  {visibility.name && (
                    <td>
                      <div className="product-name-block">
                        <strong>{product.name}</strong>
                        {product.description && (
                          <small className="product-desc-preview">
                            {product.description}
                          </small>
                        )}
                      </div>
                    </td>
                  )}

                  {/* Category */}
                  {visibility.category && (
                    <td>
                      <span className="category-pill-tag">
                        {product.categoryName || product.category?.name || '—'}
                      </span>
                    </td>
                  )}

                  {/* Brand */}
                  {visibility.brand && (
                    <td>
                      <span className="brand-text">{product.brandName || product.brand?.name || '—'}</span>
                    </td>
                  )}

                  {/* Total Stock */}
                  {visibility.stock && (
                    <td style={{ textAlign: 'right' }}>
                      {renderStockHealthBadge(product)}
                    </td>
                  )}

                  {/* Status */}
                  {visibility.status && (
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`status-indicator-pill ${
                          product.status === 'ACTIVE' ? 'active' : 'inactive'
                        }`}
                      >
                        {product.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  )}

                  {/* Average Cost (RBAC) */}
                  {visibility.cost && (
                    <td style={{ textAlign: 'right' }}>
                      {isCostRedacted ? (
                        <span className="redacted-pill" title="Acceso confidencial">
                          ••••••••
                        </span>
                      ) : (
                        <span className="cost-text">
                          {productService.formatCurrency(product.averageCost)}
                        </span>
                      )}
                    </td>
                  )}

                  {/* Normal Price */}
                  {visibility.normalPrice && (
                    <td style={{ textAlign: 'right' }}>
                      <strong className="price-primary">
                        {productService.formatCurrency(product.normalPrice)}
                      </strong>
                    </td>
                  )}

                  {/* Wholesale Price */}
                  {visibility.wholesalePrice && (
                    <td style={{ textAlign: 'right' }}>
                      <span className="price-secondary">
                        {productService.formatCurrency(product.wholesalePrice)}
                      </span>
                    </td>
                  )}

                  {/* Margin % (RBAC) */}
                  {visibility.margin && (
                    <td style={{ textAlign: 'right' }}>
                      {isCostRedacted ? (
                        <span className="redacted-pill">••••</span>
                      ) : (
                        <span
                          className={`margin-badge ${
                            product.profitMarginPercent >= 25
                              ? 'high'
                              : product.profitMarginPercent >= 15
                              ? 'medium'
                              : 'low'
                          }`}
                        >
                          {product.profitMarginPercent.toFixed(1)}%
                        </span>
                      )}
                    </td>
                  )}

                  {/* Web Super Más */}
                  {visibility.webSuperMas && (
                    <td style={{ textAlign: 'center' }}>
                      {product.webSuperMas ? (
                        <span className="web-channel-dot active" title="Publicado en Catálogo Super Más (Compra Web)">
                          <AppIcon name="check" size={11} />
                          <span>SM</span>
                        </span>
                      ) : (
                        <span className="web-channel-dot inactive" title="No disponible en Catálogo Super Más">
                          —
                        </span>
                      )}
                    </td>
                  )}

                  {/* Web Distribuidora */}
                  {visibility.webDistribuidora && (
                    <td style={{ textAlign: 'center' }}>
                      {product.webDistribuidora ? (
                        <span className="web-channel-dot active-dist" title="Publicado en Catálogo Distribuidora (WhatsApp)">
                          <AppIcon name="check" size={11} />
                          <span>Dist</span>
                        </span>
                      ) : (
                        <span className="web-channel-dot inactive" title="No disponible en Catálogo Distribuidora">
                          —
                        </span>
                      )}
                    </td>
                  )}

                  {/* Actions Dropdown */}
                  {visibility.actions && (
                    <td
                      style={{ textAlign: 'center' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="row-actions-container">
                        <button
                          type="button"
                          className="icon-button row-more-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (activeMenuProduct?.id === product.id) {
                              setActiveMenuProduct(null)
                              setMenuRect(null)
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setActiveMenuProduct(product)
                              setMenuRect(rect)
                            }
                          }}
                          aria-label={`Acciones para ${product.name}`}
                        >
                          <AppIcon name="more" size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>

      {/* Portal Popover para Acciones de Fila (Evita overflow clipping por contenedor de tabla) */}
      {mounted &&
        activeMenuProduct &&
        menuRect &&
        createPortal(
          (() => {
            const menuHeight = 310
            const spaceBelow = window.innerHeight - menuRect.bottom - 12
            const spaceAbove = menuRect.top - 12
            const openUpwards = spaceBelow < menuHeight && spaceAbove > spaceBelow
            const availableSpace = openUpwards ? spaceAbove : spaceBelow
            const maxHeight = Math.min(360, Math.max(160, availableSpace))
            const product = activeMenuProduct
            const right = Math.max(12, Math.min(window.innerWidth - 220, window.innerWidth - menuRect.right))

            return (
              <div
                className="product-action-portal-menu animate-scale-up"
                style={{
                  position: 'fixed',
                  zIndex: 99999,
                  right,
                  ...(openUpwards
                    ? { bottom: window.innerHeight - menuRect.top + 6 }
                    : { top: menuRect.bottom + 6 }),
                  width: 204,
                  maxHeight,
                  overflowY: 'auto',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 12,
                  padding: '6px 4px',
                  boxShadow: '0 20px 38px -6px rgba(0, 27, 92, 0.24), 0 8px 16px -4px rgba(0, 0, 0, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Cabecera sutil del producto */}
                <div className="px-2.5 py-1.5 border-b border-slate-100 mb-0.5">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">
                    Opciones de Producto
                  </span>
                  <strong className="text-[11px] font-semibold text-slate-800 block truncate" title={product.name}>
                    {product.name}
                  </strong>
                </div>

                <button
                  type="button"
                  className="popover-action-item"
                  onClick={() => {
                    setActiveMenuProduct(null)
                    setMenuRect(null)
                    onSelectProduct(product)
                  }}
                >
                  <AppIcon name="eye" size={14} className="text-blue-900 shrink-0" />
                  <span>Ver detalle</span>
                </button>

                {canUpdate && (
                  <button
                    type="button"
                    className="popover-action-item"
                    onClick={() => {
                      setActiveMenuProduct(null)
                      setMenuRect(null)
                      onEditProduct(product)
                    }}
                  >
                    <AppIcon name="edit" size={14} className="text-indigo-600 shrink-0" />
                    <span>Editar producto</span>
                  </button>
                )}

                <button
                  type="button"
                  className="popover-action-item"
                  onClick={() => {
                    setActiveMenuProduct(null)
                    setMenuRect(null)
                    onViewKardex(product)
                  }}
                >
                  <AppIcon name="kardex" size={14} className="text-sky-600 shrink-0" />
                  <span>Ver Kardex</span>
                </button>

                <button
                  type="button"
                  className="popover-action-item"
                  onClick={() => {
                    setActiveMenuProduct(null)
                    setMenuRect(null)
                    onTransferProduct(product)
                  }}
                >
                  <AppIcon name="transfers" size={14} className="text-purple-600 shrink-0" />
                  <span>Transferir</span>
                </button>

                <button
                  type="button"
                  className="popover-action-item"
                  onClick={() => {
                    setActiveMenuProduct(null)
                    setMenuRect(null)
                    onAdjustStock(product)
                  }}
                >
                  <AppIcon name="inventory" size={14} className="text-emerald-600 shrink-0" />
                  <span>Ajustar inventario</span>
                </button>

                {canDeactivate && product.status === 'ACTIVE' && (
                  <>
                    <div className="border-t border-slate-100 my-0.5" />
                    <button
                      type="button"
                      className="popover-action-item danger"
                      onClick={() => {
                        setActiveMenuProduct(null)
                        setMenuRect(null)
                        onDeactivateProduct(product)
                      }}
                    >
                      <AppIcon name="warning" size={14} className="text-amber-600 shrink-0" />
                      <span>Desactivar</span>
                    </button>
                  </>
                )}

                {canDeactivate && onDeleteProduct && (
                  <>
                    {(!canDeactivate || product.status !== 'ACTIVE') && (
                      <div className="border-t border-slate-100 my-0.5" />
                    )}
                    <button
                      type="button"
                      className="popover-action-item danger"
                      onClick={() => {
                        setActiveMenuProduct(null)
                        setMenuRect(null)
                        onDeleteProduct(product)
                      }}
                      title="Eliminar producto con doble confirmación y palabra de seguridad"
                    >
                      <AppIcon name="trash" size={14} className="text-rose-600 shrink-0" />
                      <span>Eliminar producto</span>
                    </button>
                  </>
                )}
              </div>
            )
          })(),
          document.body
        )}

      {/* Pagination Bar */}
      {total > 0 && (
        <div className="table-pagination-footer">
          <div className="pagination-info">
            <span>
              Mostrando <strong>{startRecord}</strong> -{' '}
              <strong>{endRecord}</strong> de <strong>{total}</strong> productos
            </span>
            <div className="page-size-selector">
              <span>Mostrar:</span>
              <SelectField
                value={pageSize}
                aria-label="Registros por página"
                size="md"
                onChange={(value) => onPageSizeChange(Number(value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </SelectField>
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
                  className={`pagination-number-btn ${
                    pNum === page ? 'active' : ''
                  }`}
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
      )}
    </div>
  )
}
