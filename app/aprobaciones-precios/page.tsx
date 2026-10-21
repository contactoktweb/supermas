'use client'

import React, { Suspense } from 'react'
import { AppShell } from '@/components/navigation/AppShell'
import { PriceApprovalsPage } from '@/features/products/components/price-approvals/PriceApprovalsPage'

export default function AprobacionesPreciosRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <PriceApprovalsPage />
      </Suspense>
    </AppShell>
  )
}
