'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CreateSaleResult } from '../types'

interface SaleCreatedNoticeProps {
  result: CreateSaleResult
  onViewDetail: () => void
  onDismiss: () => void
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

/** Confirmación de la venta registrada: número, total y comprobante contable generado por el servidor. */
export function SaleCreatedNotice({ result, onViewDetail, onDismiss }: SaleCreatedNoticeProps) {
  const { sale, accountingEntryNumber, idempotentReplay, documentWarning } = result

  return (
    <section
      className="page-enter"
      role="status"
      aria-live="polite"
      aria-label={`Venta ${sale.saleNumber} registrada`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 18px',
        borderRadius: 10,
        background: documentWarning ? '#fffbeb' : '#ecfdf5',
        border: `1px solid ${documentWarning ? '#fde68a' : '#a7f3d0'}`,
        color: documentWarning ? '#92400e' : '#065f46',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0, flex: '1 1 320px' }}>
        <AppIcon name={documentWarning ? 'warning' : 'check'} size={22} />
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontSize: 14, display: 'block' }}>
            {idempotentReplay ? 'La venta ya estaba registrada' : 'Venta registrada'}: {sale.saleNumber}
          </strong>
          <p style={{ margin: '2px 0 0', fontSize: 13 }}>
            Total {formatCOP(sale.totalAmount)}
            {accountingEntryNumber ? ` · Comprobante contable ${accountingEntryNumber}` : ''}
            {sale.invoiceNumber ? ` · Factura ${sale.invoiceNumber}` : ''}
            {sale.remissionNumber ? ` · Remisión ${sale.remissionNumber}` : ''}
          </p>
          {documentWarning && <p style={{ margin: '4px 0 0', fontSize: 13 }}>{documentWarning}</p>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button type="button" className="outline-button compact" onClick={onViewDetail}>
          <AppIcon name="eye" size={14} /> Ver detalle
        </button>
        <button type="button" className="icon-button" onClick={onDismiss} aria-label="Cerrar confirmación de venta">
          <AppIcon name="close" size={16} />
        </button>
      </div>
    </section>
  )
}
