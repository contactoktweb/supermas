'use client'

import React, { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { CustomersPage } from '@/features/customers/components/CustomersPage'
import { AppShell } from '@/components/navigation/AppShell'

function CustomersContent() {
  const router = useRouter()

  return (
    <CustomersPage
      onNavigate={(targetView) => {
        if (targetView === 'Ventas') router.push('/ventas')
        else if (targetView === 'Facturación') router.push('/facturacion')
        else if (targetView === 'Compras') router.push('/compras')
        else if (targetView === 'Proveedores') router.push('/proveedores')
        else if (targetView === 'Kardex') router.push('/kardex')
        else if (targetView === 'Inventario') router.push('/inventario')
        else if (targetView === 'Bodegas') router.push('/bodegas')
        else if (targetView === 'Transferencias') router.push('/transferencias')
        else router.push('/')
      }}
    />
  )
}

export default function CustomersRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="loading-state">Cargando directorio de clientes...</div>}>
        <CustomersContent />
      </Suspense>
    </AppShell>
  )
}
