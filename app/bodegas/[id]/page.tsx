'use client'

import React, { use } from 'react'
import { useRouter } from 'next/navigation'
import { WarehouseDetailPage } from '@/features/warehouses/components/detail/WarehouseDetailPage'
import { AppShell } from '@/components/navigation/AppShell'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function WarehouseDetailRoutePage({ params }: PageProps) {
  const resolvedParams = use(params)
  const router = useRouter()

  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Inventario' },
    { label: 'Bodegas', href: '/bodegas' },
    { label: 'Detalle de Sede' },
  ]

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <WarehouseDetailPage
        warehouseId={resolvedParams.id}
        onBack={() => router.push('/bodegas')}
      />
    </AppShell>
  )
}
