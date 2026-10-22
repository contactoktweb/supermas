/**
 * SUPER MÁS ERP/POS - Servicio de Configuración General.
 *
 * Valida con Zod, verifica el permiso settings.manage (la base lo vuelve a exigir con RLS) y
 * registra cada cambio en auditoría.
 */

import { settingsRepository } from '../repositories/settings.repository'
import { auditService } from '@/features/audit/services/audit.service'
import {
  cashSettingsSchema,
  companySettingsSchema,
  ecommerceSettingsSchema,
  generalSettingsSchema,
  inventorySettingsSchema,
  posSettingsSchema,
} from '../schemas/settings.schema'
import type {
  CashSettings,
  CompanySettings,
  EcommerceSettings,
  GeneralSettings,
  InventorySettings,
  POSSettings,
  UserSettingsContext,
} from '../types'

type AuditChange = { label: string; field: string; previousValue: string; newValue: string }

export class SettingsService {
  private assertCanManage(user: UserSettingsContext): void {
    const isAdmin = user.role === 'SUPERADMIN' || user.role === 'ADMIN'
    if (isAdmin || user.permissions.includes('settings.manage')) return
    throw new Error('No tiene permisos para modificar la configuración general.')
  }

  private async audit(user: UserSettingsContext, entity: string, reference: string, details: string, changes: AuditChange[]) {
    await auditService.log({
      action: 'SETTING_UPDATED',
      module: 'SETTINGS',
      entityType: entity,
      entityId: entity,
      entityReference: reference,
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      level: 'INFO',
      details,
      changes,
    })
  }

  private diff<T extends object>(labels: Partial<Record<keyof T, string>>, before: T, after: T): AuditChange[] {
    return (Object.keys(labels) as Array<keyof T>)
      .filter((field) => String(before[field]) !== String(after[field]))
      .map((field) => ({
        label: labels[field] as string,
        field: String(field),
        previousValue: String(before[field] ?? ''),
        newValue: String(after[field] ?? ''),
      }))
  }

  async saveCompany(input: CompanySettings, current: CompanySettings | null, user: UserSettingsContext): Promise<CompanySettings> {
    this.assertCanManage(user)
    const validated = companySettingsSchema.parse(input) as CompanySettings
    const saved = current?.id
      ? await settingsRepository.updateCompanySettings(validated)
      : await settingsRepository.createCompany(validated)

    const changes = current
      ? this.diff<CompanySettings>(
          {
            companyName: 'Nombre comercial',
            legalName: 'Razón social',
            nit: 'NIT',
            address: 'Dirección',
            city: 'Ciudad',
            postalCode: 'Código postal',
            dianMunicipalityCode: 'Municipio DIAN',
            rutResponsibilities: 'Responsabilidades RUT',
            dianTaxLevelCodes: 'Responsabilidad fiscal DIAN',
          },
          current,
          saved
        )
      : []
    await this.audit(user, 'COMPANY_SETTINGS', saved.nit, `Datos de la empresa ${current ? 'actualizados' : 'registrados'} por ${user.name}.`, changes)
    return saved
  }

  async saveInventory(input: InventorySettings, current: InventorySettings, user: UserSettingsContext): Promise<void> {
    this.assertCanManage(user)
    const validated = inventorySettingsSchema.parse(input)
    await settingsRepository.updateInventorySettings(validated)
    await this.audit(user, 'INVENTORY_SETTINGS', 'Inventario', `Umbrales de stock actualizados por ${user.name}.`,
      this.diff<InventorySettings>({ defaultMinStockThreshold: 'Stock mínimo', criticalLowStockThreshold: 'Umbral crítico' }, current, validated))
  }

  async savePOS(input: POSSettings, current: POSSettings, user: UserSettingsContext): Promise<void> {
    this.assertCanManage(user)
    const validated = posSettingsSchema.parse(input)
    await settingsRepository.updatePOSSettings(validated)
    await this.audit(user, 'POS_SETTINGS', 'Punto de venta', `Parámetros del punto de venta actualizados por ${user.name}.`,
      this.diff<POSSettings>({ defaultLocationId: 'Sede predeterminada', autoPrintReceipt: 'Impresión automática' }, current, validated))
  }

  async saveCash(input: CashSettings, current: CashSettings, user: UserSettingsContext): Promise<void> {
    this.assertCanManage(user)
    const validated = cashSettingsSchema.parse(input)
    await settingsRepository.updateCashSettings(validated)
    await this.audit(user, 'CASH_SETTINGS', 'Cajas', `Reglas de caja actualizadas por ${user.name}.`,
      this.diff<CashSettings>(
        {
          recommendedInitialFloat: 'Base sugerida',
          maxAllowedInitialFloat: 'Base máxima',
          maxDifferenceToleranceAmount: 'Tolerancia de descuadre',
        },
        current,
        validated
      ))
  }

  async saveEcommerce(input: EcommerceSettings, current: EcommerceSettings, user: UserSettingsContext): Promise<void> {
    this.assertCanManage(user)
    const validated = ecommerceSettingsSchema.parse(input)
    if (validated.dispatchLocationId !== current.dispatchLocationId) {
      await settingsRepository.setEcommerceDispatchLocation(validated.dispatchLocationId)
    }
    await settingsRepository.updateEcommerceSettings(validated)
    await this.audit(user, 'ECOMMERCE_SETTINGS', 'Canales web', `Canales web actualizados por ${user.name}.`,
      this.diff<EcommerceSettings>(
        {
          dispatchLocationId: 'Bodega de despacho web',
          superCatalogEnabled: 'Catálogo Super Más',
          distributorCatalogEnabled: 'Catálogo Distribuidora',
          whatsappPhone: 'WhatsApp comercial',
        },
        current,
        validated
      ))
  }

  async saveGeneral(input: GeneralSettings, current: GeneralSettings, user: UserSettingsContext): Promise<void> {
    this.assertCanManage(user)
    const validated = generalSettingsSchema.parse(input)
    await settingsRepository.updateGeneralSettings(validated)
    await this.audit(user, 'GENERAL_SETTINGS', 'Exógena y seguridad', `Parámetros generales actualizados por ${user.name}.`,
      this.diff<GeneralSettings>(
        { exogenaDefaultYear: 'Año gravable de exógena', sessionTimeoutMinutes: 'Minutos de inactividad' },
        current,
        validated
      ))
  }
}

export const settingsService = new SettingsService()
