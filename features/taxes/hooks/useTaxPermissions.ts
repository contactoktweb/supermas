'use client'

import { useMemo } from 'react'
import { TaxPermission } from '../types'
import { taxService } from '../services/tax.service'

export type UserRoleType =
  | 'SUPERADMIN'
  | 'STORE_ADMIN'
  | 'ACCOUNTANT'
  | 'CASHIER'
  | 'SELLER'

export interface TaxPermissions {
  canReadTax: boolean
  canCreateTax: boolean
  canUpdateTax: boolean
  canDeactivateTax: boolean
  canAssignTax: boolean
  canReportTax: boolean
  canExportTax: boolean
}

export function useTaxPermissions(role: UserRoleType = 'SUPERADMIN'): TaxPermissions {
  return useMemo(() => {
    return {
      canReadTax: taxService.hasPermission('tax.read', role),
      canCreateTax: taxService.hasPermission('tax.create', role),
      canUpdateTax: taxService.hasPermission('tax.update', role),
      canDeactivateTax: taxService.hasPermission('tax.deactivate', role),
      canAssignTax: taxService.hasPermission('tax.assign', role),
      canReportTax: taxService.hasPermission('tax.report', role),
      canExportTax: taxService.hasPermission('tax.export', role),
    }
  }, [role])
}
