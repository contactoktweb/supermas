'use client'

import { useMemo } from 'react'
import { ExogenaPermission } from '../types'
import { exogenaService } from '../services/exogena.service'

export type UserRoleType =
  | 'SUPERADMIN'
  | 'STORE_ADMIN'
  | 'ACCOUNTANT'
  | 'CASHIER'
  | 'SELLER'

export interface ExogenaPermissions {
  canRead: boolean
  canConfigure: boolean
  canGenerate: boolean
  canValidate: boolean
  canExport: boolean
  canAudit: boolean
}

export function useExogenaPermissions(role: UserRoleType = 'SUPERADMIN'): ExogenaPermissions {
  return useMemo(() => {
    return {
      canRead: exogenaService.hasPermission('exogena.read', role),
      canConfigure: exogenaService.hasPermission('exogena.configure', role),
      canGenerate: exogenaService.hasPermission('exogena.generate', role),
      canValidate: exogenaService.hasPermission('exogena.validate', role),
      canExport: exogenaService.hasPermission('exogena.export', role),
      canAudit: exogenaService.hasPermission('exogena.audit', role),
    }
  }, [role])
}
