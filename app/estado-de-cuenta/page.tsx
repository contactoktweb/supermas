'use client'

import React, { Suspense } from 'react'
import { CustomerStatementPage } from '@/features/customers/components/CustomerStatementPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function EstadoDeCuentaRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="loading-state">Cargando estado de cuenta...</div>}>
        <CustomerStatementPage />
      </Suspense>
    </AppShell>
  )
}
