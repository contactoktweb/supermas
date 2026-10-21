'use client'

import { useMemo } from 'react'
import { useAuth } from '@/features/auth'
import { UserRole } from '../types'
import { getAssignableRoles } from '../services/role-assignment'

export function useUserPermissions(role?: UserRole) {
  const { user, hasPermission } = useAuth()
  const effectiveRole = (role || user?.roleCode || 'SUPERADMIN') as UserRole

  const actorRoleCode = user?.roleCode

  return useMemo(() => {
    // Crear un usuario implica asignarle un rol: solo quien puede asignar roles (ADMIN/SUPERADMIN).
    const canAssignRoles = getAssignableRoles(actorRoleCode).length > 0
    return {
      canRead: hasPermission('users.read'),
      canCreate: hasPermission('users.create') && canAssignRoles,
      canAssignRoles,
      canUpdate: hasPermission('users.update'),
      canActivate: hasPermission('users.activate'),
      canAssign: hasPermission('users.assign'),
      canViewActivity: hasPermission('users.view_activity'),
      canExport: hasPermission('users.export'),
      role: effectiveRole,
    }
  }, [hasPermission, effectiveRole, actorRoleCode])
}
