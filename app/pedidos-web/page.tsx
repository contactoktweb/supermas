'use client'

import React from 'react'
import { WebOrdersPage } from '@/features/web-orders/components/WebOrdersPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function PedidosWebRoutePage() {
  return (
    <AppShell>
      <WebOrdersPage />
    </AppShell>
  )
}
