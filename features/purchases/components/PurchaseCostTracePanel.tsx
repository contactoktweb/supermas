'use client'

import React, { useEffect, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { Purchase, PurchaseCostTrace, UserPermissionContext } from '../types'
import { purchaseService } from '../services/purchase.service'

interface PurchaseCostTracePanelProps {
  purchase: Purchase
  userContext?: UserPermissionContext
}

type TraceState = { status: 'loading' } | { status: 'ready'; trace: PurchaseCostTrace } | { status: 'unavailable' }

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const variationPercent = (previous: number, current: number) => (previous > 0 ? ((current - previous) / previous) * 100 : null)

function VariationBadge({ previous, current }: { previous: number; current: number }) {
  const percent = variationPercent(previous, current)
  if (percent === null || Math.abs(percent) < 0.005) return <span className="cost-trace-badge is-equal">Sin cambio</span>
  const up = percent > 0
  return (
    <span className={`cost-trace-badge ${up ? 'is-up' : 'is-down'}`}>
      <AppIcon name={up ? 'arrowUpRight' : 'arrowDownRight'} size={11} />
      {up ? '+' : ''}
      {percent.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%
    </span>
  )
}

/** Costo del producto frente al costo pactado en la orden y el historial de cambios de costo. */
export function PurchaseCostTracePanel({ purchase, userContext }: PurchaseCostTracePanelProps) {
  const [state, setState] = useState<TraceState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    purchaseService
      .getCostTrace(purchase.id, userContext)
      .then((trace) => active && setState({ status: 'ready', trace }))
      .catch(() => active && setState({ status: 'unavailable' }))
    return () => {
      active = false
    }
  }, [purchase.id, purchase.updatedAt, userContext])

  if (state.status === 'unavailable') return null

  const itemsWithReference =
    state.status === 'ready'
      ? purchase.items.filter((item) => state.trace.referenceCostByItemId[item.id] != null)
      : []
  const changes = state.status === 'ready' ? state.trace.changes : []

  return (
    <section className="cost-trace-panel" aria-labelledby={`cost-trace-${purchase.id}`}>
      <h3 id={`cost-trace-${purchase.id}`} className="cost-trace-title">
        <AppIcon name="history" size={15} />
        Trazabilidad del costo
      </h3>

      {state.status === 'loading' ? (
        <p role="status" className="cost-trace-empty">Consultando cambios de costo...</p>
      ) : itemsWithReference.length === 0 && changes.length === 0 ? (
        <p className="cost-trace-empty">Esta orden no tiene cambios de costo registrados.</p>
      ) : (
        <>
          {itemsWithReference.length > 0 && (
            <div className="table-responsive cost-trace-table">
              <table className="products-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="numeric">Costo del producto</th>
                    <th className="numeric">Costo en la orden</th>
                    <th className="numeric">Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsWithReference.map((item) => {
                    const reference = state.trace.referenceCostByItemId[item.id] as number
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong style={{ fontSize: 12 }}>{item.productName}</strong>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>SKU: {item.sku}</div>
                        </td>
                        <td className="numeric font-tabular">{formatCurrency(reference)}</td>
                        <td className="numeric font-tabular">
                          <strong>{formatCurrency(item.unitCost)}</strong>
                        </td>
                        <td className="numeric">
                          <VariationBadge previous={reference} current={item.unitCost} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {changes.length > 0 && (
            <ol className="cost-trace-timeline">
              {changes.map((change) => (
                <li key={change.id} className="cost-trace-event">
                  <div className="cost-trace-event-head">
                    <strong>{change.productName}</strong>
                    <VariationBadge previous={change.previousUnitCost} current={change.newUnitCost} />
                  </div>
                  <p className="cost-trace-event-detail">
                    {change.source === 'PRODUCT_COST' ? 'Pactado distinto al costo del producto' : 'Costo modificado al editar la orden'}:{' '}
                    <span className="font-tabular">{formatCurrency(change.previousUnitCost)}</span>
                    {' a '}
                    <strong className="font-tabular">{formatCurrency(change.newUnitCost)}</strong>
                  </p>
                  <p className="cost-trace-event-meta">
                    {formatDateTime(change.changedAt)}
                    {change.changedByUserName ? ` · ${change.changedByUserName}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  )
}
