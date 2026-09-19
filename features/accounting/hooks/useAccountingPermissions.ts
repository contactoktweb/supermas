'use client'

import { useMemo } from 'react'
import { accountingService } from '../services/accounting.service'
import { AccountingPermission } from '../types'

export interface AccountingPermissions {
  canRead: boolean
  canManageAccounts: boolean
  canCreateEntries: boolean
  canConfirmEntries: boolean
  canCancelEntries: boolean
  canViewReports: boolean
  canViewCosts: boolean
  canManageConfig: boolean
}

export function useAccountingPermissions(userRole: string = 'SUPERADMIN'): AccountingPermissions {
  return useMemo(() => {
    return {
      canRead: accountingService.hasPermission('accounting.read', userRole),
      canManageAccounts: accountingService.hasPermission('accounting.accounts', userRole),
      canCreateEntries: accountingService.hasPermission('accounting.entries', userRole),
      canConfirmEntries: accountingService.hasPermission('accounting.confirm', userRole),
      canCancelEntries: accountingService.hasPermission('accounting.cancel', userRole),
      canViewReports: accountingService.hasPermission('accounting.reports', userRole),
      canViewCosts: accountingService.hasPermission('accounting.costs', userRole),
      canManageConfig: accountingService.hasPermission('accounting.config', userRole),
    }
  }, [userRole])
}
