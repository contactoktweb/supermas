'use client'

import React, { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { InvoicesPage } from '@/features/invoices/components/InvoicesPage'
import { AppShell } from '@/components/navigation/AppShell'

function InvoicesContent() {
  const router = useRouter()

  return (
    <InvoicesPage
      onNavigate={(targetView) => {
        if (targetView === 'Kardex') router.push('/kardex')
        else if (targetView === 'Ventas') router.push('/ventas')
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

export default function InvoicesRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="loading-state">Cargando módulo de facturación...</div>}>
        <InvoicesContent />
      </Suspense>
    </AppShell>
  )
}
