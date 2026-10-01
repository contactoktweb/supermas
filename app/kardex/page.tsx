'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { KardexPage } from '@/features/kardex/components/KardexPage'
import { AppShell } from '@/components/navigation/AppShell'

function KardexContent() {
  const searchParams = useSearchParams()
  const productId = searchParams.get('productId') || undefined
  const locationId = searchParams.get('locationId') || undefined

  return (
    <KardexPage
      initialProductId={productId}
      initialLocationId={locationId}
    />
  )
}

export default function KardexRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div style={{ padding: 24 }}>Cargando Kardex...</div>}>
        <KardexContent />
      </Suspense>
    </AppShell>
  )
}
