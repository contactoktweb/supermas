'use client'

import React from 'react'
import { AuditPage } from '@/features/audit/components/AuditPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function AuditoriaRoutePage() {
  return (
    <AppShell>
      <AuditPage />
    </AppShell>
  )
}
