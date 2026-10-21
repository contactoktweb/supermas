import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { PriceChangeStatus } from '../../types'

const STATUS_CONFIG: Record<PriceChangeStatus, { label: string; icon: LightIconName; className: string }> = {
  PENDING: { label: 'Pendiente', icon: 'clock', className: 'is-pending' },
  APPROVED: { label: 'Aprobada', icon: 'check', className: 'is-approved' },
  REJECTED: { label: 'Rechazada', icon: 'close', className: 'is-rejected' },
}

export function PriceRequestStatusBadge({ status }: { status: PriceChangeStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <span className={`price-request-status ${config.className}`}>
      <AppIcon name={config.icon} size={12} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  )
}
