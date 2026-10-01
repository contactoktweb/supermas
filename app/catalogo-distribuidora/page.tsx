'use client'

import React from 'react'
import { DistributorCatalogPage } from '@/features/distributor-catalog/components/DistributorCatalogPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function CatalogoDistribuidoraRoutePage() {
  return (
    <AppShell>
      <DistributorCatalogPage />
    </AppShell>
  )
}
