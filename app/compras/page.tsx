'use client'

import React, { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { PurchasesPage } from '@/features/purchases/components/PurchasesPage'
import { AppShell } from '@/components/navigation/AppShell'

function PurchasesContent() {
  const router = useRouter()

  const handleNavigate = (targetView: string) => {
    if (targetView === 'Kardex') router.push('/kardex')
    else if (targetView === 'Inventario') router.push('/inventario')
    else if (targetView === 'Bodegas') router.push('/bodegas')
    else if (targetView === 'Transferencias') router.push('/transferencias')
    else router.push('/')
  }

  return <PurchasesPage onNavigate={handleNavigate} />
}

export default function PurchasesRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div style={{ padding: 32 }}>Cargando módulo de compras...</div>}>
        <PurchasesContent />
      </Suspense>
    </AppShell>
  )
}
