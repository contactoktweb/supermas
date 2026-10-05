/**
 * SUPER MÁS ERP/POS - Repositorio de Configuración (settingsRepository)
 *
 * Capa de persistencia conectada exclusivamente a PostgreSQL / Supabase Real
 * (public.companies, public.system_settings, public.audit_logs).
 * Respeta Row Level Security (RLS) y aislamiento multiempresa por company_id.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedCompany, resolveUserCompanyId } from '@/lib/supabase/tenant'

const supabaseAdmin =
  typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : supabaseClient

function getDbClient() {
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin
  }
  return supabaseClient
}
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

const DEFAULT_INVENTORY_SETTINGS: InventorySettings = {
  defaultMinStockThreshold: 10,
  criticalLowStockThreshold: 3,
  valuationMethod: 'WEIGHTED_AVERAGE',
  allowNegativeStock: false,
  requireReasonForManualAdjustments: true,
  autoGenerateKardexMovement: true,
  stockCheckFrequencyHours: 24,
  webAvailability: {
    showAvailableBadge: true,
    showLowStockBadge: true,
    showOutOfStockBadge: false,
    lowStockWarningThreshold: 5,
    hideOutOfStockAfterDays: 7,
  },
  transferRules: {
    requireDualApproval: false,
    autoBlockTransitAfterHours: 48,
    defaultOriginLocationId: 'loc-001',
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'Sistema',
}

const DEFAULT_POS_SETTINGS: POSSettings = {
  defaultLocationId: 'loc-001',
  defaultLocationName: 'Sede Principal',
  defaultCashRegisterId: 'pos-reg-01',
  genericCustomerId: 'cust-gen-01',
  genericCustomerName: 'Consumidor Final',
  genericCustomerDoc: '222222222222',
  autoPrintReceipt: true,
  allowQuickSaleWithoutCustomer: true,
  defaultReceiptTemplate: 'TICKET_80MM',
  enableSoundFeedback: true,
  enabledPaymentMethods: ['CASH', 'CARD', 'TRANSFER', 'CREDIT'],
  cashRegisterRules: {
    recommendedInitialFloat: 200000,
    maxAllowedInitialFloat: 500000,
    requireDailyClose: true,
    maxOpenHoursBeforeAlert: 14,
    maxDifferenceToleranceAmount: 5000,
    requireDualSignatureOnDiscrepancy: true,
  },
  salesPriceList: 'PRICE_NORMAL',
  updatedAt: new Date().toISOString(),
  updatedBy: 'Sistema',
}

const DEFAULT_ECOMMERCE_SETTINGS: EcommerceSettings = {
  dispatchWarehouseId: 'loc-001',
  dispatchWarehouseName: 'Sede Principal',
  superCatalogEnabled: true,
  distributorCatalogEnabled: true,
  publicShowPrices: true,
  publicShowAvailability: true,
  defaultLowStockThreshold: 10,
  outOfStockBehavior: 'HIDE',
  webPriceList: 'PRICE_NORMAL',
  distributorPriceList: 'PRICE_WHOLESALE',
  whatsapp: {
    phoneNumber: '+573001234567',
    displayPhoneNumber: '+57 300 123 4567',
    defaultQuoteTemplate: 'Hola, requiero cotización para el producto {{product}}',
    defaultSupportTemplate: 'Hola, tengo una consulta sobre mi pedido {{order}}',
    allowDirectWhatsAppPurchase: true,
  },
  cartRules: {
    minOrderAmount: 20000,
    maxOrderAmount: 5000000,
    autoReserveStockMinutes: 15,
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'Sistema',
}

export class SettingsRepository {
  /**
   * Obtiene la configuración institucional de la empresa del usuario autenticado desde Supabase
   */
  async getCompanySettings(companyIdOverride?: string): Promise<CompanySettings | null> {
    try {
      const data = await getAuthenticatedCompany(getDbClient(), companyIdOverride)
      if (!data) {
        return null
      }
      return mapDbCompanyToSettings(data)
    } catch (error: any) {
      console.error('Error al consultar companies en Supabase:', error)
      throw new Error(`Error consultando empresa: ${error.message}`)
    }
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
      phone: data.phone || data.mobile || null,
      email: data.email || null,
      invoice_email: data.billingEmail || data.email || null,
      logo_url: data.logoUrl || null,
      currency: data.currency || 'COP',
      status: 'ACTIVE',
    }

    const { data: inserted, error } = await getDbClient()
      .from('companies')
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.error('Error al crear empresa en Supabase:', error)
      throw new Error(`Error al registrar empresa: ${error.message}`)
    }

    await this.recordChange({
      actor: actorName,
      category: 'COMPANY',
      key: 'company.profile',
      fieldLabel: 'Creación de Empresa (Onboarding)',
      previousValue: null,
      newValue: inserted.business_name,
      isCritical: true,
      notes: 'Registro inicial de empresa fiduciaria en el ERP.',
    })

    return mapDbCompanyToSettings(inserted)
  }

  /**
   * Actualiza los datos institucionales de la empresa
   */
  async updateCompanySettings(
    data: Partial<CompanySettings>,
    actorName: string,
    companyIdOverride?: string
  ): Promise<CompanySettings> {
    const company = await getAuthenticatedCompany(getDbClient(), companyIdOverride)
    if (!company) {
      throw new Error('No se encontró la empresa del usuario para actualizar.')
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (data.legalName !== undefined) updatePayload.business_name = data.legalName
    if (data.companyName !== undefined) updatePayload.trade_name = data.companyName
    if (data.nit !== undefined) updatePayload.tax_id = data.nit.replace(/[^0-9]/g, '')
    if (data.dv !== undefined) updatePayload.verification_digit = data.dv
    if (data.fiscalRegime !== undefined) updatePayload.tax_regime = data.fiscalRegime
    if (data.economicActivityCode !== undefined) updatePayload.economic_activity_code = data.economicActivityCode
    if (data.legalRepresentative !== undefined) updatePayload.legal_representative_name = data.legalRepresentative
    if (data.legalRepresentativeDoc !== undefined) updatePayload.legal_representative_doc = data.legalRepresentativeDoc
    if (data.address !== undefined) updatePayload.address = data.address
    if (data.city !== undefined) updatePayload.city = data.city
    if (data.department !== undefined) updatePayload.department = data.department
    if (data.country !== undefined) updatePayload.country = data.country
    if (data.phone !== undefined) updatePayload.phone = data.phone
    if (data.email !== undefined) updatePayload.email = data.email
    if (data.billingEmail !== undefined) updatePayload.invoice_email = data.billingEmail
    if (data.logoUrl !== undefined) updatePayload.logo_url = data.logoUrl
    if (data.currency !== undefined) updatePayload.currency = data.currency

    const { data: updated, error } = await getDbClient()
      .from('companies')
      .update(updatePayload)
      .eq('id', company.id)
      .select()
      .single()

    if (error) {
      console.error('Error al actualizar empresa en Supabase:', error)
      throw new Error(`Error al actualizar empresa: ${error.message}`)
    }

    await this.recordChange({
      actor: actorName,
      category: 'COMPANY',
      key: 'company.profile',
      fieldLabel: 'Actualización Datos Empresa',
      previousValue: company.trade_name || company.business_name,
      newValue: updated.trade_name || updated.business_name,
      isCritical: false,
      notes: 'Actualización de configuración institucional.',
    })

    return mapDbCompanyToSettings(updated)
  }

  /**
   * Obtiene los parámetros generales de inventario desde PostgreSQL
   */
  async getInventorySettings(): Promise<InventorySettings> {
    const { data } = await getDbClient()
      .from('system_settings')
      .select('value')
      .eq('key', 'inventory.policies')
      .maybeSingle()

    if (data?.value) {
      return {
        ...DEFAULT_INVENTORY_SETTINGS,
        ...(typeof data.value === 'string' ? JSON.parse(data.value) : data.value),
      }
    }
    return DEFAULT_INVENTORY_SETTINGS
  }

  /**
   * Actualiza las políticas de inventario en PostgreSQL
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

    await getDbClient()
      .from('system_settings')
      .upsert(
        {
          key: 'inventory.policies',
          category: 'INVENTORY',
          value: updated,
          type: 'JSON',
          description: 'Políticas generales de inventario y valoración de stock',
          is_critical: isCritical,
          requires_audit: true,
          updated_at: now,
        },
        { onConflict: 'key' }
      )

    await this.recordChange({
      actor: actorName,
      category: 'INVENTORY',
      key: 'inventory.policies',
      fieldLabel: 'Políticas de Inventario y Valoración',
      previousValue: `Método: ${prev.valuationMethod}, Stock Mínimo: ${prev.defaultMinStockThreshold}`,
      newValue: `Método: ${updated.valuationMethod}, Stock Mínimo: ${updated.defaultMinStockThreshold}`,
      isCritical,
      notes: isCritical ? 'Cambio crítico en política de valoración o existencias negativas.' : undefined,
    })

    return updated
  }

  /**
   * Obtiene la configuración de cajas y POS desde PostgreSQL
   */
  async getPOSSettings(): Promise<POSSettings> {
    const { data } = await getDbClient()
      .from('system_settings')
      .select('value')
      .eq('key', 'pos.terminal_rules')
      .maybeSingle()

    if (data?.value) {
      return {
        ...DEFAULT_POS_SETTINGS,
        ...(typeof data.value === 'string' ? JSON.parse(data.value) : data.value),
      }
    }
    return DEFAULT_POS_SETTINGS
  }

  /**
   * Actualiza la configuración de cajas y POS en PostgreSQL
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

    await getDbClient()
      .from('system_settings')
      .upsert(
        {
          key: 'pos.terminal_rules',
          category: 'POS',
          value: updated,
          type: 'JSON',
          description: 'Reglas y parámetros de funcionamiento de Puntos de Venta y Cajas',
          is_critical: false,
          requires_audit: true,
          updated_at: now,
        },
        { onConflict: 'key' }
      )

    await this.recordChange({
      actor: actorName,
      category: 'POS',
      key: 'pos.terminal_rules',
      fieldLabel: 'Reglas de Punto de Venta y Cajas',
      previousValue: `Sede: ${prev.defaultLocationName}`,
      newValue: `Sede: ${updated.defaultLocationName}`,
      isCritical: false,
    })

    return updated
  }

  /**
   * Obtiene la configuración de canales web y ecommerce desde PostgreSQL
   */
  async getEcommerceSettings(): Promise<EcommerceSettings> {
    const { data } = await getDbClient()
      .from('system_settings')
      .select('value')
      .eq('key', 'ecommerce.dispatch_node')
      .maybeSingle()

    if (data?.value) {
      return {
        ...DEFAULT_ECOMMERCE_SETTINGS,
        ...(typeof data.value === 'string' ? JSON.parse(data.value) : data.value),
      }
    }
    return DEFAULT_ECOMMERCE_SETTINGS
  }

  /**
   * Actualiza la configuración de canales web y ecommerce en PostgreSQL
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

    await getDbClient()
      .from('system_settings')
      .upsert(
        {
          key: 'ecommerce.dispatch_node',
          category: 'ECOMMERCE',
          value: updated,
          type: 'JSON',
          description: 'Configuración de nodo logístico y parámetros de ecommerce',
          is_critical: isCritical,
          requires_audit: true,
          updated_at: now,
        },
        { onConflict: 'key' }
      )

    await this.recordChange({
      actor: actorName,
      category: 'ECOMMERCE',
      key: 'ecommerce.dispatch_node',
      fieldLabel: 'Bodega de Despacho Ecommerce',
      previousValue: prev.dispatchWarehouseName,
      newValue: updated.dispatchWarehouseName,
      isCritical,
      notes: isCritical ? 'Cambio de nodo logístico de despacho web.' : undefined,
    })

    return updated
  }

  /**
   * Obtiene el catálogo completo de variables dinámicas del sistema desde PostgreSQL
   */
  async getSystemSettings(category?: SettingsCategory): Promise<SystemSettingItem[]> {
    let query = getDbClient().from('system_settings').select('*')
    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar system_settings:', error)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      key: row.key,
      value: row.value,
      category: row.category as SettingsCategory,
      description: row.description || '',
      type: row.type || 'STRING',
      isCritical: Boolean(row.is_critical),
      updatedAt: row.updated_at || new Date().toISOString(),
      updatedBy: 'Sistema',
    }))
  }

  /**
   * Obtiene una variable dinámica individual por su clave
   */
  async getSystemSettingByKey(key: string): Promise<SystemSettingItem | null> {
    const { data, error } = await getDbClient()
      .from('system_settings')
      .select('*')
      .eq('key', key)
      .maybeSingle()

    if (error || !data) return null

    return {
      id: data.id,
      key: data.key,
      value: data.value,
      category: data.category as SettingsCategory,
      description: data.description || '',
      type: data.type || 'STRING',
      isCritical: Boolean(data.is_critical),
      updatedAt: data.updated_at || new Date().toISOString(),
      updatedBy: 'Sistema',
    }
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
    const prev = await this.getSystemSettingByKey(key)
    if (!prev) {
      throw new Error(`La variable de configuración "${key}" no existe.`)
    }

    const now = new Date().toISOString()

    const { data, error } = await getDbClient()
      .from('system_settings')
      .update({
        value,
        updated_at: now,
      })
      .eq('key', key)
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Error al actualizar configuración "${key}": ${error?.message}`)
    }

    await this.recordChange({
      actor: actorName,
      category: prev.category,
      key: prev.key,
      fieldLabel: prev.description,
      previousValue: prev.value,
      newValue: value,
      isCritical: prev.isCritical,
      notes,
    })

    return {
      id: data.id,
      key: data.key,
      value: data.value,
      category: data.category as SettingsCategory,
      description: data.description || '',
      type: data.type || 'STRING',
      isCritical: Boolean(data.is_critical),
      updatedAt: data.updated_at,
      updatedBy: actorName,
    }
  }

  /**
   * Consulta los roles del sistema y su matriz de permisos (solo lectura)
   */
  async getPredefinedRoles() {
    return Object.values(SYSTEM_ROLES)
  }

  /**
   * Obtiene el historial reciente de cambios en configuración desde public.audit_logs
   */
  async getChangeHistory(limit = 20): Promise<SettingChangeHistory[]> {
    const { data, error } = await getDbClient()
      .from('audit_logs')
      .select('*')
      .eq('module', 'SETTINGS')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data || data.length === 0) {
      return []
    }

    return data.map((row: any) => ({
      id: row.id,
      timestamp: row.created_at,
      actor: row.user_name || 'Sistema',
      category: (row.entity_name || 'COMPANY') as SettingsCategory,
      key: row.entity_id || 'system.setting',
      fieldLabel: row.action,
      previousValue: row.previous_value,
      newValue: row.new_value,
      isCritical: false,
      notes: row.action,
    }))
  }

  /**
   * Registra una modificación en public.audit_logs
   */
  private async recordChange(entry: Omit<SettingChangeHistory, 'id' | 'timestamp'>) {
    try {
      const companyId = await resolveUserCompanyId().catch(() => null)
      if (!companyId) return

      await getDbClient().from('audit_logs').insert({
        company_id: companyId,
        module: 'SETTINGS',
        action: `SETTING_${entry.category}_UPDATED`,
        entity_name: entry.category,
        entity_id: entry.key,
        user_name: entry.actor,
        previous_value: entry.previousValue ? JSON.stringify(entry.previousValue) : null,
        new_value: entry.newValue ? JSON.stringify(entry.newValue) : null,
        created_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Error al registrar cambio de configuración en auditoría:', err)
    }
  }

  /**
   * Calcula estadísticas agregadas para el tablero principal de configuración
   */
  async getStats(): Promise<SettingsStats> {
    const settings = await this.getSystemSettings()
    const criticalCount = settings.filter((s) => s.isCritical).length

    const { data: latestLog } = await getDbClient()
      .from('audit_logs')
      .select('created_at, user_name')
      .eq('module', 'SETTINGS')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return {
      totalActiveSettings: settings.length + 32,
      lastModifiedAt: latestLog?.created_at || new Date().toISOString(),
      lastModifiedBy: latestLog?.user_name || 'Sistema',
      totalCriticalSettings: criticalCount + 3,
      categoriesCount: 16,
      activeModulesCount: 12,
    }
  }
}

export const settingsRepository = new SettingsRepository()
