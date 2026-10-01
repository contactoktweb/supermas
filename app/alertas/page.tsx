'use client'

import React from 'react'
import { AlertsPage } from '@/features/alerts/components/AlertsPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function AlertasRoutePage() {
  return (
    <AppShell>
      <AlertsPage />
    </AppShell>
  )
}
