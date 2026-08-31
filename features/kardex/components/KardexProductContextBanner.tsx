'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ProductKardexSummary } from '../types'

interface KardexProductContextBannerProps {
  summary: ProductKardexSummary | null
  onClearProductFilter: () => void
  onLocationClick: (locationId: string) => void
  selectedLocationId?: string
}

export function KardexProductContextBanner({
  summary,
  onClearProductFilter,
  onLocationClick,
  selectedLocationId,
}: KardexProductContextBannerProps) {
  if (!summary) return null

  return (
    <div className="product-context-banner page-enter">
      <div className="product-context-main">
        <div className="context-thumb-box">
          {summary.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={summary.imageUrl}
              alt={summary.productName}
              className="context-img"
            />
          ) : (
            <AppIcon name="products" size={24} />
          )}
        </div>

        <div className="context-info-col">
          <div className="context-eyebrow-row">
            <span className="category-pill-tag">{summary.category}</span>
            <span className="code-badge">{summary.sku}</span>
          </div>
          <h3 className="context-product-title">{summary.productName}</h3>
          <span className="context-meta-text">
            Filtrando todos los movimientos históricos de este ítem
          </span>
        </div>
      </div>

      <div className="context-distribution-col">
        <div className="context-total-stock-block">
          <span>Stock total actual:</span>
          <strong>
            {summary.totalStockAllWarehouses} {summary.unitOfMeasure}s
          </strong>
        </div>

        <div className="context-warehouses-pills">
          <span className="pills-label">Existencia por sede:</span>
          <div className="pills-list">
            {summary.warehousesDistribution.map((w) => {
              const isSelected = selectedLocationId === w.locationId
              return (
                <button
                  key={w.locationId}
                  type="button"
                  className={`wh-stock-pill ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => onLocationClick(isSelected ? 'ALL' : w.locationId)}
                  title={`Filtrar Kardex en ${w.locationName}`}
                >
                  <span className="wh-pill-name">{w.locationCode}:</span>
                  <strong className="wh-pill-qty">{w.stock}</strong>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="icon-button close-context-btn"
        onClick={onClearProductFilter}
        title="Quitar filtro de producto y ver todo el Kardex"
        aria-label="Quitar filtro de producto"
      >
        <AppIcon name="close" size={16} />
      </button>
    </div>
  )
}
