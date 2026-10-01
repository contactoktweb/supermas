'use client'

import React, { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { SalesPage } from '@/features/sales/components/SalesPage'
import { AppShell } from '@/components/navigation/AppShell'

function SalesContent() {
  const router = useRouter()

  return (
    <SalesPage
      onNavigate={(targetView) => {
        if (targetView === 'Kardex') router.push('/kardex')
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

export default function SalesRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="loading-state">Cargando módulo de ventas...</div>}>
        <SalesContent />
      </Suspense>
    </AppShell>
  )
}
