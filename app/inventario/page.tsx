'use client'

import React, { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { InventoryPage } from '@/features/inventory/components/InventoryPage'
import { AppShell } from '@/components/navigation/AppShell'

function InventoryRouteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const locationId = searchParams.get('locationId') || undefined
  const status = searchParams.get('status') || undefined

  const handleNavigate = (view: string, params?: Record<string, string>) => {
    if (view === 'Kardex') {
      const qs = params ? new URLSearchParams(params).toString() : ''
      router.push(`/kardex${qs ? `?${qs}` : ''}`)
    } else if (view === 'Bodegas') {
      router.push('/bodegas')
    } else if (view === 'Productos') {
      router.push('/productos')
    } else {
      router.push('/')
    }
  }

  return (
    <InventoryPage
      initialLocationId={locationId}
      initialStatus={status}
      onNavigate={handleNavigate}
    />
  )
}

export default function InventoryRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div style={{ padding: 24 }}>Cargando inventario...</div>}>
        <InventoryRouteContent />
      </Suspense>
    </AppShell>
  )
}
