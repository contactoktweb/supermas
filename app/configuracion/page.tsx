'use client'

import React from 'react'
import { SettingsPage } from '@/features/settings/components/SettingsPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function ConfiguracionRoutePage() {
  return (
    <AppShell>
      <SettingsPage />
    </AppShell>
  )
}
