'use client'

import React, { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { RemissionsPage } from '@/features/remissions/components/RemissionsPage'
import { AppShell } from '@/components/navigation/AppShell'

function RemissionsContent() {
  const router = useRouter()

  return (
    <RemissionsPage
      onNavigate={(targetView) => {
        if (targetView === 'Kardex') router.push('/kardex')
        else if (targetView === 'Ventas') router.push('/ventas')
        else if (targetView === 'Facturación') router.push('/facturacion')
        else if (targetView === 'Clientes') router.push('/clientes')
        else if (targetView === 'Compras') router.push('/compras')
        else if (targetView === 'Proveedores') router.push('/proveedores')
        else if (targetView === 'Inventario') router.push('/inventario')
        else if (targetView === 'Bodegas') router.push('/bodegas')
        else if (targetView === 'Transferencias') router.push('/transferencias')
        else router.push('/')
      }}
    />
  )
}

export default function RemissionsRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="loading-state">Cargando módulo de remisiones...</div>}>
        <RemissionsContent />
      </Suspense>
    </AppShell>
  )
}
