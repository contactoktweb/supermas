/**
 * SUPER MÁS ERP/POS - Servicio de Negocio de Exógena Tributaria
 *
 * Coordina la parametrización normativa por año gravable, la consolidación
 * desde módulos operativos, validación con detección de inconsistencias,
 * conciliación contable y generación de archivos DIAN.
 */

import { exogenaRepository } from '../repositories/exogena.repository'
import { exogenaValidator } from '../validators/exogena.validator'
import { exogenaGenerator } from '../generators/exogena.generator'
import {
  ExogenaYearNormativa,
  ExogenaFormatConfig,
  ExogenaStats,
  ExogenaRecord,
  ExogenaValidationError,
  ExogenaConciliationItem,
  ExogenaGenerationRecord,
  ExogenaPermission,
} from '../types'

const ROLE_PERMISSIONS: Record<string, ExogenaPermission[]> = {
  SUPERADMIN: [
    'exogena.read',
    'exogena.configure',
    'exogena.generate',
    'exogena.validate',
    'exogena.export',
    'exogena.audit',
  ],
  STORE_ADMIN: [
    'exogena.read',
    'exogena.validate',
    'exogena.export',
  ],
  ACCOUNTANT: [
    'exogena.read',
    'exogena.configure',
    'exogena.generate',
    'exogena.validate',
    'exogena.export',
    'exogena.audit',
  ],
  CASHIER: [],
  SELLER: [],
}

export class ExogenaService {
  /**
   * Valida si el rol posee el permiso requerido para Exógena.
   */
  hasPermission(permission: ExogenaPermission, userRole?: string): boolean {
    if (!userRole) return true // Sesión activa por defecto en prototipo
    const allowed = ROLE_PERMISSIONS[userRole] || []
    return allowed.includes(permission)
  }

  private assertPermission(permission: ExogenaPermission, userRole?: string): void {
    if (!this.hasPermission(permission, userRole)) {
      throw new Error(`Permiso denegado: Se requiere autorización '${permission}' para esta operación tributaria.`)
    }
  }

  /**
   * Consulta los años gravables disponibles.
   */
  async getAvailableYears(userRole?: string) {
    this.assertPermission('exogena.read', userRole)
    return exogenaRepository.getAvailableYears()
  }

  /**
   * Obtiene la parametrización normativa de un año gravable.
   */
  async getNormativaByYear(year: number, userRole?: string): Promise<ExogenaYearNormativa> {
    this.assertPermission('exogena.read', userRole)
    const normativa = await exogenaRepository.getNormativaByYear(year)
    if (!normativa) {
      throw new Error(`No se encontró configuración normativa para el año ${year}.`)
    }
    return normativa
  }

  /**
   * Actualiza la parametrización de formatos y obligado para un año gravable.
   */
  async updateNormativa(
    year: number,
    data: {
      obligadoType?: string
      responsibleName?: string
      dueDate?: string
      enabledFormats?: string[]
      grossRevenueThreshold?: number
    },
    user: { id: string; name: string },
    userRole?: string
  ): Promise<ExogenaYearNormativa> {
    this.assertPermission('exogena.configure', userRole)
    return exogenaRepository.updateNormativa(year, data, user)
  }

  /**
   * Consulta las estadísticas globales de preparación de Exógena.
   */
  async getStats(year: number, userRole?: string): Promise<ExogenaStats> {
    this.assertPermission('exogena.read', userRole)
    return exogenaRepository.getStats(year)
  }

  /**
   * Obtiene el listado de formatos de un año enriquecido con conteo de registros y errores.
   */
  async getFormatsSummary(year: number, userRole?: string): Promise<ExogenaFormatConfig[]> {
    this.assertPermission('exogena.read', userRole)
    const normativa = await this.getNormativaByYear(year, userRole)
    const rawRecords = await exogenaRepository.consolidateRecords(year)
    const validation = exogenaValidator.validateBatch(rawRecords)

    return normativa.formats.map((fmt) => {
      const formatRecords = validation.records.filter((r) => r.formatNumber === fmt.formatNumber)
      const formatErrors = validation.errors.filter((e) => e.formatNumber === fmt.formatNumber && e.severity === 'ERROR')
      const formatWarnings = validation.errors.filter((e) => e.formatNumber === fmt.formatNumber && e.severity === 'ADVERTENCIA')

      return {
        ...fmt,
        recordsCount: formatRecords.length,
        errorsCount: formatErrors.length,
        warningsCount: formatWarnings.length,
      }
    })
  }

  /**
   * Ejecuta la validación exhaustiva de los registros consolidados de un año gravable.
   */
  async validateYearData(
    year: number,
    userRole?: string
  ): Promise<{
    records: ExogenaRecord[]
    errors: ExogenaValidationError[]
    totalErrors: number
    totalWarnings: number
    canGenerate: boolean
  }> {
    this.assertPermission('exogena.validate', userRole)
    const rawRecords = await exogenaRepository.consolidateRecords(year)
    const result = exogenaValidator.validateBatch(rawRecords)

    exogenaRepository.logAudit({
      action: 'EXOGENA_VALIDATION_EXECUTED',
      year,
      userId: 'usr-admin',
      userName: 'Admin Mauricio',
      details: `Validación ejecutada para año ${year}: ${result.records.length} registros analizados, ${result.totalErrors} errores críticos, ${result.totalWarnings} advertencias.`,
    })

    return result
  }

  /**
   * Consulta la conciliación contable de Exógena frente a libros.
   */
  async getConciliation(year: number, userRole?: string): Promise<ExogenaConciliationItem[]> {
    this.assertPermission('exogena.read', userRole)
    return exogenaRepository.getConciliation(year)
  }

  /**
   * Genera el paquete de archivos XML o CSV de Exógena para los formatos seleccionados.
   * Regla crítica: Si existen errores de validación críticos, la generación se bloquea.
   */
  async generatePackage(
    year: number,
    formatNumbers: string[],
    fileFormat: 'XML' | 'CSV',
    notes: string = '',
    user: { id: string; name: string; role: string },
    userRole?: string
  ): Promise<{
    generation: ExogenaGenerationRecord
    files: Array<{ formatNumber: string; fileName: string; content: string; recordCount: number }>
  }> {
    this.assertPermission('exogena.generate', userRole)

    const normativa = await this.getNormativaByYear(year, userRole)
    const rawRecords = await exogenaRepository.consolidateRecords(year, formatNumbers)
    const validation = exogenaValidator.validateBatch(rawRecords)

    if (!validation.canGenerate) {
      throw new Error(
        `Generación bloqueada: Se detectaron ${validation.totalErrors} errores críticos de validación en la información de terceros o valores. Debe subsanar los errores antes de generar el paquete final DIAN.`
      )
    }

    const generatedFiles: Array<{
      formatNumber: string
      fileName: string
      content: string
      recordCount: number
    }> = []

    for (const fmtNum of formatNumbers) {
      const fmtConfig = normativa.formats.find((f) => f.formatNumber === fmtNum)
      const version = fmtConfig?.version || 10

      if (fileFormat === 'XML') {
        const xml = exogenaGenerator.generateXML(
          fmtNum,
          version,
          year,
          validation.records,
          normativa.companyNit
        )
        generatedFiles.push({
          formatNumber: fmtNum,
          fileName: xml.fileName,
          content: xml.content,
          recordCount: xml.totalRecords,
        })
      } else {
        const csv = exogenaGenerator.generateCSV(
          fmtNum,
          version,
          year,
          validation.records
        )
        const formatRecords = validation.records.filter((r) => r.formatNumber === fmtNum)
        generatedFiles.push({
          formatNumber: fmtNum,
          fileName: csv.fileName,
          content: csv.content,
          recordCount: formatRecords.length,
        })
      }
    }

    const batchCode = `EXO-${year}-${Date.now().toString().slice(-5)}`
    const nowIso = new Date().toISOString()
    const mainFile = generatedFiles[0]?.fileName || `Exogena_${year}.zip`

    const generationRecord: ExogenaGenerationRecord = {
      id: `gen-${year}-${Date.now()}`,
      year,
      batchCode,
      date: nowIso,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      formatsIncluded: formatNumbers,
      totalRecords: validation.records.length,
      totalErrors: validation.totalErrors,
      totalWarnings: validation.totalWarnings,
      status: 'GENERATED',
      fileFormat,
      fileName: mainFile,
      fileUrl: `/exports/exogena/${year}/${mainFile}`,
      checksum: `sha256-${Math.random().toString(36).substring(2, 12)}`,
      notes: notes || `Generación exitosa de ${formatNumbers.length} formatos para la DIAN.`,
    }

    await exogenaRepository.saveGeneration(generationRecord, user)

    return {
      generation: generationRecord,
      files: generatedFiles,
    }
  }

  /**
   * Consulta el historial de paquetes generados.
   */
  async getGenerationsHistory(year?: number, userRole?: string): Promise<ExogenaGenerationRecord[]> {
    this.assertPermission('exogena.read', userRole)
    return exogenaRepository.getGenerationsHistory(year)
  }

  /**
   * Exporta a archivo plano CSV un formato individual para descarga directa.
   */
  async exportFormatCSV(year: number, formatNumber: string, userRole?: string): Promise<{ fileName: string; content: string }> {
    this.assertPermission('exogena.export', userRole)
    const normativa = await this.getNormativaByYear(year, userRole)
    const fmtConfig = normativa.formats.find((f) => f.formatNumber === formatNumber)
    const version = fmtConfig?.version || 10
    const records = await exogenaRepository.consolidateRecords(year, [formatNumber])

    return exogenaGenerator.generateCSV(formatNumber, version, year, records)
  }
}

export const exogenaService = new ExogenaService()
