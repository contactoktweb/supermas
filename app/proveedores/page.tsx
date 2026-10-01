'use client'

import React, { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { SuppliersPage } from '@/features/suppliers/components/SuppliersPage'
import { AppShell } from '@/components/navigation/AppShell'

function SuppliersContent() {
  const router = useRouter()

  return (
    <SuppliersPage
      onNavigate={(targetView) => {
        if (targetView === 'Compras') router.push('/compras')
        else if (targetView === 'Kardex') router.push('/kardex')
        else if (targetView === 'Inventario') router.push('/inventario')
        else if (targetView === 'Bodegas') router.push('/bodegas')
        else if (targetView === 'Transferencias') router.push('/transferencias')
        else router.push('/')
      }}
    />
  )
}

export default function SuppliersRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div style={{ padding: 32 }}>Cargando módulo de proveedores...</div>}>
        <SuppliersContent />
      </Suspense>
    </AppShell>
  )
}
