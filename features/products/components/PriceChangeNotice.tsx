'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { PriceChangeInput } from '../types'
import { productService, PRICE_CHANGE_REASON_MIN_LENGTH } from '../services/product.service'
import { calculatePriceVariation, formatPriceVariation } from '../utils/price-change-plan'

interface PriceChangeNoticeProps {
  changes: PriceChangeInput[]
  /** true: el usuario no aprueba precios y el cambio quedará pendiente. */
  requiresApproval: boolean
  reason: string
  onReasonChange: (value: string) => void
  error?: string
}

const REASON_FIELD_ID = 'price-change-reason'

export function PriceChangeNotice({
  changes,
  requiresApproval,
  reason,
  onReasonChange,
  error,
}: PriceChangeNoticeProps) {
  return (
    <section
      className={`price-change-notice page-enter ${requiresApproval ? 'is-pending' : 'is-direct'}`}
      aria-labelledby="price-change-notice-title"
    >
      <div className="price-change-notice-head">
        <span className="price-change-notice-icon" aria-hidden="true">
          <AppIcon name={requiresApproval ? 'clock' : 'shield'} size={18} />
        </span>
        <div>
          <h3 id="price-change-notice-title">
            {requiresApproval ? 'Este cambio de precio requiere aprobación' : 'Cambio de precio con auditoría'}
          </h3>
          <p>
            {requiresApproval
              ? 'Al guardar, los demás datos del producto se actualizan de inmediato. El precio vigente no cambia hasta que un administrador apruebe la solicitud; se le notificará automáticamente.'
              : 'Como administrador, el nuevo precio se aplica de inmediato y queda registrado en la pista de auditoría.'}
          </p>
        </div>
      </div>

      <ul className="price-change-list">
        {changes.map((change) => {
          const variation = calculatePriceVariation(change.currentPrice, change.proposedPrice)
          return (
            <li key={change.priceListCode}>
              <span className="price-change-list-name">{change.priceListName}</span>
              <span className="price-change-list-values">
                <s>{change.currentPrice === null || change.currentPrice === undefined ? 'Sin precio' : productService.formatCurrency(change.currentPrice)}</s>
                <AppIcon name="arrowRight" size={14} aria-hidden="true" />
                <strong>{productService.formatCurrency(change.proposedPrice)}</strong>
                <em className={variation !== null && variation < 0 ? 'is-down' : 'is-up'}>
                  {formatPriceVariation(variation)}
                </em>
              </span>
            </li>
          )
        })}
      </ul>

      <div className="form-field" style={{ marginBottom: 0 }}>
        <label htmlFor={REASON_FIELD_ID}>
          {requiresApproval ? (
            <>
              Motivo del cambio de precio <span className="req">*</span>
            </>
          ) : (
            'Motivo del cambio (opcional, queda en auditoría)'
          )}
        </label>
        <textarea
          id={REASON_FIELD_ID}
          className={`price-change-reason ${error ? 'is-invalid' : ''}`}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={2}
          maxLength={500}
          required={requiresApproval}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${REASON_FIELD_ID}-error` : undefined}
          placeholder="Ej.: El proveedor subió el costo de compra un 8 %."
        />
        {error ? (
          <span id={`${REASON_FIELD_ID}-error`} className="field-error-text" role="alert">
            {error}
          </span>
        ) : (
          requiresApproval && (
            <small className="field-hint">Mínimo {PRICE_CHANGE_REASON_MIN_LENGTH} caracteres. El administrador lo verá al decidir.</small>
          )
        )}
      </div>
    </section>
  )
}
