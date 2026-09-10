'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { DIANStatus, InvoiceStatus, InvoiceType } from '../types'

export function DIANStatusBadge({
  status,
  showIcon = true,
  size = 'md',
}: {
  status: DIANStatus
  showIcon?: boolean
  size?: 'sm' | 'md'
}) {
  const isSm = size === 'sm'
  const padding = isSm ? '2px 8px' : '4px 10px'
  const fontSize = isSm ? 11 : 12

  switch (status) {
    case 'ACEPTADA':
    case 'VALIDADA_DIAN':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding,
            borderRadius: 20,
            fontSize,
            fontWeight: 700,
            background: 'rgba(16, 185, 129, 0.12)',
            color: '#065f46',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          {showIcon && <AppIcon name="check" size={isSm ? 12 : 14} color="#10b981" />}
          <span>Aceptada DIAN</span>
        </span>
      )

    case 'PENDIENTE':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding,
            borderRadius: 20,
            fontSize,
            fontWeight: 700,
            background: 'rgba(245, 158, 11, 0.12)',
            color: '#b45309',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          {showIcon && <AppIcon name="clock" size={isSm ? 12 : 14} color="#f59e0b" />}
          <span>Pendiente DIAN</span>
        </span>
      )

    case 'RECHAZADA':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding,
            borderRadius: 20,
            fontSize,
            fontWeight: 700,
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#b91c1c',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          {showIcon && <AppIcon name="warning" size={isSm ? 12 : 14} color="#ef4444" />}
          <span>Rechazada DIAN</span>
        </span>
      )

    case 'NO_APLICA':
    default:
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding,
            borderRadius: 20,
            fontSize,
            fontWeight: 600,
            background: '#f1f5f9',
            color: '#64748b',
            border: '1px solid #e2e8f0',
            whiteSpace: 'nowrap',
          }}
        >
          {showIcon && <AppIcon name="info" size={isSm ? 12 : 14} color="#94a3b8" />}
          <span>No aplica</span>
        </span>
      )
  }
}

export function InvoiceTypeBadge({
  type,
  size = 'md',
}: {
  type: InvoiceType
  size?: 'sm' | 'md'
}) {
  const isSm = size === 'sm'
  const padding = isSm ? '2px 8px' : '4px 10px'
  const fontSize = isSm ? 11 : 12

  switch (type) {
    case 'ELECTRONICA':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding,
            borderRadius: 6,
            fontSize,
            fontWeight: 700,
            background: 'rgba(0, 27, 92, 0.08)',
            color: 'var(--navy, #001b5c)',
            border: '1px solid rgba(0, 27, 92, 0.2)',
            whiteSpace: 'nowrap',
          }}
        >
          <AppIcon name="webOrders" size={isSm ? 12 : 14} color="var(--navy, #001b5c)" />
          <span>Electrónica</span>
        </span>
      )

    case 'POS':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding,
            borderRadius: 6,
            fontSize,
            fontWeight: 700,
            background: 'rgba(37, 99, 235, 0.08)',
            color: '#1d4ed8',
            border: '1px solid rgba(37, 99, 235, 0.2)',
            whiteSpace: 'nowrap',
          }}
        >
          <AppIcon name="pos" size={isSm ? 12 : 14} color="#1d4ed8" />
          <span>POS</span>
        </span>
      )

    case 'NOTA_CREDITO':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding,
            borderRadius: 6,
            fontSize,
            fontWeight: 700,
            background: 'rgba(254, 17, 12, 0.08)',
            color: 'var(--red, #fe110c)',
            border: '1px solid rgba(254, 17, 12, 0.25)',
            whiteSpace: 'nowrap',
          }}
        >
          <AppIcon name="receipt" size={isSm ? 12 : 14} color="var(--red, #fe110c)" />
          <span>Nota Crédito</span>
        </span>
      )

    case 'NOTA_DEBITO':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding,
            borderRadius: 6,
            fontSize,
            fontWeight: 700,
            background: 'rgba(139, 92, 246, 0.08)',
            color: '#6d28d9',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            whiteSpace: 'nowrap',
          }}
        >
          <AppIcon name="fileText" size={isSm ? 12 : 14} color="#6d28d9" />
          <span>Nota Débito</span>
        </span>
      )

    case 'DOCUMENTO_EQUIVALENTE':
    default:
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding,
            borderRadius: 6,
            fontSize,
            fontWeight: 700,
            background: '#f8fafc',
            color: '#475569',
            border: '1px solid #cbd5e1',
            whiteSpace: 'nowrap',
          }}
        >
          <AppIcon name="invoices" size={isSm ? 12 : 14} color="#64748b" />
          <span>Doc. Equiv.</span>
        </span>
      )
  }
}

export function InvoiceStatusBadge({
  status,
  size = 'md',
}: {
  status: InvoiceStatus
  size?: 'sm' | 'md'
}) {
  const isSm = size === 'sm'
  const padding = isSm ? '2px 8px' : '3px 10px'
  const fontSize = isSm ? 11 : 12

  switch (status) {
    case 'PAID':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding,
            borderRadius: 12,
            fontSize,
            fontWeight: 700,
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
          }}
        >
          ● Pagada
        </span>
      )

    case 'PAYMENT_PENDING':
    case 'PARTIALLY_PAID':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding,
            borderRadius: 12,
            fontSize,
            fontWeight: 700,
            background: '#fffbeb',
            color: '#92400e',
            border: '1px solid #fde68a',
          }}
        >
          ● {status === 'PARTIALLY_PAID' ? 'Pago Parcial' : 'Por Cobrar'}
        </span>
      )

    case 'ISSUED':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding,
            borderRadius: 12,
            fontSize,
            fontWeight: 700,
            background: '#eff6ff',
            color: '#1e40af',
            border: '1px solid #bfdbfe',
          }}
        >
          ● Emitida
        </span>
      )

    case 'CANCELLED':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding,
            borderRadius: 12,
            fontSize,
            fontWeight: 700,
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
          }}
        >
          ● Anulada
        </span>
      )

    case 'DRAFT':
    default:
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding,
            borderRadius: 12,
            fontSize,
            fontWeight: 600,
            background: '#f1f5f9',
            color: '#475569',
            border: '1px solid #cbd5e1',
          }}
        >
          ● Borrador
        </span>
      )
  }
}
