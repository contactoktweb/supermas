'use client'

import React, { Suspense } from 'react'
import { CustomerPaymentsListPage } from '@/features/customers/components/CustomerPaymentsListPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function PagosRecibidosRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="loading-state">Cargando pagos recibidos...</div>}>
        <CustomerPaymentsListPage />
      </Suspense>
    </AppShell>
  )
}
