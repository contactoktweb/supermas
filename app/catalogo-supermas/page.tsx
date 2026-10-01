'use client'

import React from 'react'
import { SuperCatalogPage } from '@/features/super-catalog/components/SuperCatalogPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function CatalogoSuperMasRoutePage() {
  return (
    <AppShell>
      <SuperCatalogPage />
    </AppShell>
  )
}
