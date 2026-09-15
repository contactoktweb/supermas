/**
 * SUPER MÁS ERP/POS - Motor de Validación de Exógena Tributaria (DIAN)
 *
 * Revisa exhaustivamente campos obligatorios, algoritmos de DV (Módulo 11),
 * consistencia de valores, conceptos y datos de terceros antes de la generación.
 */

import { ExogenaRecord, ExogenaValidationError } from '../types'

export class ExogenaValidator {
  /**
   * Algoritmo oficial DIAN (Módulo 11) para cálculo del Dígito de Verificación (DV).
   */
  calculateVerificationDigit(nitRaw: string): string {
    const cleanNit = nitRaw.replace(/\D/g, '')
    if (!cleanNit) return '0'

    const weights = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3]
    let sum = 0
    let weightIndex = weights.length - 1

    for (let i = cleanNit.length - 1; i >= 0; i--) {
      sum += parseInt(cleanNit.charAt(i), 10) * weights[weightIndex]
      weightIndex--
      if (weightIndex < 0) break
    }

    const remainder = sum % 11
    if (remainder > 1) {
      return (11 - remainder).toString()
    }
    return remainder.toString()
  }

  /**
   * Valida un registro individual de Exógena identificando errores y advertencias.
   */
  validateRecord(record: ExogenaRecord): ExogenaValidationError[] {
    const errors: ExogenaValidationError[] = []
    const cleanDoc = record.documentNumber.replace(/\D/g, '')

    // 1. Validaciones Críticas de Documento e Identificación
    if (!record.documentNumber || cleanDoc.length === 0) {
      errors.push({
        id: `err-${record.id}-doc`,
        severity: 'ERROR',
        formatNumber: record.formatNumber,
        recordId: record.id,
        thirdPartyName: record.businessName || 'Sin razón social',
        thirdPartyDoc: record.documentNumber || 'VACÍO',
        field: 'documentNumber',
        currentValue: record.documentNumber || '(Vacío)',
        issueDescription: 'El número de identificación del tercero es obligatorio y no puede estar vacío.',
        sourceOrigin: `${record.sourceType}: ${record.documentReference}`,
      })
    } else if (cleanDoc.length < 5) {
      errors.push({
        id: `err-${record.id}-doclen`,
        severity: 'ERROR',
        formatNumber: record.formatNumber,
        recordId: record.id,
        thirdPartyName: record.businessName,
        thirdPartyDoc: record.documentNumber,
        field: 'documentNumber',
        currentValue: record.documentNumber,
        issueDescription: 'El documento de identificación tiene una longitud inferior a 5 dígitos, no admitida por la DIAN.',
        sourceOrigin: `${record.sourceType}: ${record.documentReference}`,
      })
    }

    // 2. Validación de Dígito de Verificación para NIT
    if (record.thirdPartyType === 'NIT' && cleanDoc.length >= 8) {
      const expectedDV = this.calculateVerificationDigit(cleanDoc)
      if (!record.verificationDigit || record.verificationDigit !== expectedDV) {
        errors.push({
          id: `warn-${record.id}-dv`,
          severity: 'ADVERTENCIA',
          formatNumber: record.formatNumber,
          recordId: record.id,
          thirdPartyName: record.businessName,
          thirdPartyDoc: record.documentNumber,
          field: 'verificationDigit',
          currentValue: record.verificationDigit || '(Sin DV)',
          issueDescription: `Dígito de verificación incorrecto o ausente. El DV calculado mediante algoritmo Módulo 11 es '${expectedDV}'.`,
          sourceOrigin: `${record.sourceType}: ${record.documentReference}`,
        })
      }
    }

    // 3. Validación de Nombre / Razón Social
    if (!record.businessName || record.businessName.trim().length < 3) {
      errors.push({
        id: `err-${record.id}-name`,
        severity: 'ERROR',
        formatNumber: record.formatNumber,
        recordId: record.id,
        thirdPartyName: record.businessName || '(Vacío)',
        thirdPartyDoc: record.documentNumber,
        field: 'businessName',
        currentValue: record.businessName || '(Vacío)',
        issueDescription: 'La razón social o nombres del tercero son obligatorios y deben superar 3 caracteres.',
        sourceOrigin: `${record.sourceType}: ${record.documentReference}`,
      })
    }

    // 4. Validación de Ubicación Geográfica (DANE)
    if (!record.address || record.address.trim().length < 4) {
      errors.push({
        id: `warn-${record.id}-addr`,
        severity: 'ADVERTENCIA',
        formatNumber: record.formatNumber,
        recordId: record.id,
        thirdPartyName: record.businessName,
        thirdPartyDoc: record.documentNumber,
        field: 'address',
        currentValue: record.address || '(Sin dirección)',
        issueDescription: 'La dirección física del tercero está incompleta o vacía. La DIAN exige domicilio fiscal válido.',
        sourceOrigin: `${record.sourceType}: ${record.documentReference}`,
      })
    }

    if (!record.departmentCode || !record.cityCode) {
      errors.push({
        id: `warn-${record.id}-dane`,
        severity: 'ADVERTENCIA',
        formatNumber: record.formatNumber,
        recordId: record.id,
        thirdPartyName: record.businessName,
        thirdPartyDoc: record.documentNumber,
        field: 'cityCode',
        currentValue: `${record.departmentCode || '??'}/${record.cityCode || '??'}`,
        issueDescription: 'Faltan los códigos DANE de departamento o municipio del tercero.',
        sourceOrigin: `${record.sourceType}: ${record.documentReference}`,
      })
    }

    // 5. Validación de Concepto Tributario
    if (!record.conceptCode) {
      errors.push({
        id: `err-${record.id}-concept`,
        severity: 'ERROR',
        formatNumber: record.formatNumber,
        recordId: record.id,
        thirdPartyName: record.businessName,
        thirdPartyDoc: record.documentNumber,
        field: 'conceptCode',
        currentValue: '(Sin concepto)',
        issueDescription: 'El registro no tiene asignado un concepto normativo DIAN válido para este formato.',
        sourceOrigin: `${record.sourceType}: ${record.documentReference}`,
      })
    }

    // 6. Validación de Valores
    if (record.baseAmount < 0) {
      errors.push({
        id: `err-${record.id}-negative`,
        severity: 'ERROR',
        formatNumber: record.formatNumber,
        recordId: record.id,
        thirdPartyName: record.businessName,
        thirdPartyDoc: record.documentNumber,
        field: 'baseAmount',
        currentValue: `$${record.baseAmount.toLocaleString('es-CO')}`,
        issueDescription: 'El valor base del pago o abono no puede ser negativo en la estructura general de medios magnéticos.',
        sourceOrigin: `${record.sourceType}: ${record.documentReference}`,
      })
    }

    if (
      record.withholdingAmount !== undefined &&
      record.withholdingAmount > record.baseAmount &&
      record.baseAmount > 0
    ) {
      errors.push({
        id: `err-${record.id}-wh-exceed`,
        severity: 'ERROR',
        formatNumber: record.formatNumber,
        recordId: record.id,
        thirdPartyName: record.businessName,
        thirdPartyDoc: record.documentNumber,
        field: 'withholdingAmount',
        currentValue: `$${record.withholdingAmount.toLocaleString('es-CO')}`,
        issueDescription: 'La retención en la fuente practicada excede el valor total de la base económica reportada.',
        sourceOrigin: `${record.sourceType}: ${record.documentReference}`,
      })
    }

    return errors
  }

  /**
   * Ejecuta la validación masiva sobre un conjunto de registros de Exógena,
   * detecta duplicidades y anota cada registro con su estado.
   */
  validateBatch(records: ExogenaRecord[]): {
    records: ExogenaRecord[]
    errors: ExogenaValidationError[]
    totalErrors: number
    totalWarnings: number
    canGenerate: boolean
  } {
    const allErrors: ExogenaValidationError[] = []

    // Map para detección de duplicados por Tercero + Concepto + Formato
    const duplicateTracker = new Map<string, number>()

    const updatedRecords = records.map((rec) => {
      const recErrors = this.validateRecord(rec)
      allErrors.push(...recErrors)

      // Clave de unicidad
      const dupKey = `${rec.formatNumber}-${rec.conceptCode}-${rec.documentNumber}`
      const seenCount = duplicateTracker.get(dupKey) || 0
      duplicateTracker.set(dupKey, seenCount + 1)

      if (seenCount > 0) {
        allErrors.push({
          id: `warn-${rec.id}-dup-${seenCount}`,
          severity: 'ADVERTENCIA',
          formatNumber: rec.formatNumber,
          recordId: rec.id,
          thirdPartyName: rec.businessName,
          thirdPartyDoc: rec.documentNumber,
          field: 'documentNumber',
          currentValue: rec.documentNumber,
          issueDescription: `Se detectaron múltiples movimientos para el mismo tercero bajo el concepto ${rec.conceptCode}. Se recomienda consolidar en una sola línea según instructivo DIAN.`,
          sourceOrigin: `${rec.sourceType}: ${rec.documentReference}`,
        })
      }

      const hasCriticalError = recErrors.some((e) => e.severity === 'ERROR')
      const hasWarning = recErrors.some((e) => e.severity === 'ADVERTENCIA')

      const validationStatus: 'VALID' | 'WARNING' | 'ERROR' = hasCriticalError
        ? 'ERROR'
        : hasWarning
        ? 'WARNING'
        : 'VALID'

      return {
        ...rec,
        validationStatus,
        validationNotes: recErrors.map((e) => e.issueDescription),
      }
    })

    const totalErrors = allErrors.filter((e) => e.severity === 'ERROR').length
    const totalWarnings = allErrors.filter((e) => e.severity === 'ADVERTENCIA').length

    return {
      records: updatedRecords,
      errors: allErrors,
      totalErrors,
      totalWarnings,
      canGenerate: totalErrors === 0,
    }
  }
}

export const exogenaValidator = new ExogenaValidator()
