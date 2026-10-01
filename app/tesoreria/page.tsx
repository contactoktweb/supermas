'use client'

import React from 'react'
import { TreasuryPage } from '@/features/treasury/components/TreasuryPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function TesoreriaRoutePage() {
  return (
    <AppShell>
      <TreasuryPage />
    </AppShell>
  )
}
