'use client'

import React, { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PurchasesPage } from '@/features/purchases/components/PurchasesPage'
import { AppShell } from '@/components/navigation/AppShell'

function PurchasesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleNavigate = (targetView: string) => {
    if (targetView.startsWith('/')) router.push(targetView)
    else if (targetView === 'Kardex') router.push('/kardex')
    else if (targetView === 'Inventario') router.push('/inventario')
    else if (targetView === 'Bodegas') router.push('/bodegas')
    else if (targetView === 'Transferencias') router.push('/transferencias')
    else router.push('/')
  }

  return <PurchasesPage onNavigate={handleNavigate} openReceiveSelector={searchParams.get('recibir') === '1'} />
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
