'use client'

import { useMemo } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'

export interface HrPermissions {
  isLoading: boolean
  canRead: boolean
  canManage: boolean
  canDocuments: boolean
  canSensitive: boolean
}

/** Permisos del módulo (la seguridad real la aplican la RLS y las RPC de la migración 070). */
export function useHrPermissions(): HrPermissions {
  const { user, isLoading, hasPermission } = useAuth()

  return useMemo(
    () => ({
      isLoading,
      canRead: Boolean(user) && hasPermission('hr.read'),
      canManage: Boolean(user) && hasPermission('hr.manage'),
      canDocuments: Boolean(user) && hasPermission('hr.documents'),
      canSensitive: Boolean(user) && hasPermission('hr.sensitive'),
    }),
    [user, isLoading, hasPermission]
  )
}
