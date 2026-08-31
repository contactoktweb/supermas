'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { InventoryMovement } from '../types'
import { getMovementTypeBadge } from './KardexTable'
import { kardexService } from '../services/kardex.service'

interface KardexTimelineProps {
  movements: InventoryMovement[]
  isCostRedacted: boolean
  onSelectMovement: (movement: InventoryMovement) => void
}

export function KardexTimeline({
  movements,
  isCostRedacted,
  onSelectMovement,
}: KardexTimelineProps) {
  const groups = kardexService.groupMovementsByDate(movements)

  const formatTimeOnly = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="kardex-timeline-view page-enter" aria-label="Línea de tiempo del Kardex">
      {groups.map((group, groupIdx) => (
        <div key={group.dateLabel} className="timeline-date-section">
          <div className="timeline-date-sticky-badge">
            <AppIcon name="calendar" size={14} />
            <strong>{group.dateLabel}</strong>
            <span className="count-pill">{group.items.length} eventos</span>
          </div>

          <div className="timeline-track-container">
            {group.items.map((m, idx) => {
              const isEntry = m.quantityIn > 0
              const qtyDisplay = isEntry ? `+${m.quantityIn}` : `-${m.quantityOut}`
              const nodeTone = isEntry
                ? 'node-green'
                : m.type === 'AJUSTE_SALIDA'
                ? 'node-red'
                : 'node-amber'

              return (
                <div
                  key={m.id}
                  className="timeline-event-card-wrapper"
                  style={{ animationDelay: `${(groupIdx * 4 + idx) * 0.05}s` }}
                  onClick={() => onSelectMovement(m)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectMovement(m)
                    }
                  }}
                >
                  {/* Timeline Left Node Marker */}
                  <div className={`timeline-node-circle ${nodeTone}`}>
                    <div className="node-inner-dot" />
                  </div>

                  {/* Timeline Event Card */}
                  <article className="timeline-event-card">
                    {/* Header Row */}
                    <div className="timeline-card-header">
                      <div className="timeline-type-group">
                        {getMovementTypeBadge(m.type)}
                        <strong className={`timeline-qty-highlight ${isEntry ? 'positive' : 'negative'}`}>
                          {qtyDisplay} {m.unitOfMeasure}s
                        </strong>
                      </div>

                      <div className="timeline-time-badge">
                        <AppIcon name="clock" size={12} />
                        <time dateTime={m.createdAt}>{formatTimeOnly(m.createdAt)}</time>
                      </div>
                    </div>

                    {/* Product & Location Block */}
                    <div className="timeline-product-row">
                      <div className="timeline-thumb-wrap">
                        {m.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.imageUrl}
                            alt={m.productName}
                            className="timeline-mini-img"
                          />
                        ) : (
                          <AppIcon name="products" size={16} />
                        )}
                      </div>

                      <div className="timeline-product-meta">
                        <strong className="timeline-prod-name">{m.productName}</strong>
                        <div className="timeline-tags-row">
                          <span className="code-badge">{m.sku}</span>
                          <span className="category-pill-tag">{m.category}</span>
                          <span className="timeline-wh-tag">
                            <AppIcon name="warehouse" size={11} />
                            <span>{m.locationName}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Balance & Document Details */}
                    <div className="timeline-details-bar">
                      <div className="timeline-metric-item">
                        <span>Saldo anterior:</span>
                        <b>
                          {m.previousStock} {m.unitOfMeasure}
                        </b>
                      </div>

                      <div className="timeline-metric-item">
                        <AppIcon name="arrowRight" size={12} color="#94a3b8" />
                        <span>Saldo resultante:</span>
                        <strong style={{ color: 'var(--navy)' }}>
                          {m.resultingStock} {m.unitOfMeasure}
                        </strong>
                      </div>

                      <div className="timeline-metric-item doc-item">
                        <span className="source-doc-badge">
                          <AppIcon name="fileText" size={12} />
                          <strong>{m.sourceDocumentNumber}</strong>
                        </span>
                      </div>

                      {!isCostRedacted && m.totalValue > 0 && (
                        <div className="timeline-metric-item cost-item">
                          <span>Valor:</span>
                          <strong>${m.totalValue.toLocaleString('es-CO')}</strong>
                        </div>
                      )}
                    </div>

                    {/* Footer Row: User & Notes */}
                    <div className="timeline-card-footer">
                      <div className="timeline-user-tag">
                        <AppIcon name="users" size={12} />
                        <span>
                          {m.userName} ({m.userRole})
                        </span>
                      </div>

                      {m.notes && <p className="timeline-notes-preview">{m.notes}</p>}

                      <span className="timeline-click-hint">
                        <span>Ver trazabilidad</span>
                        <AppIcon name="chevronRight" size={12} />
                      </span>
                    </div>
                  </article>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
