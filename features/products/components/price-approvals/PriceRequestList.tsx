'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { PriceChangeRequest } from '../../types'
import { productService } from '../../services/product.service'
import { formatPriceVariation } from '../../utils/price-change-plan'
import { PriceRequestStatusBadge } from './PriceRequestStatusBadge'

interface PriceRequestListProps {
  requests: PriceChangeRequest[]
  onSelect: (request: PriceChangeRequest) => void
}

export function formatRequestDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  })
}

export function PriceRequestList({ requests, onSelect }: PriceRequestListProps) {
  return (
    <ul className="price-request-list" aria-label="Solicitudes de cambio de precio">
      {requests.map((request, index) => {
        const isDown = request.variationPercent !== null && request.variationPercent < 0
        return (
          <li key={request.id} style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
            <button type="button" className="price-request-card" onClick={() => onSelect(request)}>
              <span className="price-request-card-top">
                <span className="price-request-product">
                  <strong>{request.productName}</strong>
                  <small>
                    {request.productSku} · {request.priceListName}
                  </small>
                </span>
                <PriceRequestStatusBadge status={request.status} />
              </span>

              <span className="price-request-prices">
                <s>{productService.formatCurrency(request.previousPrice)}</s>
                <AppIcon name="arrowRight" size={14} aria-hidden="true" />
                <strong>{productService.formatCurrency(request.proposedPrice)}</strong>
                <em className={isDown ? 'is-down' : 'is-up'}>{formatPriceVariation(request.variationPercent)}</em>
              </span>

              <span className="price-request-meta">
                <span>
                  <AppIcon name="users" size={12} aria-hidden="true" /> {request.requestedByName}
                </span>
                <span>
                  <AppIcon name="calendar" size={12} aria-hidden="true" /> {formatRequestDate(request.requestedAt)}
                </span>
              </span>

              {request.status === 'REJECTED' && request.reviewNotes && (
                <span className="price-request-note">Motivo del rechazo: {request.reviewNotes}</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
