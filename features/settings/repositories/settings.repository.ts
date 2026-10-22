/**
 * SUPER MÁS ERP/POS - Repositorio de Configuración General.
 *
 * Fuentes reales:
 * - companies: datos legales y fiscales DIAN de la empresa.
 * - system_settings: parámetros operativos que leen los demás módulos (ver runtime-settings.ts).
 * - locations.is_ecommerce_source: bodega que despacha la tienda web.
 * - dian_resolutions, dian_software_config, accounting_periods, accounting_default_accounts,
 *   roles/role_permissions: solo lectura; se administran en sus propios módulos.
 * La escritura en system_settings la restringe RLS a administradores.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseClient } from '@/lib/supabase/client'
import { getAuthenticatedCompany } from '@/lib/supabase/tenant'
import { RUNTIME_SETTING_KEYS, getRuntimeSettings, invalidateRuntimeSettings } from '../services/runtime-settings'
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
  SettingsStats,
} from '../types'

const db = (): SupabaseClient => supabaseClient

/** Cantidad de parámetros editables que expone la pantalla (empresa aparte). */
const EDITABLE_SETTINGS_COUNT = 13

const ACCOUNT_PURPOSE_LABELS: Record<string, string> = {
  CASH: 'Caja',
  CUSTOMER_CREDIT: 'Clientes (cartera)',
  INVENTORY: 'Inventario',
  SUPPLIERS_PAYABLE: 'Proveedores',
  VAT_GENERATED: 'IVA generado',
  VAT_DEDUCTIBLE: 'IVA descontable',
  SALES_INCOME: 'Ingresos por ventas',
  SALES_RETURNS: 'Devoluciones en ventas',
  FINANCIAL_INCOME: 'Ingresos financieros',
  COST_OF_SALES: 'Costo de ventas',
}

function mapCompany(row: any): CompanySettings {
  return {
    id: row.id,
    companyName: row.trade_name || row.business_name || '',
    legalName: row.business_name || '',
    nit: row.tax_id || '',
    dv: row.verification_digit || '',
    fiscalRegime: row.tax_regime || 'RESPONSABLE_DE_IVA',
    economicActivityCode: row.economic_activity_code || '',
    legalRepresentative: row.legal_representative_name || '',
    legalRepresentativeDoc: row.legal_representative_doc || '',
    address: row.address || '',
    city: row.city || '',
    department: row.department || '',
    country: row.country || 'Colombia',
    postalCode: row.postal_code || '',
    phone: row.phone || '',
    email: row.email || '',
    billingEmail: row.invoice_email || '',
    currency: row.currency || 'COP',
    status: row.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    dianDepartmentCode: row.dian_department_code || '',
    dianMunicipalityCode: row.dian_municipality_code || '',
    dianOrganizationType: row.dian_organization_type === '2' ? '2' : '1',
    rutResponsibilities: row.rut_responsibilities || '',
    dianTaxLevelCodes: row.dian_tax_level_codes || '',
    dianTaxSchemeCode: row.dian_tax_scheme_code || '',
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  }
}

function companyPayload(data: CompanySettings) {
  return {
    business_name: data.legalName,
    trade_name: data.companyName,
    tax_id: data.nit.replace(/[^0-9]/g, ''),
    verification_digit: data.dv,
    tax_regime: data.fiscalRegime,
    economic_activity_code: data.economicActivityCode,
    legal_representative_name: data.legalRepresentative || null,
    legal_representative_doc: data.legalRepresentativeDoc || null,
    address: data.address,
    city: data.city,
    department: data.department,
    country: data.country,
    postal_code: data.postalCode || null,
    phone: data.phone,
    email: data.email,
    invoice_email: data.billingEmail || null,
    dian_department_code: data.dianDepartmentCode,
    dian_municipality_code: data.dianMunicipalityCode,
    dian_organization_type: data.dianOrganizationType,
    rut_responsibilities: data.rutResponsibilities,
    dian_tax_level_codes: data.dianTaxLevelCodes,
    dian_tax_scheme_code: data.dianTaxSchemeCode,
  }
}

export class SettingsRepository {
  async getCompanySettings(): Promise<CompanySettings | null> {
    const data = await getAuthenticatedCompany(db())
    return data ? mapCompany(data) : null
  }

  async createCompany(data: CompanySettings): Promise<CompanySettings> {
    const { data: inserted, error } = await db()
      .from('companies')
      .insert({ ...companyPayload(data), currency: 'COP', status: 'ACTIVE' })
      .select()
      .single()
    if (error) throw new Error('No se pudo registrar la empresa. Verifique los datos e intente de nuevo.')
    return mapCompany(inserted)
  }

  async updateCompanySettings(data: CompanySettings): Promise<CompanySettings> {
    const company = await getAuthenticatedCompany(db())
    if (!company) throw new Error('No se encontró la empresa del usuario.')

    const { data: updated, error } = await db()
      .from('companies')
      .update({ ...companyPayload(data), updated_at: new Date().toISOString() })
      .eq('id', company.id)
      .select()
      .maybeSingle()
    if (error || !updated) throw new Error('No se pudo guardar la información de la empresa.')
    return mapCompany(updated)
  }

  /** Lee la configuración editable a partir de la misma fuente que usan los módulos. */
  async getOperationalSettings(): Promise<{
    inventory: InventorySettings
    pos: POSSettings
    cash: CashSettings
    ecommerce: Omit<EcommerceSettings, 'dispatchLocationId'>
    general: GeneralSettings
  }> {
    invalidateRuntimeSettings()
    const runtime = await getRuntimeSettings(db())
    return {
      inventory: runtime.inventory,
      pos: runtime.pos,
      cash: runtime.cash,
      ecommerce: {
        superCatalogEnabled: runtime.storefront.superCatalogEnabled,
        distributorCatalogEnabled: runtime.storefront.distributorCatalogEnabled,
        whatsappPhone: runtime.storefront.whatsappPhone,
        whatsappQuoteTemplate: runtime.storefront.whatsappQuoteTemplate,
      },
      general: {
        exogenaDefaultYear: runtime.exogenaDefaultYear,
        sessionTimeoutMinutes: runtime.sessionTimeoutMinutes,
      },
    }
  }

  private async readJson(key: string): Promise<Record<string, unknown>> {
    const { data } = await db().from('system_settings').select('value').eq('key', key).maybeSingle()
    const value = data?.value
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return {}
      }
    }
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  }

  /** Guarda un valor; si la clave aún no existe la crea. RLS devuelve 0 filas a quien no es administrador. */
  private async writeSetting(
    key: string,
    value: unknown,
    meta: { category: string; type: 'JSON' | 'NUMBER'; description: string }
  ): Promise<void> {
    const now = new Date().toISOString()
    const { data, error } = await db()
      .from('system_settings')
      .update({ value, updated_at: now })
      .eq('key', key)
      .select('id')
    if (error) throw new Error('No se pudo guardar la configuración.')
    if (data && data.length > 0) {
      invalidateRuntimeSettings()
      return
    }

    const { error: insertError } = await db().from('system_settings').insert({
      key,
      value,
      category: meta.category,
      type: meta.type,
      description: meta.description,
      is_critical: false,
      requires_audit: true,
      updated_at: now,
    })
    if (insertError) throw new Error('No tiene permisos para modificar la configuración general.')
    invalidateRuntimeSettings()
  }

  /** Mezcla los campos en el JSON existente para no perder otros parámetros guardados en la misma clave. */
  private async mergeJsonSetting(
    key: string,
    patch: Record<string, unknown>,
    meta: { category: string; description: string }
  ): Promise<void> {
    const current = await this.readJson(key)
    await this.writeSetting(key, { ...current, ...patch, updatedAt: new Date().toISOString() }, { ...meta, type: 'JSON' })
  }

  async updateInventorySettings(data: InventorySettings): Promise<void> {
    await this.mergeJsonSetting(RUNTIME_SETTING_KEYS.inventory, { ...data }, {
      category: 'INVENTORY',
      description: 'Umbrales de stock predeterminados para productos nuevos e importados',
    })
  }

  async updatePOSSettings(data: POSSettings): Promise<void> {
    await this.mergeJsonSetting(RUNTIME_SETTING_KEYS.pos, { ...data }, {
      category: 'POS',
      description: 'Parámetros del punto de venta y reglas de caja',
    })
  }

  async updateCashSettings(data: CashSettings): Promise<void> {
    const current = await this.readJson(RUNTIME_SETTING_KEYS.pos)
    const rules = current.cashRegisterRules && typeof current.cashRegisterRules === 'object' ? current.cashRegisterRules : {}
    await this.mergeJsonSetting(RUNTIME_SETTING_KEYS.pos, { cashRegisterRules: { ...rules, ...data } }, {
      category: 'POS',
      description: 'Parámetros del punto de venta y reglas de caja',
    })
  }

  async updateEcommerceSettings(data: Omit<EcommerceSettings, 'dispatchLocationId'>): Promise<void> {
    const current = await this.readJson(RUNTIME_SETTING_KEYS.ecommerce)
    const whatsapp = current.whatsapp && typeof current.whatsapp === 'object' ? current.whatsapp : {}
    await this.mergeJsonSetting(
      RUNTIME_SETTING_KEYS.ecommerce,
      {
        superCatalogEnabled: data.superCatalogEnabled,
        distributorCatalogEnabled: data.distributorCatalogEnabled,
        whatsapp: { ...whatsapp, phoneNumber: data.whatsappPhone, defaultQuoteTemplate: data.whatsappQuoteTemplate },
      },
      { category: 'ECOMMERCE', description: 'Canales web, catálogos públicos y contacto por WhatsApp' }
    )
  }

  async updateGeneralSettings(data: GeneralSettings): Promise<void> {
    await this.writeSetting(RUNTIME_SETTING_KEYS.exogenaYear, data.exogenaDefaultYear, {
      category: 'EXOGENA',
      type: 'NUMBER',
      description: 'Año gravable predeterminado para información exógena',
    })
    await this.writeSetting(RUNTIME_SETTING_KEYS.sessionTimeout, data.sessionTimeoutMinutes, {
      category: 'SECURITY',
      type: 'NUMBER',
      description: 'Minutos de inactividad antes de cerrar la sesión',
    })
  }

  async getLocations(): Promise<LocationOption[]> {
    const { data, error } = await db()
      .from('locations')
      .select('id, code, name, is_ecommerce_source')
      .eq('status', 'ACTIVE')
      .order('name')
    if (error) return []
    return (data ?? []).map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      isEcommerceSource: Boolean(row.is_ecommerce_source),
    }))
  }

  /** Marca una sola bodega como origen de los pedidos web (la misma marca que edita el módulo Bodegas). */
  async setEcommerceDispatchLocation(locationId: string): Promise<void> {
    const client = db()
    if (locationId) {
      const { data, error } = await client
        .from('locations')
        .update({ is_ecommerce_source: true })
        .eq('id', locationId)
        .select('id')
      if (error || !data?.length) throw new Error('No se pudo asignar la bodega de despacho web.')
    }
    let clearQuery = client.from('locations').update({ is_ecommerce_source: false }).eq('is_ecommerce_source', true)
    if (locationId) clearQuery = clearQuery.neq('id', locationId)
    const { error } = await clearQuery
    if (error) throw new Error('No se pudo actualizar la bodega de despacho web.')
  }

  async getFiscalOverview(): Promise<FiscalOverview> {
    const [resolutionRes, softwareRes] = await Promise.all([
      db()
        .from('dian_resolutions')
        .select('dian_prefix, resolution_number, valid_from, valid_to, initial_range, final_range, last_assigned_number, environment')
        .eq('is_active', true)
        .order('valid_to', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db()
        .from('dian_software_config')
        .select('software_name, environment, operation_mode, certificate_expiration')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
    ])
    const r: any = resolutionRes.data
    const s: any = softwareRes.data
    return {
      resolution: r
        ? {
            prefix: r.dian_prefix,
            resolutionNumber: r.resolution_number,
            validFrom: r.valid_from,
            validTo: r.valid_to,
            initialRange: Number(r.initial_range ?? 0),
            finalRange: Number(r.final_range ?? 0),
            lastAssignedNumber: Number(r.last_assigned_number ?? 0),
            environment: r.environment || '',
          }
        : null,
      software: s
        ? {
            softwareName: s.software_name || '',
            environment: s.environment || '',
            operationMode: s.operation_mode || '',
            certificateExpiration: s.certificate_expiration,
          }
        : null,
    }
  }

  async getAccountingOverview(): Promise<AccountingOverview> {
    const [periodsRes, accountsRes] = await Promise.all([
      db()
        .from('accounting_periods')
        .select('period_code, month, year, status')
        .eq('status', 'OPEN')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(6),
      db().from('accounting_default_accounts').select('purpose, account:accounting_accounts(code, name)'),
    ])
    return {
      openPeriods: (periodsRes.data ?? []).map((p: any) => ({
        code: p.period_code,
        label: new Date(p.year, Number(p.month) - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
      })),
      defaultAccounts: (accountsRes.data ?? [])
        .map((row: any) => ({
          purpose: ACCOUNT_PURPOSE_LABELS[row.purpose] || row.purpose,
          code: row.account?.code || '',
          name: row.account?.name || '',
        }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    }
  }

  /** Roles y permisos tal como están en la base (la misma fuente que aplica RLS). */
  async getRoles(): Promise<RoleSummary[]> {
    const { data, error } = await db()
      .from('roles')
      .select('id, code, name, description, scope, role_permissions(permission:permissions(code))')
      .order('name')
    if (error) return []
    return (data ?? []).map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || '',
      scope: row.scope || '',
      permissions: (row.role_permissions ?? [])
        .map((rp: any) => rp.permission?.code)
        .filter(Boolean)
        .sort(),
    }))
  }

  async getStats(rolesCount: number, activeLocationsCount: number): Promise<SettingsStats> {
    const { data: latestLog } = await db()
      .from('audit_logs')
      .select('created_at, user_name')
      .eq('module', 'SETTINGS')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return {
      editableSettingsCount: EDITABLE_SETTINGS_COUNT,
      lastModifiedAt: latestLog?.created_at ?? null,
      lastModifiedBy: latestLog?.user_name ?? null,
      rolesCount,
      activeLocationsCount,
    }
  }
}

export const settingsRepository = new SettingsRepository()
