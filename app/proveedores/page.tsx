'use client'

import React, { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { SuppliersPage } from '@/features/suppliers/components/SuppliersPage'
import { AppShell } from '@/components/navigation/AppShell'
import { useAuth } from '@/features/auth'

function SuppliersContent() {
  const router = useRouter()
  const { user } = useAuth()
  const permissionsKey = Array.isArray(user?.permissions) ? user.permissions.join(',') : ''
  // Contexto real del usuario: el servicio oculta costos y acciones según sus permisos.
  const userContext = React.useMemo(
    () =>
      user
        ? { userId: user.id, userName: user.fullName || user.email, userRole: user.roleCode, permissions: user.permissions || [] }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, user?.fullName, user?.email, user?.roleCode, permissionsKey]
  )

  return (
    <SuppliersPage
      userContext={userContext}
      onNavigate={(targetView) => {
        if (targetView === 'Compras') router.push('/compras')
        else if (targetView === 'Kardex') router.push('/kardex')
        else if (targetView === 'Inventario') router.push('/inventario')
        else if (targetView === 'Bodegas') router.push('/bodegas')
        else if (targetView === 'Transferencias') router.push('/transferencias')
        else router.push('/')
      }}
    />
  )
}

export default function SuppliersRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div style={{ padding: 32 }}>Cargando módulo de proveedores...</div>}>
        <SuppliersContent />
      </Suspense>
    </AppShell>
  )
}
