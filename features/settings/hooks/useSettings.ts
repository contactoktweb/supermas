/**
 * SUPER MÁS ERP/POS - Estado y acciones del módulo Configuración General.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth'
import { extractErrorMessage } from '@/lib/utils'
import { settingsRepository } from '../repositories/settings.repository'
import { settingsService } from '../services/settings.service'
import type {
  AccountingOverview,
  CashSettings,
  CompanySettings,
  EcommerceSettings,
  FiscalOverview,
  GeneralSettings,
  InventorySettings,
  LocationOption,
  POSSettings,
  RoleSummary,
  SettingsCategory,
  SettingsStats,
  UserSettingsContext,
} from '../types'

export interface SettingsData {
  company: CompanySettings | null
  inventory: InventorySettings
  pos: POSSettings
  cash: CashSettings
  ecommerce: EcommerceSettings
  general: GeneralSettings
  locations: LocationOption[]
  fiscal: FiscalOverview
  accounting: AccountingOverview
  roles: RoleSummary[]
  stats: SettingsStats
}

type Toast = { message: string; type: 'success' | 'error' }
const TOAST_MS = 4000

export function useSettings() {
  const { user: authUser } = useAuth()
  const currentUser: UserSettingsContext = useMemo(
    () => ({
      userId: authUser?.id || '',
      name: authUser?.fullName || 'Usuario',
      role: authUser?.roleCode || '',
      permissions: (authUser?.permissions as string[]) || [],
    }),
    [authUser]
  )

  const [data, setData] = useState<SettingsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  const loadAll = useCallback(async () => {
    try {
      setIsLoading(true)
      const [company, operational, locations, fiscal, accounting, roles] = await Promise.all([
        settingsRepository.getCompanySettings(),
        settingsRepository.getOperationalSettings(),
        settingsRepository.getLocations(),
        settingsRepository.getFiscalOverview(),
        settingsRepository.getAccountingOverview(),
        settingsRepository.getRoles(),
      ])
      const stats = await settingsRepository.getStats(roles.length, locations.length)
      setData({
        company,
        inventory: operational.inventory,
        pos: operational.pos,
        cash: operational.cash,
        ecommerce: {
          ...operational.ecommerce,
          dispatchLocationId: locations.find((loc) => loc.isEcommerceSource)?.id ?? '',
        },
        general: operational.general,
        locations,
        fiscal,
        accounting,
        roles,
        stats,
      })
    } catch (err) {
      showToast(extractErrorMessage(err, 'No se pudo cargar la configuración.'), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  /** Ejecuta un guardado, muestra el resultado y recarga desde la base; devuelve si tuvo éxito. */
  const run = useCallback(
    async (action: () => Promise<unknown>, successMessage: string): Promise<boolean> => {
      try {
        setIsSaving(true)
        await action()
        showToast(successMessage)
        await loadAll()
        return true
      } catch (err) {
        showToast(extractErrorMessage(err, 'No se pudo guardar la configuración.'), 'error')
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [loadAll, showToast]
  )

  const actions = useMemo(
    () => ({
      saveCompany: (value: CompanySettings) =>
        run(() => settingsService.saveCompany(value, data?.company ?? null, currentUser), 'Información de la empresa guardada'),
      saveInventory: (value: InventorySettings) =>
        run(() => settingsService.saveInventory(value, data!.inventory, currentUser), 'Parámetros de inventario guardados'),
      savePOS: (value: POSSettings) =>
        run(() => settingsService.savePOS(value, data!.pos, currentUser), 'Parámetros del punto de venta guardados'),
      saveCash: (value: CashSettings) =>
        run(() => settingsService.saveCash(value, data!.cash, currentUser), 'Reglas de caja guardadas'),
      saveEcommerce: (value: EcommerceSettings) =>
        run(() => settingsService.saveEcommerce(value, data!.ecommerce, currentUser), 'Canales web guardados'),
      saveGeneral: (value: GeneralSettings) =>
        run(() => settingsService.saveGeneral(value, data!.general, currentUser), 'Parámetros guardados'),
    }),
    [run, data, currentUser]
  )

  return {
    data,
    isLoading,
    isSaving,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    toast,
    refresh: loadAll,
    ...actions,
  }
}
