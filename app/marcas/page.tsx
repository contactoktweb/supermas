'use client'

import React from 'react'
import { BrandPage } from '@/features/brands/components/BrandPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function MarcasRoutePage() {
  return (
    <AppShell>
      <BrandPage />
    </AppShell>
  )
}
