'use client'

import { CashSessionsPage } from '@/features/pos/components/CashSessionsPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function CajasRoutePage() {
  return (
    <AppShell>
      <CashSessionsPage />
    </AppShell>
  )
}
