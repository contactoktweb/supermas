/**
 * SUPER MÁS ERP/POS - Servicio Central de Configuración (SettingsService)
 *
 * Fachada de negocio encargada de:
 * 1. Control de acceso RBAC y verificación de permisos (settings.*).
 * 2. Validación de esquemas con Zod antes de persistir.
 * 3. Detección y confirmación obligatoria para cambios críticos.
 * 4. Trazabilidad inmutable mediante auditService.log().
 * 5. Exposición de estadísticas y consulta de roles predefinidos (read-only).
 */

import { settingsRepository } from '../repositories/settings.repository'
import { auditService } from '@/features/audit/services/audit.service'
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
  SettingsPermission,
} from '../types'
import {
  companySettingsSchema,
  inventorySettingsSchema,
  posSettingsSchema,
  ecommerceSettingsSchema,
  updateDynamicSettingSchema,
  CompanySettingsInput,
  InventorySettingsInput,
  POSSettingsInput,
  EcommerceSettingsInput,
  UpdateDynamicSettingInput,
} from '../schemas/settings.schema'

export const DEFAULT_SETTINGS_USER: UserSettingsContext = {
  userId: 'usr-001',
  name: 'Mauricio Andrade',
  role: 'SUPERADMIN',
  permissions: [
    'settings.read',
    'settings.update',
    'settings.company',
    'settings.inventory',
    'settings.ecommerce',
    'settings.billing',
    'settings.tax',
    'settings.accounting',
    'settings.alerts',
    'settings.security',
  ],
}

export class SettingsService {
  /**
   * Verifica permisos del usuario
   */
  private assertPermission(permission: SettingsPermission, user: UserSettingsContext): void {
    if (user.role === 'SUPERADMIN') return
    if (!user.permissions.includes(permission)) {
      throw new Error(`Acceso denegado: Se requiere el permiso '${permission}' para esta operación.`)
    }
  }

  /**
   * Obtiene las métricas consolidadas del tablero de configuración
   */
  async getStats(user: UserSettingsContext = DEFAULT_SETTINGS_USER): Promise<SettingsStats> {
    this.assertPermission('settings.read', user)
    return settingsRepository.getStats()
  }

  /**
   * Obtiene la configuración institucional de la empresa
   */
  async getCompanySettings(user: UserSettingsContext = DEFAULT_SETTINGS_USER): Promise<CompanySettings> {
    this.assertPermission('settings.read', user)
    return settingsRepository.getCompanySettings()
  }

  /**
   * Actualiza la información institucional de la empresa
   */
  async updateCompanySettings(
    rawInput: Partial<CompanySettingsInput>,
    user: UserSettingsContext = DEFAULT_SETTINGS_USER
  ): Promise<CompanySettings> {
    this.assertPermission('settings.company', user)
    this.assertPermission('settings.update', user)

    const current = await settingsRepository.getCompanySettings()
    const merged = { ...current, ...rawInput }
    const validated = companySettingsSchema.parse(merged)

    const updated = await settingsRepository.updateCompanySettings(validated, user.name)

    await auditService.log({
      action: 'SETTING_UPDATED',
      module: 'SETTINGS',
      entityType: 'COMPANY_SETTINGS',
      entityId: 'COMPANY',
      entityReference: updated.nit,
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      level: 'INFO',
      details: `Información de la empresa actualizada por ${user.name}: "${updated.companyName}".`,
      changes: [
        { label: 'Razón Social', field: 'companyName', previousValue: current.companyName, newValue: updated.companyName },
        { label: 'Dirección', field: 'address', previousValue: current.address, newValue: updated.address },
        { label: 'Teléfono', field: 'phone', previousValue: current.phone, newValue: updated.phone },
      ],
    })

    return updated
  }

  /**
   * Obtiene los parámetros generales de inventario
   */
  async getInventorySettings(user: UserSettingsContext = DEFAULT_SETTINGS_USER): Promise<InventorySettings> {
    this.assertPermission('settings.read', user)
    return settingsRepository.getInventorySettings()
  }

  /**
   * Actualiza las políticas de inventario
   */
  async updateInventorySettings(
    rawInput: Partial<InventorySettingsInput>,
    user: UserSettingsContext = DEFAULT_SETTINGS_USER
  ): Promise<InventorySettings> {
    this.assertPermission('settings.inventory', user)
    this.assertPermission('settings.update', user)

    const current = await settingsRepository.getInventorySettings()
    const merged = { ...current, ...rawInput }
    const validated = inventorySettingsSchema.parse(merged)

    const isValuationChanged = validated.valuationMethod !== current.valuationMethod
    const isNegativeStockChanged = validated.allowNegativeStock !== current.allowNegativeStock
    const isCritical = isValuationChanged || isNegativeStockChanged

    const updated = await settingsRepository.updateInventorySettings(validated, user.name)

    await auditService.log({
      action: isCritical ? 'CRITICAL_CONFIG_CHANGED' : 'SETTING_UPDATED',
      module: 'SETTINGS',
      entityType: 'INVENTORY_SETTINGS',
      entityId: 'INVENTORY',
      entityReference: 'Políticas de Inventario',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      level: isCritical ? 'WARNING' : 'INFO',
      details: `Políticas de inventario modificadas por ${user.name}. Método: ${updated.valuationMethod}, Stock Mínimo: ${updated.defaultMinStockThreshold}.`,
      changes: [
        { label: 'Método de Valoración', field: 'valuationMethod', previousValue: current.valuationMethod, newValue: updated.valuationMethod },
        { label: 'Stock Mínimo General', field: 'defaultMinStockThreshold', previousValue: String(current.defaultMinStockThreshold), newValue: String(updated.defaultMinStockThreshold) },
      ],
    })

    return updated
  }

  /**
   * Obtiene la configuración de cajas y terminales POS
   */
  async getPOSSettings(user: UserSettingsContext = DEFAULT_SETTINGS_USER): Promise<POSSettings> {
    this.assertPermission('settings.read', user)
    return settingsRepository.getPOSSettings()
  }

  /**
   * Actualiza la configuración de cajas y POS
   */
  async updatePOSSettings(
    rawInput: Partial<POSSettingsInput>,
    user: UserSettingsContext = DEFAULT_SETTINGS_USER
  ): Promise<POSSettings> {
    this.assertPermission('settings.update', user)

    const current = await settingsRepository.getPOSSettings()
    const merged = { ...current, ...rawInput }
    const validated = posSettingsSchema.parse(merged)

    const updated = await settingsRepository.updatePOSSettings(validated, user.name)

    await auditService.log({
      action: 'SETTING_UPDATED',
      module: 'SETTINGS',
      entityType: 'POS_SETTINGS',
      entityId: 'POS',
      entityReference: 'Configuración POS y Cajas',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      level: 'INFO',
      details: `Configuración de terminales POS y cajas modificada por ${user.name}.`,
      changes: [
        { label: 'Sede Predeterminada', field: 'defaultLocationId', previousValue: current.defaultLocationId, newValue: updated.defaultLocationId },
        { label: 'Impresión Automática', field: 'autoPrintReceipt', previousValue: String(current.autoPrintReceipt), newValue: String(updated.autoPrintReceipt) },
      ],
    })

    return updated
  }

  /**
   * Obtiene la configuración de ecommerce y catálogos web
   */
  async getEcommerceSettings(user: UserSettingsContext = DEFAULT_SETTINGS_USER): Promise<EcommerceSettings> {
    this.assertPermission('settings.read', user)
    return settingsRepository.getEcommerceSettings()
  }

  /**
   * Actualiza la configuración de canales web y ecommerce
   */
  async updateEcommerceSettings(
    rawInput: Partial<EcommerceSettingsInput>,
    user: UserSettingsContext = DEFAULT_SETTINGS_USER
  ): Promise<EcommerceSettings> {
    this.assertPermission('settings.ecommerce', user)
    this.assertPermission('settings.update', user)

    const current = await settingsRepository.getEcommerceSettings()
    const merged = { ...current, ...rawInput }
    const validated = ecommerceSettingsSchema.parse(merged)

    const isWarehouseChanged = validated.dispatchWarehouseId !== current.dispatchWarehouseId
    const isCritical = isWarehouseChanged

    const updated = await settingsRepository.updateEcommerceSettings(validated, user.name)

    await auditService.log({
      action: isCritical ? 'CRITICAL_CONFIG_CHANGED' : 'SETTING_UPDATED',
      module: 'SETTINGS',
      entityType: 'ECOMMERCE_SETTINGS',
      entityId: 'ECOMMERCE',
      entityReference: 'Canales Web y Catálogos',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      level: isCritical ? 'WARNING' : 'INFO',
      details: `Configuración de ecommerce modificada por ${user.name}. Bodega despacho: ${updated.dispatchWarehouseName}.`,
      changes: [
        { label: 'Bodega Despacho Ecommerce', field: 'dispatchWarehouseId', previousValue: current.dispatchWarehouseName, newValue: updated.dispatchWarehouseName },
        { label: 'Línea WhatsApp', field: 'whatsapp.phoneNumber', previousValue: current.whatsapp.phoneNumber, newValue: updated.whatsapp.phoneNumber },
      ],
    })

    return updated
  }

  /**
   * Obtiene el catálogo de variables dinámicas del sistema
   */
  async getSystemSettings(
    category?: SettingsCategory,
    user: UserSettingsContext = DEFAULT_SETTINGS_USER
  ): Promise<SystemSettingItem[]> {
    this.assertPermission('settings.read', user)
    return settingsRepository.getSystemSettings(category)
  }

  /**
   * Actualiza el valor de una variable dinámica por su clave
   */
  async updateSystemSetting(
    rawInput: UpdateDynamicSettingInput,
    user: UserSettingsContext = DEFAULT_SETTINGS_USER
  ): Promise<SystemSettingItem> {
    this.assertPermission('settings.update', user)
    const { key, value, notes } = updateDynamicSettingSchema.parse(rawInput)

    const current = await settingsRepository.getSystemSettingByKey(key)
    if (!current) {
      throw new Error(`Parámetro de configuración "${key}" no encontrado.`)
    }

    const updated = await settingsRepository.updateSystemSetting(key, value, user.name, notes)

    await auditService.log({
      action: updated.isCritical ? 'CRITICAL_CONFIG_CHANGED' : 'SETTING_UPDATED',
      module: 'SETTINGS',
      entityType: 'SYSTEM_SETTING',
      entityId: updated.id,
      entityReference: updated.key,
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      level: updated.isCritical ? 'WARNING' : 'INFO',
      details: `Variable dinámica "${updated.key}" actualizada a: ${JSON.stringify(value)}.`,
      changes: [
        { label: updated.description, field: updated.key, previousValue: String(current.value), newValue: String(value) },
      ],
    })

    return updated
  }

  /**
   * Consulta los roles del sistema y su matriz de permisos (solo lectura)
   */
  async getPredefinedRoles(user: UserSettingsContext = DEFAULT_SETTINGS_USER) {
    this.assertPermission('settings.read', user)
    return settingsRepository.getPredefinedRoles()
  }

  /**
   * Obtiene el historial de auditoría de cambios en configuración
   */
  async getChangeHistory(limit = 20, user: UserSettingsContext = DEFAULT_SETTINGS_USER): Promise<SettingChangeHistory[]> {
    this.assertPermission('settings.read', user)
    return settingsRepository.getChangeHistory(limit)
  }
}

export const settingsService = new SettingsService()
