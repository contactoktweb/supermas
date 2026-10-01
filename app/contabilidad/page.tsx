'use client'

import React from 'react'
import { AccountingPage } from '@/features/accounting/components/AccountingPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function ContabilidadRoutePage() {
  return (
    <AppShell>
      <AccountingPage />
    </AppShell>
  )
}
