/**
 * SUPER MÁS ERP/POS - Repositorio de Configuración (settingsRepository)
 *
 * Capa de persistencia desacoplada para la lectura y mutación de parámetros globales.
 * Consume centralizadamente lib/supabase/db.ts.
 */

import { db } from '@/lib/supabase/db'
import {
  CompanySettings,
  InventorySettings,
  POSSettings,
  EcommerceSettings,
  SystemSettingItem,
  SettingsStats,
  SettingChangeHistory,
  SettingsCategory,
} from '../types'
import { SYSTEM_ROLES } from '@/features/users/services/role-permissions'

// Almacén en memoria para historial de cambios de configuración
let changeHistoryStore: SettingChangeHistory[] = [
  {
    id: 'hist-001',
    timestamp: '2026-09-18T10:00:00.000Z',
    actor: 'Admin Mauricio',
    category: 'INVENTORY',
    key: 'inventory.defaultMinStockThreshold',
    fieldLabel: 'Stock Mínimo General',
    previousValue: 15,
    newValue: 10,
    isCritical: false,
    notes: 'Ajuste inicial de políticas de stock de seguridad para abarrotes.',
  },
  {
    id: 'hist-002',
    timestamp: '2026-09-18T10:05:00.000Z',
    actor: 'Admin Mauricio',
    category: 'ECOMMERCE',
    key: 'ecommerce.dispatchWarehouseId',
    fieldLabel: 'Bodega Despacho Ecommerce',
    previousValue: 'loc-002',
    newValue: 'loc-001',
    isCritical: true,
    notes: 'Centralización de alistamiento web en Centro Logístico CEDI.',
  },
]

export class SettingsRepository {
  /**
   * Obtiene la configuración institucional de la empresa
   */
  async getCompanySettings(): Promise<CompanySettings> {
    return JSON.parse(JSON.stringify(db.companySettings))
  }

  /**
   * Actualiza la información de la empresa
   */
  async updateCompanySettings(data: Partial<CompanySettings>, actorName: string): Promise<CompanySettings> {
    const prev = await this.getCompanySettings()
    const now = new Date().toISOString()

    const updated: CompanySettings = {
      ...prev,
      ...data,
      updatedAt: now,
      updatedBy: actorName,
    }

    Object.assign(db.companySettings, updated)

    this.recordChange({
      actor: actorName,
      category: 'COMPANY',
      key: 'company.general_info',
      fieldLabel: 'Información Empresarial',
      previousValue: prev.companyName,
      newValue: updated.companyName,
      isCritical: false,
      notes: 'Actualización de datos corporativos de la empresa.',
    })

    return JSON.parse(JSON.stringify(updated))
  }

  /**
   * Obtiene los parámetros generales de inventario
   */
  async getInventorySettings(): Promise<InventorySettings> {
    return JSON.parse(JSON.stringify(db.inventorySettings))
  }

  /**
   * Actualiza las políticas de inventario
   */
  async updateInventorySettings(data: Partial<InventorySettings>, actorName: string): Promise<InventorySettings> {
    const prev = await this.getInventorySettings()
    const now = new Date().toISOString()

    const isCritical = Boolean(
      (data.valuationMethod && data.valuationMethod !== prev.valuationMethod) ||
      (data.allowNegativeStock !== undefined && data.allowNegativeStock !== prev.allowNegativeStock)
    )

    const updated: InventorySettings = {
      ...prev,
      ...data,
      updatedAt: now,
      updatedBy: actorName,
    }

    Object.assign(db.inventorySettings, updated)

    this.recordChange({
      actor: actorName,
      category: 'INVENTORY',
      key: 'inventory.policies',
      fieldLabel: 'Políticas de Inventario y Valoración',
      previousValue: `Método: ${prev.valuationMethod}, Stock Mínimo: ${prev.defaultMinStockThreshold}`,
      newValue: `Método: ${updated.valuationMethod}, Stock Mínimo: ${updated.defaultMinStockThreshold}`,
      isCritical,
      notes: isCritical ? 'Cambio crítico en política de valoración o existencias negativas.' : undefined,
    })

    return JSON.parse(JSON.stringify(updated))
  }

  /**
   * Obtiene la configuración de cajas y POS
   */
  async getPOSSettings(): Promise<POSSettings> {
    return JSON.parse(JSON.stringify(db.posSettings))
  }

  /**
   * Actualiza la configuración de cajas y POS
   */
  async updatePOSSettings(data: Partial<POSSettings>, actorName: string): Promise<POSSettings> {
    const prev = await this.getPOSSettings()
    const now = new Date().toISOString()

    const updated: POSSettings = {
      ...prev,
      ...data,
      updatedAt: now,
      updatedBy: actorName,
    }

    Object.assign(db.posSettings, updated)

    this.recordChange({
      actor: actorName,
      category: 'POS',
      key: 'pos.terminal_rules',
      fieldLabel: 'Reglas de Punto de Venta y Cajas',
      previousValue: `Sede: ${prev.defaultLocationName}`,
      newValue: `Sede: ${updated.defaultLocationName}`,
      isCritical: false,
    })

    return JSON.parse(JSON.stringify(updated))
  }

  /**
   * Obtiene la configuración de canales web y ecommerce
   */
  async getEcommerceSettings(): Promise<EcommerceSettings> {
    return JSON.parse(JSON.stringify(db.ecommerceSettings))
  }

  /**
   * Actualiza la configuración de canales web y ecommerce
   */
  async updateEcommerceSettings(data: Partial<EcommerceSettings>, actorName: string): Promise<EcommerceSettings> {
    const prev = await this.getEcommerceSettings()
    const now = new Date().toISOString()

    const isCritical = Boolean(
      data.dispatchWarehouseId && data.dispatchWarehouseId !== prev.dispatchWarehouseId
    )

    const updated: EcommerceSettings = {
      ...prev,
      ...data,
      updatedAt: now,
      updatedBy: actorName,
    }

    Object.assign(db.ecommerceSettings, updated)

    this.recordChange({
      actor: actorName,
      category: 'ECOMMERCE',
      key: 'ecommerce.dispatch_node',
      fieldLabel: 'Bodega de Despacho Ecommerce',
      previousValue: prev.dispatchWarehouseName,
      newValue: updated.dispatchWarehouseName,
      isCritical,
      notes: isCritical ? 'Cambio de nodo logístico de despacho web.' : undefined,
    })

    return JSON.parse(JSON.stringify(updated))
  }

  /**
   * Obtiene el catálogo completo de variables dinámicas del sistema
   */
  async getSystemSettings(category?: SettingsCategory): Promise<SystemSettingItem[]> {
    const list = db.settings as unknown as SystemSettingItem[]
    if (category) {
      return JSON.parse(JSON.stringify(list.filter((s) => s.category === category)))
    }
    return JSON.parse(JSON.stringify(list))
  }

  /**
   * Obtiene una variable dinámica individual por su clave
   */
  async getSystemSettingByKey(key: string): Promise<SystemSettingItem | null> {
    const list = db.settings as unknown as SystemSettingItem[]
    const found = list.find((s) => s.key === key)
    return found ? JSON.parse(JSON.stringify(found)) : null
  }

  /**
   * Actualiza el valor de una variable dinámica
   */
  async updateSystemSetting(
    key: string,
    value: any,
    actorName: string,
    notes?: string
  ): Promise<SystemSettingItem> {
    const list = db.settings as unknown as SystemSettingItem[]
    const itemIndex = list.findIndex((s) => s.key === key)

    if (itemIndex === -1) {
      throw new Error(`La variable de configuración "${key}" no existe.`)
    }

    const prev = list[itemIndex]
    const now = new Date().toISOString()

    const updated: SystemSettingItem = {
      ...prev,
      value,
      updatedAt: now,
      updatedBy: actorName,
    }

    list[itemIndex] = updated

    this.recordChange({
      actor: actorName,
      category: prev.category,
      key: prev.key,
      fieldLabel: prev.description,
      previousValue: prev.value,
      newValue: value,
      isCritical: prev.isCritical,
      notes,
    })

    return JSON.parse(JSON.stringify(updated))
  }

  /**
   * Consulta los roles del sistema y su matriz de permisos (solo lectura)
   */
  async getPredefinedRoles() {
    return Object.values(SYSTEM_ROLES)
  }

  /**
   * Obtiene el historial reciente de cambios en configuración
   */
  async getChangeHistory(limit = 20): Promise<SettingChangeHistory[]> {
    return JSON.parse(JSON.stringify(changeHistoryStore.slice(0, limit)))
  }

  /**
   * Registra una modificación en el historial interno
   */
  private recordChange(entry: Omit<SettingChangeHistory, 'id' | 'timestamp'>) {
    const newEntry: SettingChangeHistory = {
      ...entry,
      id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    }
    changeHistoryStore.unshift(newEntry)
  }

  /**
   * Calcula estadísticas agregadas para el tablero principal de configuración
   */
  async getStats(): Promise<SettingsStats> {
    const dynamicList = db.settings as unknown as SystemSettingItem[]
    const criticalDynamic = dynamicList.filter((s) => s.isCritical).length
    const recentHistory = changeHistoryStore[0]

    return {
      totalActiveSettings: dynamicList.length + 32, // Consolida los parámetros estructurados y dinámicos
      lastModifiedAt: recentHistory ? recentHistory.timestamp : new Date().toISOString(),
      lastModifiedBy: recentHistory ? recentHistory.actor : 'Admin Mauricio',
      totalCriticalSettings: criticalDynamic + 3, // Incluye bodega ecommerce, método valoración y prefijo DIAN
      categoriesCount: 16,
      activeModulesCount: 12,
    }
  }
}

export const settingsRepository = new SettingsRepository()
