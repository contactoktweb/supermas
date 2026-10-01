'use client'

import React from 'react'
import { RolesView } from '@/features/roles/components/RolesView'
import { AppShell } from '@/components/navigation/AppShell'

export default function RolesRoutePage() {
  return (
    <AppShell>
      <RolesView />
    </AppShell>
  )
}
