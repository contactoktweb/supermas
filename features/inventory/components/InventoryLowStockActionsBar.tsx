'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { InventoryTabFilter } from '../types'

interface InventoryLowStockActionsBarProps {
  activeTab: InventoryTabFilter
  count: number
  onOpenTransfer: () => void
  onOpenAdjust: () => void
}

export function InventoryLowStockActionsBar({
  activeTab,
  count,
  onOpenTransfer,
  onOpenAdjust,
}: InventoryLowStockActionsBarProps) {
  if (activeTab === 'ALL' || count === 0) return null

  const isCritical = activeTab === 'CRITICAL' || activeTab === 'OUT_OF_STOCK'

  return (
    <div className={`inventory-alert-actions-bar animate-fade-in ${isCritical ? 'critical-tone' : 'warning-tone'}`}>
      <div className="alert-bar-left">
        <div className="alert-bar-icon">
          <AppIcon name={isCritical ? 'warning' : 'info'} size={18} />
        </div>
        <div className="alert-bar-copy">
          <strong>
            {activeTab === 'OUT_OF_STOCK'
              ? `${count} producto(s) completamente agotados`
              : activeTab === 'CRITICAL'
              ? `${count} producto(s) en nivel crítico de desabastecimiento`
              : `${count} producto(s) por debajo del stock mínimo requerido`}
          </strong>
          <span>
            {activeTab === 'OUT_OF_STOCK'
              ? 'Se requiere generar pedidos de compra o traslados de emergencia de inmediato.'
              : 'Verifica la disponibilidad en bodegas alternas para abastecer los puntos de venta.'}
          </span>
        </div>
      </div>

      <div className="alert-bar-actions">
        <button
          type="button"
          className="outline-button compact action-btn-hover"
          onClick={onOpenTransfer}
        >
          <AppIcon name="transfers" size={13} />
          <span>Transferir desde otra bodega</span>
        </button>

        <button
          type="button"
          className="primary-button compact shadow-glow"
          onClick={onOpenAdjust}
        >
          <AppIcon name="sliders" size={13} />
          <span>Ajustar existencias</span>
        </button>
      </div>
    </div>
  )
}
