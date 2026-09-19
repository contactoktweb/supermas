'use client'

import { useMemo } from 'react'
import { auditService } from '../services/audit.service'
import { AuditPermission } from '../types'

export type UserRole = 'SUPERADMIN' | 'WAREHOUSE_ADMIN' | 'POINT_ADMIN' | 'ACCOUNTANT' | 'SELLER' | 'CASHIER'

export function useAuditPermissions(role: UserRole = 'SUPERADMIN') {
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
