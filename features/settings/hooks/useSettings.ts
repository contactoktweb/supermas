/**
 * SUPER MÁS ERP/POS - Hook de Estado y Lógica del Módulo Configuración
 */

import { useState, useEffect, useCallback } from 'react'
import {
  CompanySettings,
  InventorySettings,
  POSSettings,
  EcommerceSettings,
  SystemSettingItem,
  SettingsStats,
  SettingChangeHistory,
  SettingsCategory,
  UserSettingsContext,
} from '../types'
import { settingsService, DEFAULT_SETTINGS_USER } from '../services/settings.service'

export interface CriticalModalState {
  isOpen: boolean
  title: string
  message: string
  fieldLabel: string
  previousValue: string
  newValue: string
  onConfirm: () => Promise<void>
}

export function useSettings(user: UserSettingsContext = DEFAULT_SETTINGS_USER) {
  const [stats, setStats] = useState<SettingsStats | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [inventorySettings, setInventorySettings] = useState<InventorySettings | null>(null)
  const [posSettings, setPOSSettings] = useState<POSSettings | null>(null)
  const [ecommerceSettings, setEcommerceSettings] = useState<EcommerceSettings | null>(null)
  const [systemSettings, setSystemSettings] = useState<SystemSettingItem[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [history, setHistory] = useState<SettingChangeHistory[]>([])

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const [criticalModal, setCriticalModal] = useState<CriticalModalState>({
    isOpen: false,
    title: '',
    message: '',
    fieldLabel: '',
    previousValue: '',
    newValue: '',
    onConfirm: async () => {},
  })

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const loadAll = useCallback(async () => {
    try {
      setIsLoading(true)
      const [
        st,
        comp,
        inv,
        pos,
        ecom,
        sys,
        rls,
        hist,
      ] = await Promise.all([
        settingsService.getStats(user),
        settingsService.getCompanySettings(user),
        settingsService.getInventorySettings(user),
        settingsService.getPOSSettings(user),
        settingsService.getEcommerceSettings(user),
        settingsService.getSystemSettings(undefined, user),
        settingsService.getPredefinedRoles(user),
        settingsService.getChangeHistory(20, user),
      ])

      setStats(st)
      setCompanySettings(comp)
      setInventorySettings(inv)
      setPOSSettings(pos)
      setEcommerceSettings(ecom)
      setSystemSettings(sys)
      setRoles(rls)
      setHistory(hist)
    } catch (err: any) {
      console.error('Error cargando configuraciones:', err)
      showToast(err.message || 'Error al cargar los parámetros del sistema', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [user, showToast])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const saveCompany = async (data: Partial<CompanySettings>) => {
    try {
      setIsSaving(true)
      const updated = await settingsService.updateCompanySettings(data, user)
      setCompanySettings(updated)
      showToast('Información institucional actualizada correctamente')
      await loadAll()
      return true
    } catch (err: any) {
      showToast(err.message || 'Error al guardar información empresarial', 'error')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const saveInventory = async (data: Partial<InventorySettings>, confirmed = false) => {
    if (!inventorySettings) return false

    // Detección de cambio crítico: cambio de método de valoración
    if (
      !confirmed &&
      data.valuationMethod &&
      data.valuationMethod !== inventorySettings.valuationMethod
    ) {
      setCriticalModal({
        isOpen: true,
        title: 'Confirmar Cambio de Método de Valoración',
        message:
          'Modificar el método de valoración de inventarios afecta el recálculo histórico de costos, el CMV y los balances financieros futuros. ¿Deseas continuar?',
        fieldLabel: 'Método de Valoración',
        previousValue: inventorySettings.valuationMethod,
        newValue: data.valuationMethod,
        onConfirm: async () => {
          setCriticalModal((prev) => ({ ...prev, isOpen: false }))
          await saveInventory(data, true)
        },
      })
      return false
    }

    try {
      setIsSaving(true)
      const updated = await settingsService.updateInventorySettings(data, user)
      setInventorySettings(updated)
      showToast('Políticas de inventario actualizadas correctamente')
      await loadAll()
      return true
    } catch (err: any) {
      showToast(err.message || 'Error al guardar políticas de inventario', 'error')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const savePOS = async (data: Partial<POSSettings>) => {
    try {
      setIsSaving(true)
      const updated = await settingsService.updatePOSSettings(data, user)
      setPOSSettings(updated)
      showToast('Configuración de punto de venta y cajas actualizada')
      await loadAll()
      return true
    } catch (err: any) {
      showToast(err.message || 'Error al guardar configuración POS', 'error')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const saveEcommerce = async (data: Partial<EcommerceSettings>, confirmed = false) => {
    if (!ecommerceSettings) return false

    // Detección de cambio crítico: cambio de nodo logístico de despacho
    if (
      !confirmed &&
      data.dispatchWarehouseId &&
      data.dispatchWarehouseId !== ecommerceSettings.dispatchWarehouseId
    ) {
      setCriticalModal({
        isOpen: true,
        title: 'Confirmar Cambio de Bodega de Despacho Web',
        message:
          'Cambiar la bodega designada para ecommerce alterará el nodo físico desde donde se descuentan las reservas y se alistan los pedidos de la tienda virtual. ¿Deseas continuar?',
        fieldLabel: 'Bodega de Despacho',
        previousValue: ecommerceSettings.dispatchWarehouseName,
        newValue: data.dispatchWarehouseName || data.dispatchWarehouseId,
        onConfirm: async () => {
          setCriticalModal((prev) => ({ ...prev, isOpen: false }))
          await saveEcommerce(data, true)
        },
      })
      return false
    }

    try {
      setIsSaving(true)
      const updated = await settingsService.updateEcommerceSettings(data, user)
      setEcommerceSettings(updated)
      showToast('Configuración de canales web y catálogos actualizada')
      await loadAll()
      return true
    } catch (err: any) {
      showToast(err.message || 'Error al guardar configuración web', 'error')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const saveDynamic = async (
    key: string,
    value: any,
    notes?: string,
    confirmed = false
  ) => {
    const item = systemSettings.find((s) => s.key === key)
    if (!item) return false

    if (!confirmed && item.isCritical) {
      setCriticalModal({
        isOpen: true,
        title: 'Confirmar Modificación Crítica',
        message: `El parámetro "${item.description}" está clasificado como crítico para el funcionamiento del ERP. Este cambio puede afectar operaciones futuras. ¿Deseas continuar?`,
        fieldLabel: item.description,
        previousValue: String(item.value),
        newValue: String(value),
        onConfirm: async () => {
          setCriticalModal((prev) => ({ ...prev, isOpen: false }))
          await saveDynamic(key, value, notes, true)
        },
      })
      return false
    }

    try {
      setIsSaving(true)
      await settingsService.updateSystemSetting({ key, value, notes }, user)
      showToast(`Parámetro "${item.description}" actualizado`)
      await loadAll()
      return true
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar parámetro del sistema', 'error')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const closeCriticalModal = () => {
    setCriticalModal((prev) => ({ ...prev, isOpen: false }))
  }

  return {
    stats,
    companySettings,
    inventorySettings,
    posSettings,
    ecommerceSettings,
    systemSettings,
    roles,
    history,
    isLoading,
    isSaving,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    toast,
    showToast,
    criticalModal,
    closeCriticalModal,
    saveCompany,
    saveInventory,
    savePOS,
    saveEcommerce,
    saveDynamic,
    refresh: loadAll,
  }
}
