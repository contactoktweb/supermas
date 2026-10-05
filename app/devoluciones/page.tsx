'use client'

import React, { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { ReturnsPage } from '@/features/returns/components/ReturnsPage'
import { AppShell } from '@/components/navigation/AppShell'

function ReturnsContent() {
  const router = useRouter()

  return (
    <ReturnsPage
      onNavigate={(targetView) => {
        if (targetView === 'Kardex') router.push('/kardex')
        else if (targetView === 'Ventas') router.push('/ventas')
        else if (targetView === 'Compras') router.push('/compras')
        else if (targetView === 'Remisiones') router.push('/remisiones')
        else if (targetView === 'Clientes') router.push('/clientes')
        else if (targetView === 'Proveedores') router.push('/proveedores')
        else if (targetView === 'Inventario') router.push('/inventario')
        else router.push('/')
      }}
    />
  )
}

export default function ReturnsRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-8 text-center text-slate-500">Cargando módulo de devoluciones...</div>}>
        <ReturnsContent />
      </Suspense>
    </AppShell>
  )
}
