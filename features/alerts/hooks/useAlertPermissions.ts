'use client'

import { useMemo } from 'react'
import { UserAlertContext, AlertPermission } from '../types'
import { DEFAULT_ALERT_USER } from '../services/alert.service'

export function useAlertPermissions(user: UserAlertContext = DEFAULT_ALERT_USER) {
  return useMemo(() => {
    const isSuperAdmin = user.role === 'SUPERADMIN'
    const has = (p: AlertPermission) => isSuperAdmin || user.permissions.includes(p)

    return {
      canRead: has('alerts.read'),
      canManage: has('alerts.manage'),
      canResolve: has('alerts.resolve'),
      canConfigure: has('alerts.configure'),
      canAudit: has('alerts.audit'),
      user,
    }
  }, [user])
}
