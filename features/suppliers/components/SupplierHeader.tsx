'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'

interface SupplierHeaderProps {
  onNewSupplier: () => void
  onExport: () => void
}

export function SupplierHeader({ onNewSupplier, onExport }: SupplierHeaderProps) {
  return (
    <PageHeader
      eyebrow="Compras"
      title="Proveedores"
      subtitle="Administra proveedores, compras asociadas y obligaciones pendientes."
      actions={
        <>
          <button type="button" className="outline-button" onClick={onExport}>
            <AppIcon name="download" size={16} />
            <span>Exportar</span>
          </button>
          <button type="button" className="primary-button" onClick={onNewSupplier}>
            <AppIcon name="plus" size={16} />
            <span>Nuevo proveedor</span>
          </button>
        </>
      }
    />
  )
}
