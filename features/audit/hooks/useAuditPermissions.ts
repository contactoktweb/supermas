'use client'

import { useMemo } from 'react'
import { auditService } from '../services/audit.service'
import { AuditPermission } from '../types'
import { useAuth } from '@/features/auth'

export type UserRole = 'SUPERADMIN' | 'WAREHOUSE_ADMIN' | 'POINT_ADMIN' | 'ACCOUNTANT' | 'SELLER' | 'CASHIER'

export function useAuditPermissions(roleOverride?: UserRole) {
  const { user } = useAuth()
  const role: UserRole = roleOverride || (user?.roleCode as UserRole) || 'SUPERADMIN'

  return useMemo(() => {
    const can = (perm: AuditPermission) => auditService.hasPermission(perm, role)

    return {
      canRead: can('audit.read'),
      canExport: can('audit.export'),
      canViewCritical: can('audit.critical'),
      canViewSecurity: can('audit.security'),
      canConfigure: can('audit.config'),
      role,
    }
  }, [role])
}
