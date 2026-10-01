'use client'

import React from 'react'
import { WarehousePage } from '@/features/warehouses/components/WarehousePage'
import { AppShell } from '@/components/navigation/AppShell'

export default function BodegasRoutePage() {
  return (
    <AppShell>
      <WarehousePage />
    </AppShell>
  )
}
