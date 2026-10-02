'use client'

import React, { Suspense } from 'react'
import { AccountsReceivablePage } from '@/features/customers/components/AccountsReceivablePage'
import { AppShell } from '@/components/navigation/AppShell'

export default function CuentasPorCobrarRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="loading-state">Cargando cuentas por cobrar...</div>}>
        <AccountsReceivablePage />
      </Suspense>
    </AppShell>
  )
}
