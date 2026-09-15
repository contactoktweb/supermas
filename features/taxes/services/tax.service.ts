/**
 * SUPER MÁS ERP/POS - Servicio de Negocio de Impuestos
 *
 * Contiene las reglas de negocio, validaciones tributarias, inmutabilidad histórica,
 * control de permisos y orquestación con el repositorio y el servicio de cálculo.
 */

import { taxRepository } from '../repositories/tax.repository'
import { taxCalculationService } from './tax-calculation.service'
import { taxConfigFormSchema, TaxConfigFormData } from '../schemas/tax.schema'
import {
  TaxConfig,
  TaxFilters,
  TaxStats,
  TaxAssociatedProduct,
  TaxReportFilters,
  TaxReportItem,
  TaxReportSummary,
  TaxPermission,
} from '../types'

// Roles permitidos por acción en Super Más ERP
const ROLE_PERMISSIONS: Record<string, TaxPermission[]> = {
  SUPERADMIN: [
    'tax.read',
    'tax.create',
    'tax.update',
    'tax.deactivate',
    'tax.assign',
    'tax.report',
    'tax.export',
  ],
  STORE_ADMIN: [
    'tax.read',
    'tax.create',
    'tax.update',
    'tax.deactivate',
    'tax.assign',
    'tax.report',
    'tax.export',
  ],
  ACCOUNTANT: [
    'tax.read',
    'tax.create',
    'tax.update',
    'tax.report',
    'tax.export',
  ],
  CASHIER: ['tax.read'],
  SELLER: ['tax.read'],
}

export class TaxService {
  /**
   * Valida si un rol tiene el permiso tributario solicitado.
   */
  hasPermission(permission: TaxPermission, userRole?: string): boolean {
    if (!userRole) return true // Modo desarrollo / prototipo con sesión activa
    const allowed = ROLE_PERMISSIONS[userRole] || []
    return allowed.includes(permission)
  }

  private assertPermission(permission: TaxPermission, userRole?: string): void {
    if (!this.hasPermission(permission, userRole)) {
      throw new Error(`Permiso denegado: Se requiere la autorización '${permission}' para esta operación.`)
    }
  }

  /**
   * Consulta el listado de configuraciones tributarias con filtros y paginación.
   */
  async list(
    filters?: TaxFilters,
    userRole?: string
  ): Promise<{ data: TaxConfig[]; total: number }> {
    this.assertPermission('tax.read', userRole)
    return taxRepository.findAll(filters)
  }

  /**
   * Consulta el detalle de una configuración por ID con métricas relacionales.
   */
  async getById(id: string, userRole?: string): Promise<TaxConfig> {
    this.assertPermission('tax.read', userRole)
    const found = await taxRepository.findById(id)
    if (!found) {
      throw new Error(`La configuración de impuesto '${id}' no existe.`)
    }
    return found
  }

  /**
   * Obtiene las métricas y estadísticas globales tributarias del ERP.
   */
  async getTaxStats(userRole?: string): Promise<TaxStats> {
    this.assertPermission('tax.read', userRole)
    return taxRepository.getStats()
  }

  /**
   * Crea una nueva configuración tributaria con validación Zod y verificación de código único.
   */
  async createTaxConfig(
    data: TaxConfigFormData,
    user: { id: string; name: string },
    userRole?: string
  ): Promise<TaxConfig> {
    this.assertPermission('tax.create', userRole)

    // Validación de esquema Zod
    const validated = taxConfigFormSchema.parse(data)

    // Verificar código único
    const existing = await taxRepository.findByCode(validated.code)
    if (existing) {
      throw new Error(
        `Ya existe una configuración con el código '${validated.code}'. Los códigos tributarios deben ser únicos.`
      )
    }

    return taxRepository.create(validated, user)
  }

  /**
   * Actualiza una configuración tributaria.
   * Regla de negocio crítica: Si la configuración ya tiene transacciones emitidas (ventas o compras),
   * no se permite alterar arbitrariamente su tarifa porcentual ni su código.
   * En tal caso, se debe crear una nueva configuración o versión con nueva vigencia.
   */
  async updateTaxConfig(
    id: string,
    data: Partial<TaxConfigFormData>,
    user: { id: string; name: string },
    userRole?: string
  ): Promise<TaxConfig> {
    this.assertPermission('tax.update', userRole)

    const existing = await taxRepository.findById(id)
    if (!existing) {
      throw new Error(`La configuración de impuesto '${id}' no existe.`)
    }

    const hasTransactions =
      (existing.salesCount || 0) > 0 || (existing.purchasesCount || 0) > 0

    // Si cambia la tarifa y tiene histórico, proteger la inmutabilidad tributaria
    if (
      hasTransactions &&
      data.ratePercent !== undefined &&
      Number(data.ratePercent) !== existing.ratePercent
    ) {
      throw new Error(
        `Inmutabilidad tributaria: La configuración '${existing.name}' ya ha sido utilizada en ${existing.salesCount} ventas y ${existing.purchasesCount} compras. Para cambiar la tarifa del ${existing.ratePercent}% al ${data.ratePercent}%, debe crear una nueva configuración con su propia vigencia para no corromper los históricos fiscales.`
      )
    }

    // Si intenta cambiar el código y tiene transacciones, no permitirlo
    if (
      hasTransactions &&
      data.code &&
      data.code.toUpperCase() !== existing.code.toUpperCase()
    ) {
      throw new Error(
        `No se puede modificar el código de una configuración tributaria que ya posee documentos vinculados.`
      )
    }

    // Si cambia el código en una config sin transacciones, verificar que no colisione
    if (
      data.code &&
      data.code.toUpperCase() !== existing.code.toUpperCase()
    ) {
      const codeCheck = await taxRepository.findByCode(data.code)
      if (codeCheck && codeCheck.id !== id) {
        throw new Error(
          `El código '${data.code}' ya se encuentra en uso por otra configuración.`
        )
      }
    }

    return taxRepository.update(id, data, user)
  }

  /**
   * Desactiva una configuración (soft-delete protector de históricos).
   */
  async deactivateTaxConfig(
    id: string,
    reason: string,
    user: { id: string; name: string },
    userRole?: string
  ): Promise<TaxConfig> {
    this.assertPermission('tax.deactivate', userRole)
    return taxRepository.deactivate(id, reason, user)
  }

  /**
   * Reactiva una configuración tributaria.
   */
  async activateTaxConfig(
    id: string,
    user: { id: string; name: string },
    userRole?: string
  ): Promise<TaxConfig> {
    this.assertPermission('tax.update', userRole)
    return taxRepository.activate(id, user)
  }

  /**
   * Obtiene los productos asociados a la configuración bajo demanda.
   */
  async getAssociatedProducts(
    taxConfigId: string,
    filters?: { query?: string; page?: number; pageSize?: number },
    userRole?: string
  ): Promise<{ data: TaxAssociatedProduct[]; total: number }> {
    this.assertPermission('tax.read', userRole)
    return taxRepository.getAssociatedProducts(taxConfigId, filters)
  }

  /**
   * Consulta los reportes tributarios consolidados.
   */
  async getTaxReports(
    filters?: TaxReportFilters,
    userRole?: string
  ): Promise<{ items: TaxReportItem[]; summary: TaxReportSummary }> {
    this.assertPermission('tax.report', userRole)
    return taxRepository.getTaxReports(filters)
  }

  /**
   * Exporta a formato CSV los datos de las configuraciones tributarias.
   */
  async exportTaxConfigsToCSV(filters?: TaxFilters, userRole?: string): Promise<string> {
    this.assertPermission('tax.export', userRole)
    const { data } = await taxRepository.findAll({ ...filters, page: 1, pageSize: 1000 })

    const headers = [
      'Código',
      'Nombre',
      'Tipo',
      'Tarifa (%)',
      'Estado',
      'Inicio Vigencia',
      'Fin Vigencia',
      'Productos Asociados',
      'Cuenta IVA Generado',
      'Cuenta IVA Descontable',
      'Descripción',
    ]

    const rows = data.map((t) => [
      `"${t.code}"`,
      `"${t.name.replace(/"/g, '""')}"`,
      `"${t.type}"`,
      t.ratePercent,
      `"${t.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}"`,
      `"${t.validFrom}"`,
      `"${t.validUntil || 'Indefinida'}"`,
      t.associatedProductsCount || 0,
      `"${t.generatedTaxAccountId || ''}"`,
      `"${t.deductibleTaxAccountId || ''}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
    ])

    return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
  }

  /**
   * Exporta a formato CSV el reporte tributario de operaciones.
   */
  async exportTaxReportsToCSV(filters?: TaxReportFilters, userRole?: string): Promise<string> {
    this.assertPermission('tax.export', userRole)
    const { items } = await taxRepository.getTaxReports(filters)

    const headers = [
      'Documento',
      'Tipo Operación',
      'Fecha',
      'Ubicación / Bodega',
      'NIT / Documento',
      'Tercero',
      'Impuesto',
      'Tarifa (%)',
      'Base Gravable COP',
      'Valor Impuesto COP',
      'Total Documento COP',
    ]

    const rows = items.map((i) => [
      `"${i.documentNumber}"`,
      `"${i.operationType === 'GENERATED' ? 'IVA Generado (Venta)' : 'IVA Descontable (Compra)'}"`,
      `"${i.date}"`,
      `"${i.locationName || ''}"`,
      `"${i.thirdPartyDoc}"`,
      `"${i.thirdPartyName.replace(/"/g, '""')}"`,
      `"${i.taxConfigName}"`,
      i.ratePercent,
      taxCalculationService.roundMoney(i.baseAmount),
      taxCalculationService.roundMoney(i.taxAmount),
      taxCalculationService.roundMoney(i.totalAmount),
    ])

    return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
  }
}

export const taxService = new TaxService()
