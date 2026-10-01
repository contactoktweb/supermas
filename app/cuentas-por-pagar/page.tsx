'use client'

import React, { Suspense } from 'react'
import { AccountsPayablePage } from '@/features/purchases/components/AccountsPayablePage'
import { AppShell } from '@/components/navigation/AppShell'

export default function AccountsPayableRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div style={{ padding: 32 }}>Cargando Cuentas por Pagar...</div>}>
        <AccountsPayablePage />
      </Suspense>
    </AppShell>
  )
}
