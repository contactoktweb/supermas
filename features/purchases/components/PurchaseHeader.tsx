'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'

interface PurchaseHeaderProps {
  onNewPurchase: () => void
  onQuickReceive: () => void
  onExport: () => void
}

export function PurchaseHeader({ onNewPurchase, onQuickReceive, onExport }: PurchaseHeaderProps) {
  return (
    <PageHeader
      eyebrow="Compras"
      title="Órdenes de compra"
      subtitle="Registra compras a proveedores, recibe la mercancía en bodega y controla lo pendiente por pagar."
      actions={
        <>
          <button type="button" className="outline-button" onClick={onExport}>
            <AppIcon name="download" size={16} />
            <span>Exportar</span>
          </button>
          <button type="button" className="outline-button" onClick={onQuickReceive}>
            <AppIcon name="warehouse" size={16} />
            <span>Registrar recepción</span>
          </button>
          <button type="button" className="primary-button" onClick={onNewPurchase}>
            <AppIcon name="plus" size={16} />
            <span>Nueva compra</span>
          </button>
        </>
      }
    />
  )
}
