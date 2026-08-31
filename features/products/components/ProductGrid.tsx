'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { Product } from '../types'
import { productService } from '../services/product.service'

interface ProductGridProps {
  products: Product[]
  isCostRedacted: boolean
  onSelectProduct: (product: Product) => void
  onEditProduct: (product: Product) => void
}

export function ProductGrid({
  products,
  isCostRedacted,
  onSelectProduct,
  onEditProduct,
}: ProductGridProps) {
  return (
    <div className="product-grid products-modern-grid page-enter">
      {products.map((product, idx) => {
        const hasWebSuperMas = product.webSuperMas
        const hasWebDistribuidora = product.webDistribuidora

        return (
          <article
            key={product.id}
            className="product-card product-modern-card"
            style={{ animationDelay: `${idx * 0.04}s` }}
            onClick={() => onSelectProduct(product)}
          >
            {/* Card Header with Category and Status */}
            <div className="product-card-top-bar">
              <span className="category-pill-tag">{product.category}</span>
              <span
                className={`status-indicator-pill ${
                  product.status === 'ACTIVE' ? 'active' : 'inactive'
                }`}
              >
                {product.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            {/* Product Image & Thumbnail */}
            <div className="product-card-image-wrap">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="product-card-hero-img"
                  loading="lazy"
                />
              ) : (
                <div className="product-thumb large">
                  <AppIcon name="products" size={28} />
                </div>
              )}

              {/* Stock Badge Overlay */}
              <div className="product-stock-floating-badge">
                <span
                  className={`state ${
                    product.stockHealth === 'AVAILABLE'
                      ? 'disponible'
                      : product.stockHealth === 'LOW_STOCK'
                      ? 'stock-bajo'
                      : product.stockHealth === 'CRITICAL'
                      ? 'crítico'
                      : 'agotado'
                  }`}
                >
                  {product.totalStock} {product.unitOfMeasure}s
                </span>
              </div>
            </div>

            {/* Product Info */}
            <div className="product-card-content">
              <span className="product-card-brand">{product.brand}</span>
              <h3 className="product-card-name" title={product.name}>
                {product.name}
              </h3>
              <span className="code-badge product-card-sku">{product.sku}</span>

              {/* Price & Margins */}
              <div className="product-card-pricing-row">
                <div>
                  <span className="price-label">Precio normal</span>
                  <strong className="product-card-price">
                    {productService.formatCurrency(product.normalPrice)}
                  </strong>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className="price-label">Mayorista</span>
                  <span className="product-card-wholesale">
                    {productService.formatCurrency(product.wholesalePrice)}
                  </span>
                </div>
              </div>

              {/* Margin & Web publication row */}
              <div className="product-card-footer-row">
                <div className="product-card-margin">
                  <span>Margen: </span>
                  {isCostRedacted ? (
                    <span className="redacted-pill">••••</span>
                  ) : (
                    <strong className="margin-text-highlight">
                      {product.profitMarginPercent.toFixed(1)}%
                    </strong>
                  )}
                </div>

                <div className="product-card-web-tags">
                  {hasWebSuperMas && hasWebDistribuidora ? (
                    <span className="web-tag-pill both" title="Compra directa web + WhatsApp">
                      Web + WA
                    </span>
                  ) : hasWebSuperMas ? (
                    <span className="web-tag-pill sm" title="Compra directa web">
                      Web SM
                    </span>
                  ) : hasWebDistribuidora ? (
                    <span className="web-tag-pill wa" title="Contacto por WhatsApp">
                      Cat. WA
                    </span>
                  ) : (
                    <span className="web-tag-pill none">Sin web</span>
                  )}
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
