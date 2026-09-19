/**
 * SUPER MÁS ERP/POS - Hook de Permisos del Módulo Configuración
 */

import { useMemo } from 'react'
import { SettingsPermission, UserSettingsContext } from '../types'
import { DEFAULT_SETTINGS_USER } from '../services/settings.service'

export function useSettingsPermissions(user: UserSettingsContext = DEFAULT_SETTINGS_USER) {
  return useMemo(() => {
    const isSuperAdmin = user.role === 'SUPERADMIN'

    const has = (permission: SettingsPermission): boolean => {
      if (isSuperAdmin) return true
      return user.permissions.includes(permission)
    }

    return {
      canRead: has('settings.read'),
      canUpdate: has('settings.update'),
      canEditCompany: has('settings.company') && has('settings.update'),
      canEditInventory: has('settings.inventory') && has('settings.update'),
      canEditEcommerce: has('settings.ecommerce') && has('settings.update'),
      canEditBilling: has('settings.billing') && has('settings.update'),
      canEditTax: has('settings.tax') && has('settings.update'),
      canEditAccounting: has('settings.accounting') && has('settings.update'),
      canEditAlerts: has('settings.alerts') && has('settings.update'),
      canEditSecurity: has('settings.security') && has('settings.update'),
      isSuperAdmin,
    }
  }, [user])
}
