'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { PriceChangeRequest } from '../../types'
import { productService, PRICE_CHANGE_REASON_MIN_LENGTH } from '../../services/product.service'
import { formatPriceVariation } from '../../utils/price-change-plan'
import { PriceRequestStatusBadge } from './PriceRequestStatusBadge'
import { formatRequestDate } from './PriceRequestList'

interface PriceRequestReviewDrawerProps {
  request: PriceChangeRequest | null
  currentUserId: string | null
  canApprove: boolean
  onClose: () => void
  onReviewed: (message: string, approved: boolean) => void
}

type PendingAction = 'APPROVE' | 'REJECT' | null

function MarginLine({ label, price, cost, taxRate }: { label: string; price: number; cost: number; taxRate: number }) {
  const margin = productService.calculateProfitMargin(price, taxRate, cost)
  return (
    <div className="price-review-margin">
      <span>{label}</span>
      <strong className={margin.amount < 0 ? 'is-down' : ''}>{margin.percentage.toFixed(1)} %</strong>
      <small>{productService.formatCurrency(margin.amount)} por unidad</small>
    </div>
  )
}

export function PriceRequestReviewDrawer({
  request,
  currentUserId,
  canApprove,
  onClose,
  onReviewed,
}: PriceRequestReviewDrawerProps) {
  const [notes, setNotes] = useState('')
  const [confirmAction, setConfirmAction] = useState<PendingAction>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNotes('')
    setConfirmAction(null)
    setError(null)
  }, [request?.id])

  useEffect(() => {
    if (!request) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [request, isSubmitting, onClose])

  if (!request || typeof document === 'undefined') return null

  const isOwnRequest = request.requestedBy === currentUserId
  const canReview = canApprove && request.status === 'PENDING' && !isOwnRequest
  const cost = request.currentCost ?? request.costAtRequest
  const hasCost = cost !== null && cost > 0
  const isDown = request.variationPercent !== null && request.variationPercent < 0
  const currentPriceChanged = request.status === 'PENDING' ? false : request.priceAtReview !== null && request.priceAtReview !== request.previousPrice

  const submit = async (approved: boolean) => {
    setError(null)
    if (!approved && notes.trim().length < PRICE_CHANGE_REASON_MIN_LENGTH) {
      setError(`Escribe el motivo del rechazo (mínimo ${PRICE_CHANGE_REASON_MIN_LENGTH} caracteres). El solicitante lo recibirá.`)
      return
    }
    setIsSubmitting(true)
    try {
      const result = await productService.reviewPriceChange(request.id, approved, notes)
      onReviewed(result.message, approved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la solicitud.')
      setConfirmAction(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="drawer-backdrop" onClick={() => !isSubmitting && onClose()}>
      <aside
        className="product-drawer price-review-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-review-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer-header">
          <div>
            <p className="eyebrow">Solicitud de cambio de precio</p>
            <h2 id="price-review-title">{request.productName}</h2>
            <small className="price-review-sub">
              SKU {request.productSku} · {request.priceListName}
            </small>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar detalle" disabled={isSubmitting}>
            <AppIcon name="close" size={20} />
          </button>
        </header>

        <div className="price-review-status">
          <PriceRequestStatusBadge status={request.status} />
        </div>

        <section className="price-review-compare" aria-label="Comparación de precios">
          <div>
            <span>Precio vigente al solicitar</span>
            <strong>{productService.formatCurrency(request.previousPrice)}</strong>
          </div>
          <AppIcon name="arrowRight" size={18} aria-hidden="true" />
          <div>
            <span>Precio propuesto</span>
            <strong className="is-proposed">{productService.formatCurrency(request.proposedPrice)}</strong>
          </div>
          <em className={isDown ? 'is-down' : 'is-up'}>{formatPriceVariation(request.variationPercent)}</em>
        </section>

        {currentPriceChanged && request.priceAtReview !== null && (
          <p className="info-banner-compact">
            <AppIcon name="info" size={14} />
            <span>Al revisarse, el precio vigente era {productService.formatCurrency(request.priceAtReview)}.</span>
          </p>
        )}

        <section className="drawer-section">
          <h3>Margen sobre costo</h3>
          {hasCost ? (
            <div className="price-review-margins">
              <MarginLine label="Con el precio actual" price={request.previousPrice} cost={cost as number} taxRate={request.taxRatePercent} />
              <MarginLine label="Con el precio propuesto" price={request.proposedPrice} cost={cost as number} taxRate={request.taxRatePercent} />
              <small className="field-hint">
                Costo de referencia {productService.formatCurrency(cost as number)} · IVA {request.taxRatePercent} %
              </small>
            </div>
          ) : (
            <p className="price-review-muted">El producto no tiene costo registrado; no se puede calcular el margen.</p>
          )}
        </section>

        <section className="drawer-section">
          <h3>Solicitud</h3>
          <dl className="price-review-facts">
            <div>
              <dt>Solicitante</dt>
              <dd>{request.requestedByName}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{formatRequestDate(request.requestedAt)}</dd>
            </div>
            <div className="is-wide">
              <dt>Motivo</dt>
              <dd>{request.reason || 'Sin motivo registrado'}</dd>
            </div>
            {request.status !== 'PENDING' && (
              <>
                <div>
                  <dt>{request.status === 'APPROVED' ? 'Aprobada por' : 'Rechazada por'}</dt>
                  <dd>{request.reviewedByName || 'Administrador'}</dd>
                </div>
                <div>
                  <dt>Fecha de revisión</dt>
                  <dd>{request.reviewedAt ? formatRequestDate(request.reviewedAt) : '—'}</dd>
                </div>
                {request.reviewNotes && (
                  <div className="is-wide">
                    <dt>{request.status === 'REJECTED' ? 'Motivo del rechazo' : 'Observación'}</dt>
                    <dd>{request.reviewNotes}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </section>

        {canApprove && request.status === 'PENDING' && isOwnRequest && (
          <p className="info-banner-compact">
            <AppIcon name="lock" size={14} />
            <span>No puedes aprobar ni rechazar una solicitud creada por ti. Otro administrador debe revisarla.</span>
          </p>
        )}

        {canReview && (
          <section className="drawer-section price-review-actions" aria-label="Decisión">
            <div className="form-field">
              <label htmlFor="price-review-notes">
                Observación <span className="field-hint">(obligatoria para rechazar)</span>
              </label>
              <textarea
                id="price-review-notes"
                className={`price-change-reason ${error ? 'is-invalid' : ''}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={500}
                disabled={isSubmitting}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'price-review-error' : undefined}
                placeholder="Ej.: Se aprueba por alza del proveedor / El margen queda por debajo del mínimo."
              />
            </div>

            {error && (
              <p id="price-review-error" className="form-error-banner" role="alert">
                <AppIcon name="warning" size={14} />
                <span>{error}</span>
              </p>
            )}

            {confirmAction === null ? (
              <div className="price-review-buttons">
                <button type="button" className="outline-button" onClick={() => setConfirmAction('REJECT')} disabled={isSubmitting}>
                  <AppIcon name="close" size={15} />
                  <span>Rechazar</span>
                </button>
                <button type="button" className="primary-button" onClick={() => setConfirmAction('APPROVE')} disabled={isSubmitting}>
                  <AppIcon name="check" size={15} />
                  <span>Aprobar y aplicar</span>
                </button>
              </div>
            ) : (
              <div className="price-review-confirm page-enter" role="alertdialog" aria-labelledby="price-review-confirm-text">
                <p id="price-review-confirm-text">
                  {confirmAction === 'APPROVE'
                    ? `Se aplicará ${productService.formatCurrency(request.proposedPrice)} como ${request.priceListName} de inmediato en ventas y catálogos.`
                    : 'La solicitud se rechazará y el solicitante recibirá el motivo.'}
                </p>
                <div className="price-review-buttons">
                  <button type="button" className="outline-button" onClick={() => setConfirmAction(null)} disabled={isSubmitting}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => submit(confirmAction === 'APPROVE')}
                    disabled={isSubmitting}
                    autoFocus
                  >
                    {isSubmitting ? 'Procesando...' : confirmAction === 'APPROVE' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </aside>
    </div>,
    document.body
  )
}
