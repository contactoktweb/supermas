'use client'

import React from 'react'
import { UsersPage } from '@/features/users/components/UsersPage'
import { AppShell } from '@/components/navigation/AppShell'
import { useAuth } from '@/features/auth'

export default function UsuariosRoutePage() {
  const { user } = useAuth()

  return (
    <AppShell>
      <UsersPage currentRole={user?.roleCode || 'SUPERADMIN'} />
    </AppShell>
  )
}
