'use client'

import { useState, useEffect, useCallback } from 'react'
import { exogenaService } from '../services/exogena.service'
import {
  ExogenaYearNormativa,
  ExogenaFormatConfig,
  ExogenaStats,
  ExogenaConciliationItem,
  ExogenaGenerationRecord,
  ExogenaValidationError,
} from '../types'
import { UserRoleType } from './useExogenaPermissions'

const DEFAULT_STATS: ExogenaStats = {
  recordsToReportCount: 0,
  identifiedThirdPartiesCount: 0,
  enabledFormatsCount: 0,
  recordsWithErrorsCount: 0,
  recordsWithWarningsCount: 0,
  lastGenerationDate: null,
  lastBatchCode: null,
  validationStatus: 'PENDING',
}

export function useExogena(userRole: UserRoleType = 'SUPERADMIN') {
  const [selectedYear, setSelectedYear] = useState<number>(2025)
  const [availableYears, setAvailableYears] = useState<Array<{ year: number; label: string; status: string }>>([])
  const [normativa, setNormativa] = useState<ExogenaYearNormativa | null>(null)
  const [stats, setStats] = useState<ExogenaStats>(DEFAULT_STATS)
  const [formatsSummary, setFormatsSummary] = useState<ExogenaFormatConfig[]>([])
  const [conciliation, setConciliation] = useState<ExogenaConciliationItem[]>([])
  const [history, setHistory] = useState<ExogenaGenerationRecord[]>([])

  const [validationErrors, setValidationErrors] = useState<ExogenaValidationError[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cargar años disponibles al inicio
  useEffect(() => {
    exogenaService
      .getAvailableYears(userRole)
      .then((years) => setAvailableYears(years))
      .catch((err) => setError(err.message))
  }, [userRole])

  // Cargar información del año seleccionado
  const loadYearData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [normativaRes, statsRes, formatsRes, concilRes, historyRes] =
        await Promise.all([
          exogenaService.getNormativaByYear(selectedYear, userRole),
          exogenaService.getStats(selectedYear, userRole),
          exogenaService.getFormatsSummary(selectedYear, userRole),
          exogenaService.getConciliation(selectedYear, userRole),
          exogenaService.getGenerationsHistory(selectedYear, userRole),
        ])

      setNormativa(normativaRes)
      setStats(statsRes)
      setFormatsSummary(formatsRes)
      setConciliation(concilRes)
      setHistory(historyRes)
    } catch (err: any) {
      setError(err.message || 'Error al cargar los datos de Exógena.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedYear, userRole])

  useEffect(() => {
    loadYearData()
  }, [loadYearData])

  // Ejecutar validación de datos
  const runValidation = async () => {
    try {
      setIsValidating(true)
      const res = await exogenaService.validateYearData(selectedYear, userRole)
      setValidationErrors(res.errors)
      // Actualizar estadísticas con los nuevos conteos
      await loadYearData()
      return res
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setIsValidating(false)
    }
  }

  // Actualizar configuración normativa
  const updateNormativa = async (data: {
    obligadoType?: string
    responsibleName?: string
    dueDate?: string
    enabledFormats?: string[]
    grossRevenueThreshold?: number
  }) => {
    const updated = await exogenaService.updateNormativa(
      selectedYear,
      data,
      { id: 'usr-admin', name: 'Admin Mauricio' },
      userRole
    )
    setNormativa(updated)
    await loadYearData()
    return updated
  }

  // Generar paquete DIAN
  const generatePackage = async (
    formatNumbers: string[],
    fileFormat: 'XML' | 'CSV',
    notes: string
  ) => {
    const res = await exogenaService.generatePackage(
      selectedYear,
      formatNumbers,
      fileFormat,
      notes,
      { id: 'usr-admin', name: 'Admin Mauricio', role: 'Administrador General' },
      userRole
    )
    await loadYearData()
    return res
  }

  // Exportar formato individual
  const downloadSingleFormat = async (formatNumber: string) => {
    const res = await exogenaService.exportFormatCSV(selectedYear, formatNumber, userRole)
    const blob = new Blob([res.content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', res.fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return {
    selectedYear,
    setSelectedYear,
    availableYears,
    normativa,
    stats,
    formatsSummary,
    conciliation,
    history,
    validationErrors,
    isValidating,
    isLoading,
    error,
    loadYearData,
    runValidation,
    updateNormativa,
    generatePackage,
    downloadSingleFormat,
  }
}
