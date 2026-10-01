'use client'

import React from 'react'
import { TaxPage } from '@/features/taxes/components/TaxPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function ImpuestosRoutePage() {
  return (
    <AppShell>
      <TaxPage />
    </AppShell>
  )
}
