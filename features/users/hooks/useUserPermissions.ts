'use client'

import { useMemo } from 'react'
import { userService } from '../services/user.service'
import { UserPermission, UserRole } from '../types'

export function useUserPermissions(role: UserRole = 'SUPERADMIN') {
  return useMemo(() => {
    const can = (perm: UserPermission) => userService.hasUserPermission(perm, role)

    return {
      canRead: can('users.read'),
      canCreate: can('users.create'),
      canUpdate: can('users.update'),
      canActivate: can('users.activate'),
      canAssign: can('users.assign'),
      canViewActivity: can('users.view_activity'),
      canExport: can('users.export'),
      role,
    }
  }, [role])
}
