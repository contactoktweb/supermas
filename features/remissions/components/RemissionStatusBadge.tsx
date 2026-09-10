'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { RemissionStatus } from '../types'

export function RemissionStatusBadge({
  status,
  showIcon = true,
  size = 'md',
}: {
  status: RemissionStatus
  showIcon?: boolean
  size?: 'sm' | 'md'
}) {
  const isSm = size === 'sm'
  const padding = isSm ? '2px 8px' : '4px 10px'
  const fontSize = isSm ? 11 : 12

  switch (status) {
    case 'DELIVERED':
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
          <span>Entregada</span>
        </span>
      )

    case 'DISPATCHED':
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
            background: 'rgba(37, 99, 235, 0.12)',
            color: '#1d4ed8',
            border: '1px solid rgba(37, 99, 235, 0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          {showIcon && <AppIcon name="transfers" size={isSm ? 12 : 14} color="#2563eb" />}
          <span>En tránsito</span>
        </span>
      )

    case 'CREATED':
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
          <span>Pendiente Despacho</span>
        </span>
      )

    case 'CANCELLED':
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
          {showIcon && <AppIcon name="close" size={isSm ? 12 : 14} color="#ef4444" />}
          <span>Anulada</span>
        </span>
      )

    case 'DRAFT':
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
            border: '1px solid #cbd5e1',
            whiteSpace: 'nowrap',
          }}
        >
          {showIcon && <AppIcon name="edit" size={isSm ? 12 : 14} color="#94a3b8" />}
          <span>Borrador</span>
        </span>
      )
  }
}
