'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { TransferPage } from '@/features/transfers/components/TransferPage'
import { AppShell } from '@/components/navigation/AppShell'

function TransferContent() {
  const searchParams = useSearchParams()
  const locationId = searchParams.get('locationId') || undefined
  const productId = searchParams.get('productId') || undefined
  const direction = (searchParams.get('direction') as any) || 'ALL'

  return (
    <TransferPage
      initialLocationId={locationId}
      initialProductId={productId}
      initialDirection={direction}
    />
  )
}

export default function TransferRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div style={{ padding: 32 }}>Cargando módulo de transferencias...</div>}>
        <TransferContent />
      </Suspense>
    </AppShell>
  )
}
