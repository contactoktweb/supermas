'use client'

import React from 'react'
import { ExogenaPage } from '@/features/exogena/components/ExogenaPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function ExogenaRoutePage() {
  return (
    <AppShell>
      <ExogenaPage />
    </AppShell>
  )
}
