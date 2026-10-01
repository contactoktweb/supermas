/**
 * SUPER MÁS ERP/POS - Repositorio de Configuración (settingsRepository)
 *
 * Capa de persistencia desacoplada para la lectura y mutación de parámetros globales.
 * Consume centralizadamente lib/supabase/db.ts.
 */

import { db } from '@/lib/supabase/db'
import { supabaseClient } from '@/lib/supabase/client'
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

function mapDbCompanyToSettings(row: any): CompanySettings {
  return {
    id: row.id,
    companyName: row.trade_name || row.business_name || '',
    legalName: row.business_name || '',
    nit: row.tax_id || '',
    dv: row.verification_digit || '',
    fiscalRegime: row.tax_regime || 'RESPONSABLE_DE_IVA',
    economicActivityCode: row.economic_activity_code || '4711',
    legalRepresentative: row.legal_representative_name || '',
    legalRepresentativeDoc: row.legal_representative_doc || '',
    address: row.address || '',
    city: row.city || '',
    department: row.department || '',
    country: row.country || 'Colombia',
    postalCode: '050001',
    phone: row.phone || '',
    mobile: '',
    email: row.email || '',
    billingEmail: row.invoice_email || '',
    website: '',
    logoUrl: row.logo_url || '/super-mas-logo.svg',
    currency: row.currency || 'COP',
    status: (row.status as any) || 'ACTIVE',
    timezone: 'America/Bogota',
    commercialDescription: '',
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
    updatedBy: 'Sistema',
  }
}

// Almacén en memoria para historial de cambios de configuración
let changeHistoryStore: SettingChangeHistory[] = [
  {
    id: 'hist-001',
    timestamp: '2026-09-18T10:00:00.000Z',
    actor: 'Sistema',
    category: 'INVENTORY',
    key: 'inventory.defaultMinStockThreshold',
    fieldLabel: 'Stock Mínimo General',
    previousValue: 15,
    newValue: 10,
    isCritical: false,
    notes: 'Ajuste inicial de políticas de stock de seguridad para abarrotes.',
  },
]

export class SettingsRepository {
  /**
   * Obtiene la configuración institucional de la empresa desde Supabase
   */
  async getCompanySettings(): Promise<CompanySettings | null> {
    const { data, error } = await supabaseClient
      .from('companies')
      .select('*')
      .limit(1)

    if (error) {
      console.error('Error al consultar companies en Supabase:', error)
      throw new Error(`Error consultando empresa: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return null
    }

    return mapDbCompanyToSettings(data[0])
  }

  /**
   * Crea la empresa inicial (Bootstrap Onboarding) en public.companies
   */
  async createCompany(data: Partial<CompanySettings>, actorName: string): Promise<CompanySettings> {
    const payload = {
      business_name: data.legalName || data.companyName,
      trade_name: data.companyName || data.legalName,
      tax_id: data.nit?.replace(/[^0-9]/g, '') || data.nit,
      verification_digit: data.dv || '0',
      tax_regime: data.fiscalRegime || 'RESPONSABLE_DE_IVA',
      economic_activity_code: data.economicActivityCode || '4711',
      legal_representative_name: data.legalRepresentative || null,
      legal_representative_doc: data.legalRepresentativeDoc || null,
      address: data.address || '',
      city: data.city || '',
      department: data.department || '',
      country: data.country || 'Colombia',
      phone: data.phone || '',
      email: data.email || '',
      invoice_email: data.billingEmail || data.email || '',
      logo_url: data.logoUrl || null,
      currency: data.currency || 'COP',
      status: data.status || 'ACTIVE',
    }

    const { data: inserted, error } = await supabaseClient
      .from('companies')
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.error('Error creando empresa en Supabase:', error)
      throw new Error(`Error registrando empresa: ${error.message}`)
    }

    this.recordChange({
      actor: actorName,
      category: 'COMPANY',
      key: 'company.create',
      fieldLabel: 'Creación de Empresa',
      previousValue: '(Ninguna)',
      newValue: inserted.business_name,
      isCritical: true,
      notes: 'Registro inicial de la empresa en el ERP.',
    })

    return mapDbCompanyToSettings(inserted)
  }

  /**
   * Actualiza la información de la empresa en public.companies
   */
  async updateCompanySettings(data: Partial<CompanySettings>, actorName: string): Promise<CompanySettings> {
    let companyId = data.id
    if (!companyId) {
      const current = await this.getCompanySettings()
      if (!current?.id) {
        throw new Error('No existe una empresa registrada para actualizar. Debe crearla primero.')
      }
      companyId = current.id
    }

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (data.legalName !== undefined) payload.business_name = data.legalName
    if (data.companyName !== undefined) payload.trade_name = data.companyName
    if (data.nit !== undefined) payload.tax_id = data.nit.replace(/[^0-9]/g, '')
    if (data.dv !== undefined) payload.verification_digit = data.dv
    if (data.fiscalRegime !== undefined) payload.tax_regime = data.fiscalRegime
    if (data.economicActivityCode !== undefined) payload.economic_activity_code = data.economicActivityCode
    if (data.legalRepresentative !== undefined) payload.legal_representative_name = data.legalRepresentative || null
    if (data.legalRepresentativeDoc !== undefined) payload.legal_representative_doc = data.legalRepresentativeDoc || null
    if (data.address !== undefined) payload.address = data.address
    if (data.city !== undefined) payload.city = data.city
    if (data.department !== undefined) payload.department = data.department
    if (data.country !== undefined) payload.country = data.country
    if (data.phone !== undefined) payload.phone = data.phone
    if (data.email !== undefined) payload.email = data.email
    if (data.billingEmail !== undefined) payload.invoice_email = data.billingEmail
    if (data.logoUrl !== undefined) payload.logo_url = data.logoUrl
    if (data.currency !== undefined) payload.currency = data.currency
    if (data.status !== undefined) payload.status = data.status

    const { data: updated, error } = await supabaseClient
      .from('companies')
      .update(payload)
      .eq('id', companyId)
      .select()
      .single()

    if (error) {
      console.error('Error actualizando empresa en Supabase:', error)
      throw new Error(`Error actualizando empresa: ${error.message}`)
    }

    this.recordChange({
      actor: actorName,
      category: 'COMPANY',
      key: 'company.update',
      fieldLabel: 'Información Empresarial',
      previousValue: data.companyName || '',
      newValue: updated.trade_name || updated.business_name,
      isCritical: false,
      notes: 'Actualización fiduciaria de datos institucionales de la empresa.',
    })

    return mapDbCompanyToSettings(updated)
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
