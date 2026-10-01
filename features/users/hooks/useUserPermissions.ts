'use client'

import { useMemo } from 'react'
import { useAuth } from '@/features/auth'
import { UserRole } from '../types'

export function useUserPermissions(role?: UserRole) {
  const { user, hasPermission } = useAuth()
  const effectiveRole = (role || user?.roleCode || 'SUPERADMIN') as UserRole

  return useMemo(() => {
    return {
      canRead: hasPermission('users.read'),
      canCreate: hasPermission('users.create'),
      canUpdate: hasPermission('users.update'),
      canActivate: hasPermission('users.activate'),
      canAssign: hasPermission('users.assign'),
      canViewActivity: hasPermission('users.view_activity'),
      canExport: hasPermission('users.export'),
      role: effectiveRole,
    }
  }, [hasPermission, effectiveRole])
}
