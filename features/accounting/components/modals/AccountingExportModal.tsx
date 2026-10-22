'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import {
  ThirdParty,
  AccountingEntry,
  AccountingMovement,
  AccountingAccount,
  AccountingExportType,
  AccountingExportFormat,
  ThirdPartyType,
  LegalNature,
  AccountingEntryStatus,
  TrialBalanceLevelFilter,
  AccountingExportPdfParams,
  AccountingExportFilterOptions,
} from '../../types'
import { accountingExportService } from '../../services/accounting-export.service'
import { accountingService } from '../../services/accounting.service'
import { useAccountingLocations } from '../../hooks/useAccountingLocations'
import { useAccountingCatalog, useAccountingCompanyHeader } from '../../hooks/useAccountingReportContext'
import { formatPucRangeLabel } from '../../utils/puc-code-range'
import { todayBogotaIsoDate } from '../../utils/report-format'
import { AccountRangeFilter } from '../filters/AccountRangeFilter'
import { DatePicker } from '@/components/ui/DatePicker'

interface AccountingExportModalProps {
  isOpen: boolean
  onClose: () => void
  initialType?: AccountingExportType
  thirdParties: ThirdParty[]
  entries: AccountingEntry[]
  movements: AccountingMovement[]
  accounts: AccountingAccount[]
  onSuccessToast?: (title: string, message: string) => void
  onOpenPdfReport?: (reportType: AccountingExportType, params: AccountingExportPdfParams) => void
  onOpenTrialBalancePdf?: (params: {
    mainAccountCode: string
    startAccountCode?: string
    endAccountCode?: string
    locationId?: string
    voucherType?: string
    selectedThirdPartyId?: string
    maxLevel: TrialBalanceLevelFilter
    includeThirdParties: boolean
    startDate?: string
    endDate?: string
  }) => void
}

interface ExportTypeConfig {
  id: AccountingExportType
  title: string
  subtitle: string
  icon: LightIconName
  iconBg: string
  iconColor: string
  count: number
  unit: string
}

export function AccountingExportModal({
  isOpen,
  onClose,
  initialType = 'trial_balance',
  thirdParties,
  entries,
  movements,
  accounts: pageAccounts,
  onSuccessToast,
  onOpenPdfReport,
  onOpenTrialBalancePdf,
}: AccountingExportModalProps) {
  const [mounted, setMounted] = useState(false)
  const [selectedType, setSelectedType] = useState<AccountingExportType>(initialType)
  const [format, setFormat] = useState<AccountingExportFormat>('PDF')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Catálogo PUC completo (la prop `accounts` es solo la página visible del Plan de Cuentas).
  const catalog = useAccountingCatalog(isOpen)
  const accounts = catalog.accounts.length > 0 ? catalog.accounts : pageAccounts
  const { company } = useAccountingCompanyHeader(isOpen)
  const locations = useAccountingLocations()

  // 1. Rango de Cuentas PUC
  const [startAccountCode, setStartAccountCode] = useState<string>('')
  const [endAccountCode, setEndAccountCode] = useState<string>('')
  const [mainAccountCode, setMainAccountCode] = useState<string>('ALL')
  const [maxLevel, setMaxLevel] = useState<TrialBalanceLevelFilter>('SUBACCOUNT')

  // 2. Rango de Fechas
  const now = new Date()
  const todayIso = todayBogotaIsoDate()
  const defaultStartDate = `${todayIso.slice(0, 4)}-01-01`
  const defaultEndDate = todayIso

  const [startDate, setStartDate] = useState<string>(defaultStartDate)
  const [endDate, setEndDate] = useState<string>(defaultEndDate)

  // 3. Sede y Comprobantes
  const [locationId, setLocationId] = useState<string>('ALL')
  const [voucherType, setVoucherType] = useState<string>('TODOS')
  const [prefix, setPrefix] = useState<string>('')

  // 4. Terceros
  const [selectedThirdPartyId, setSelectedThirdPartyId] = useState<string>('ALL')
  const [includeThirdParties, setIncludeThirdParties] = useState<boolean>(true)
  const [thirdPartyType, setThirdPartyType] = useState<'ALL' | ThirdPartyType>('ALL')
  const [legalNature, setLegalNature] = useState<'ALL' | LegalNature>('ALL')

  // 5. Casillas Contables
  const [hideZeroBalances, setHideZeroBalances] = useState<boolean>(true)
  const [entryStatus, setEntryStatus] = useState<'ALL' | AccountingEntryStatus>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sincronizar tipo inicial cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setExportError(null)
      setSelectedType(initialType)
      if (initialType === 'trial_balance' || initialType === 'movements') {
        setFormat('PDF')
      } else {
        setFormat('CSV')
      }
    }
  }, [isOpen, initialType])

  // Ajustar formato sugerido según módulo
  useEffect(() => {
    if (selectedType === 'trial_balance') {
      setFormat('PDF')
    }
  }, [selectedType])

  // Configuración de módulos exportables
  const exportTypes: ExportTypeConfig[] = useMemo(() => [
    {
      id: 'trial_balance',
      title: 'Balance de Comprobación',
      subtitle: 'Sumas y saldos por cuenta PUC y subcuentas, con fechas y terceros (PDF)',
      icon: 'receipt',
      iconBg: '#eff6ff',
      iconColor: '#001B5C',
      count: accounts.length,
      unit: 'cuentas',
    },
    {
      id: 'movements',
      title: 'Libro Auxiliar',
      subtitle: 'Movimientos detallados por cuenta con débitos, créditos y saldos',
      icon: 'table',
      iconBg: '#fef3c7',
      iconColor: '#d97706',
      count: movements.length,
      unit: 'movimientos',
    },
    {
      id: 'entries',
      title: 'Asientos Contables',
      subtitle: 'Comprobantes de causación con partida doble balanceada',
      icon: 'receipt',
      iconBg: '#ecfdf5',
      iconColor: '#059669',
      count: entries.length,
      unit: 'asientos',
    },
    {
      id: 'third_parties',
      title: 'Terceros (DIAN)',
      subtitle: 'Clientes, Proveedores, Empleados y Acreedores con NIT/CC',
      icon: 'users',
      iconBg: '#eff6ff',
      iconColor: '#1d4ed8',
      count: thirdParties.length,
      unit: 'terceros',
    },
    {
      id: 'accounts',
      title: 'Plan de Cuentas (PUC)',
      subtitle: 'Catálogo de cuentas maestras con naturalezas y niveles',
      icon: 'layers',
      iconBg: '#f5f3ff',
      iconColor: '#7c3aed',
      count: accounts.length,
      unit: 'cuentas',
    },
    {
      id: 'journal',
      title: 'Libro Diario',
      subtitle: 'Histórico cronológico de transacciones contables',
      icon: 'fileText',
      iconBg: '#e0f2fe',
      iconColor: '#0284c7',
      count: entries.length,
      unit: 'comprobantes',
    },
    {
      id: 'balance',
      title: 'Balance General',
      subtitle: 'Resumen consolidado de saldos de activos, pasivos y patrimonio',
      icon: 'wallet',
      iconBg: '#fdf2f8',
      iconColor: '#db2777',
      count: accounts.length,
      unit: 'cuentas',
    },
  ], [thirdParties.length, entries.length, movements.length, accounts.length])

  // Cuentas disponibles para autocompletar o sugerir
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => a.code.localeCompare(b.code))
  }, [accounts])

  // Cálculo en vivo de registros filtrados según las opciones solicitadas
  const locationName = locations.find((l) => l.id === locationId)?.name

  // Opciones comunes de filtro: las usan el conteo en vivo y la exportación.
  const filterOpts: AccountingExportFilterOptions = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      startAccountCode: startAccountCode || undefined,
      endAccountCode: endAccountCode || undefined,
      mainAccountCode: mainAccountCode !== 'ALL' ? mainAccountCode : undefined,
      locationId,
      locationName,
      voucherType,
      prefix: prefix || undefined,
      selectedThirdPartyId,
      thirdPartyType,
      legalNature,
      entryStatus,
      searchQuery,
      maxLevel,
      includeThirdParties,
      hideZeroBalances,
      companyHeader: company,
    }),
    [
      startDate,
      endDate,
      startAccountCode,
      endAccountCode,
      mainAccountCode,
      locationId,
      locationName,
      voucherType,
      prefix,
      selectedThirdPartyId,
      thirdPartyType,
      legalNature,
      entryStatus,
      searchQuery,
      maxLevel,
      includeThirdParties,
      hideZeroBalances,
      company,
    ]
  )

  const filteredCount = useMemo(() => {

    switch (selectedType) {
      case 'trial_balance':
        return accountingExportService.buildTrialBalanceData({
          accounts,
          movements,
          thirdParties,
          options: filterOpts,
        }).rows.length
      case 'movements':
        return accountingExportService.filterMovements(movements, filterOpts).length
      case 'entries':
        return accountingExportService.filterEntries(entries, filterOpts).length
      case 'third_parties':
        return accountingExportService.filterThirdParties(thirdParties, filterOpts).length
      case 'accounts':
        return accountingExportService.filterAccounts(accounts, filterOpts).length
      case 'journal':
        return accountingExportService.journalLines(entries, filterOpts).length
      case 'balance':
        return accountingExportService.filterAccounts(accounts, { ...filterOpts, startDate: undefined, endDate: undefined }).length
      default:
        return 0
    }
  }, [selectedType, thirdParties, entries, movements, accounts, filterOpts])

  // Presets rápidos de fechas
  const handleSetDatePreset = (preset: 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR') => {
    const curYear = now.getFullYear()
    const curMonth = now.getMonth()

    if (preset === 'ALL') {
      setStartDate('')
      setEndDate('')
      return
    }

    if (preset === 'THIS_MONTH') {
      const firstDay = new Date(curYear, curMonth, 1)
      const dateToIso = (d: Date) => d.toISOString().slice(0, 10)
      setStartDate(dateToIso(firstDay))
      setEndDate(now.toISOString().slice(0, 10))
      return
    }

    if (preset === 'LAST_MONTH') {
      const firstDayLastMonth = new Date(curYear, curMonth - 1, 1)
      const lastDayLastMonth = new Date(curYear, curMonth, 0)
      const dateToIso = (d: Date) => d.toISOString().slice(0, 10)
      setStartDate(dateToIso(firstDayLastMonth))
      setEndDate(dateToIso(lastDayLastMonth))
      return
    }

    if (preset === 'THIS_YEAR') {
      setStartDate(`${curYear}-01-01`)
      setEndDate(now.toISOString().slice(0, 10))
      return
    }
  }

  // Ejecución de la exportación (los saldos del balance y del balance de comprobación salen de la base)
  const handleExport = async () => {
    setIsExporting(true)
    setExportError(null)

    try {
      let result: { count: number; filename: string } = { count: 0, filename: '' }

      // Si se solicita PDF en cualquier módulo contable oficial
      if (format === 'PDF') {
        const pdfParams: AccountingExportPdfParams = {
          reportType: selectedType,
          mainAccountCode,
          startAccountCode: startAccountCode || undefined,
          endAccountCode: endAccountCode || undefined,
          locationId,
          voucherType,
          selectedThirdPartyId,
          thirdPartyType,
          legalNature,
          entryStatus,
          searchQuery,
          maxLevel: selectedType === 'movements' ? 'AUXILIARY' : maxLevel,
          includeThirdParties,
          hideZeroBalances,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }

        if (onOpenPdfReport) {
          onOpenPdfReport(selectedType, pdfParams)
        } else if (onOpenTrialBalancePdf) {
          onOpenTrialBalancePdf({
            mainAccountCode,
            startAccountCode: startAccountCode || undefined,
            endAccountCode: endAccountCode || undefined,
            locationId,
            voucherType,
            selectedThirdPartyId,
            maxLevel: selectedType === 'movements' ? 'AUXILIARY' : maxLevel,
            includeThirdParties,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          })
        }
        onClose()
        return
      }

      switch (selectedType) {
        case 'trial_balance': {
          const totals = await accountingService.getTrialBalanceTotals({
            startDate: filterOpts.startDate,
            endDate: filterOpts.endDate,
            locationId,
            accountFrom: startAccountCode || undefined,
            accountTo: endAccountCode || undefined,
          })
          const tbData = accountingExportService.buildTrialBalanceData({
            accounts,
            movements,
            thirdParties,
            options: filterOpts,
            totals,
          })
          result =
            format === 'EXCEL'
              ? accountingExportService.exportTrialBalanceExcel(tbData)
              : accountingExportService.exportTrialBalanceCSV(tbData)
          break
        }
        case 'movements':
          result = accountingExportService.exportAuxiliary(movements, format, filterOpts)
          break
        case 'entries':
          result = accountingExportService.exportEntries(entries, format, filterOpts)
          break
        case 'third_parties':
          result = accountingExportService.exportThirdParties(thirdParties, format, filterOpts)
          break
        case 'accounts':
          result = accountingExportService.exportAccounts(accounts, format, filterOpts)
          break
        case 'journal':
          result = accountingExportService.exportJournal(entries, format, filterOpts)
          break
        case 'balance': {
          const report = await accountingService.getBalanceSheet({
            cutoffDate: filterOpts.endDate || todayIso,
            locationId,
            accountFrom: startAccountCode || undefined,
            accountTo: endAccountCode || undefined,
          })
          result = accountingExportService.exportBalanceSheet(report, format, {
            hideZeroBalances,
            maxLevel,
            companyHeader: company,
          })
          break
        }
      }

      if (onSuccessToast) {
        const typeName =
          exportTypes.find((t) => t.id === selectedType)?.title || 'Información Contable'
        onSuccessToast(
          'Exportación Completada',
          `Se han exportado ${result.count} registros de ${typeName} en formato ${format}.`
        )
      }

      onClose()
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'No se pudo generar el archivo de exportación.')
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen || !mounted) return null

  const currentTypeConfig = exportTypes.find((t) => t.id === selectedType)

  return createPortal(
    <div
      className="drawer-backdrop modal-center p-2 sm:p-4 z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="accounting-export-title"
    >
      <div
        className="modal-card animate-scale-up"
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-2xs"
              style={{
                backgroundColor: currentTypeConfig?.iconColor || 'var(--navy, #001B5C)',
              }}
            >
              <AppIcon name="download" size={18} />
            </div>
            <div>
              <h2 id="accounting-export-title" className="text-sm font-bold text-slate-900 m-0">
                Exportación de Información Contable
              </h2>
              <p className="text-[11px] text-slate-500 m-0">
                Parámetros de libros contables oficiales y fiscales
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Cuerpo del Modal con Scroll */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* PASO 1: SELECCIONAR QUÉ EXPORTAR */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-4.5 h-4.5 rounded-full bg-blue-900 text-white inline-flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                ¿Qué informe deseas exportar?
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Seleccionado: <strong>{currentTypeConfig?.title}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
              {exportTypes.map((t) => {
                const isSelected = selectedType === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedType(t.id)}
                    className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-900 bg-blue-50 text-blue-950 ring-1 ring-blue-900 shadow-2xs font-bold'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: t.iconBg, color: t.iconColor }}
                      >
                        <AppIcon name={t.icon} size={12} />
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {t.count}
                      </span>
                    </div>
                    <strong className="block text-[11px] leading-tight text-slate-900 truncate">
                      {t.title}
                    </strong>
                  </button>
                )
              })}
            </div>
          </div>

          {/* PASO 2: RANGO A IMPRIMIR / EXPORTAR */}
          <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-4.5 h-4.5 rounded-full bg-blue-900 text-white inline-flex items-center justify-center text-[10px] font-bold">
                  2
                </span>
                Rango a Imprimir / Exportar (Criterios Oficiales)
              </label>
              <span className="text-[10px] font-mono font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                Filtros Generales
              </span>
            </div>

            {/* Fila 1: Rango de cuentas PUC, clase y nivel */}
            <AccountRangeFilter
              accounts={accounts}
              value={{ from: startAccountCode, to: endAccountCode }}
              onChange={(range) => {
                setStartAccountCode(range.from)
                setEndAccountCode(range.to)
              }}
              disabled={catalog.state === 'loading' && accounts.length === 0}
            />
            {catalog.state === 'error' && (
              <p role="alert" className="text-[11px] text-rose-700">
                {catalog.error}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Clase Principal PUC:
                </label>
                <select
                  className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={mainAccountCode}
                  onChange={(e) => setMainAccountCode(e.target.value)}
                >
                  <option value="ALL">Todas las Clases (1 a 7)</option>
                  <option value="1">1 - ACTIVO</option>
                  <option value="2">2 - PASIVO</option>
                  <option value="3">3 - PATRIMONIO</option>
                  <option value="4">4 - INGRESOS</option>
                  <option value="5">5 - GASTOS</option>
                  <option value="6">6 - COSTOS DE VENTAS</option>
                  <option value="7">7 - COSTOS PRODUCCIÓN</option>
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Hasta el Nivel:
                </label>
                <select
                  className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={maxLevel}
                  onChange={(e) => setMaxLevel(e.target.value as any)}
                >
                  <option value="CLASS">Hasta Clase (1 dígito)</option>
                  <option value="GROUP">Hasta Grupo (2 dígitos)</option>
                  <option value="ACCOUNT">Hasta Cuenta (4 dígitos)</option>
                  <option value="SUBACCOUNT">Hasta Subcuenta (6 dígitos) (Recomendado)</option>
                  <option value="AUXILIARY">Hasta Auxiliar (ej. 110505.01)</option>
                  <option value="ALL">Sin límite (Todo)</option>
                </select>
              </div>
            </div>

            {/* Fila 2: Fechas con Presets Rápidos */}
            <div className="pt-1 border-t border-slate-200/80">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <span className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider">
                  Periodo Contable Evaluado:
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('ALL')}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
                  >
                    Todo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('THIS_MONTH')}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
                  >
                    Este Mes
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('LAST_MONTH')}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
                  >
                    Mes Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('THIS_YEAR')}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
                  >
                    Este Año
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <span className="block text-[10px] text-slate-500 mb-0.5">Fecha Inicial:</span>
                  <DatePicker
                    value={startDate}
                    size="sm"
                    onChange={(value) => setStartDate(value)}
                  />
                </div>

                <div>
                  <span className="block text-[10px] text-slate-500 mb-0.5">Fecha Final:</span>
                  <DatePicker
                    value={endDate}
                    size="sm"
                    onChange={(value) => setEndDate(value)}
                  />
                </div>

                <div>
                  <span className="block text-[10px] text-slate-500 mb-0.5">Tipo Comp. (Comprobante):</span>
                  <select
                    className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={voucherType}
                    onChange={(e) => setVoucherType(e.target.value)}
                  >
                    <option value="TODOS">TODOS los Comprobantes</option>
                    <option value="FC">FC - Facturas de Compra</option>
                    <option value="FV">FV - Facturas de Venta</option>
                    <option value="RC">RC - Recibos de Caja</option>
                    <option value="CE">CE - Comprobantes de Egreso</option>
                    <option value="CC">CC - Notas de Causación</option>
                  </select>
                </div>

                <div>
                  <span className="block text-[10px] text-slate-500 mb-0.5">Prefijo / Documento:</span>
                  <input
                    type="text"
                    placeholder="Ej: FAC, POS"
                    className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Fila 3: Sede y Tercero */}
            <div className="pt-1 border-t border-slate-200/80">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="accounting-export-location"
                    className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1"
                  >
                    Sede:
                  </label>
                  <select
                    id="accounting-export-location"
                    className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                  >
                    <option value="ALL">Todas las sedes (consolidado)</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="accounting-export-third-party"
                    className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1"
                  >
                    Identificación Tercero:
                  </label>
                  <select
                    id="accounting-export-third-party"
                    className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
                    value={selectedThirdPartyId}
                    onChange={(e) => setSelectedThirdPartyId(e.target.value)}
                  >
                    <option value="ALL">TODOS los Terceros</option>
                    {thirdParties.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        {tp.documentNumber ? `${tp.documentNumber} - ` : ''}{tp.companyName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Fila 4: Opciones avanzadas de presentación */}
            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeThirdParties}
                  onChange={(e) => setIncludeThirdParties(e.target.checked)}
                  className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                />
                <span className="font-semibold text-slate-900">
                  Cuentas que se dividen en Terceros (Desglose por NIT)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700">
                <input
                  type="checkbox"
                  checked={hideZeroBalances}
                  onChange={(e) => setHideZeroBalances(e.target.checked)}
                  className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                />
                <span>Ocultar cuentas y saldos en cero ($0)</span>
              </label>

            </div>
          </div>

          {/* PASO 3: FORMATO DE SALIDA / DESCARGA */}
          <div>
            <label className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <span className="w-4.5 h-4.5 rounded-full bg-blue-900 text-white inline-flex items-center justify-center text-[10px] font-bold">
                3
              </span>
              Formato de Salida Oficial
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 relative ${
                  format === 'PDF'
                    ? 'border-blue-900 bg-blue-50 text-blue-950 ring-1 ring-blue-900 font-bold shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
                onClick={() => setFormat('PDF')}
              >
                <div className="w-7 h-7 rounded-lg bg-red-100 text-red-800 flex items-center justify-center font-bold text-xs">
                  <AppIcon name="receipt" size={14} />
                </div>
                <strong className="text-xs">PDF Oficial Imprimible</strong>
                <span className="text-[10px] text-slate-500 leading-tight">
                  Formato ajustado al 100% en hoja Carta, con membrete y firmas
                </span>
              </button>

              <button
                type="button"
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  format === 'EXCEL'
                    ? 'border-blue-900 bg-blue-50 text-blue-950 ring-1 ring-blue-900 font-bold shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
                onClick={() => setFormat('EXCEL')}
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  <AppIcon name="invoices" size={14} />
                </div>
                <strong className="text-xs">Excel Nativo (.xls)</strong>
                <span className="text-[10px] text-slate-500 leading-tight">
                  Hoja de cálculo estructurada con sumas de débitos y créditos
                </span>
              </button>

              <button
                type="button"
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  format === 'CSV'
                    ? 'border-blue-900 bg-blue-50 text-blue-950 ring-1 ring-blue-900 font-bold shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
                onClick={() => setFormat('CSV')}
              >
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-xs">
                  <AppIcon name="download" size={14} />
                </div>
                <strong className="text-xs">CSV (Excel UTF-8)</strong>
                <span className="text-[10px] text-slate-500 leading-tight">
                  Delimitador ; y BOM para Excel en español sin descuadres
                </span>
              </button>
            </div>
          </div>

          {exportError && (
            <div role="alert" className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-start gap-2">
              <AppIcon name="warning" size={15} />
              <span>{exportError}</span>
            </div>
          )}

          {/* BANNER DE RESUMEN Y CONTEO EN VIVO */}
          <div
            className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
              filteredCount > 0
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/80 border-amber-300 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <AppIcon name={filteredCount > 0 ? 'check' : 'alerts'} size={15} />
              <div>
                <strong className="block text-xs">
                  {filteredCount > 0
                    ? `${filteredCount} ${
                        filteredCount === 1 ? 'registro listo' : 'registros listos'
                      } para exportar`
                    : 'No hay registros que coincidan con los criterios aplicados'}
                </strong>
                <span className="text-[10.5px] opacity-80 block font-mono">
                  Módulo: {currentTypeConfig?.title} | Formato: {format}
                  {(startDate || endDate) &&
                    ` | Periodo: ${startDate || 'Inicio'} a ${endDate || 'Hoy'}`}
                  {` | ${formatPucRangeLabel({ from: startAccountCode, to: endAccountCode })}`}
                  {locationName ? ` | Sede: ${locationName}` : ''}
                </span>
              </div>
            </div>

            <span className="text-sm font-bold font-mono px-2 py-0.5 rounded bg-white/90 border border-current">
              {filteredCount}
            </span>
          </div>
        </div>

        {/* Pie del Modal */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Exportación contable estandarizada conforme a las normas contables y DIAN.
          </span>
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              className="outline-button compact text-xs"
              onClick={onClose}
              disabled={isExporting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button compact text-xs flex items-center gap-2 font-bold"
              style={{ background: 'var(--navy, #001B5C)' }}
              onClick={handleExport}
              disabled={isExporting || filteredCount === 0}
            >
              <AppIcon
                name={format === 'PDF' ? 'printer' : 'download'}
                size={14}
              />
              <span>
                {isExporting
                  ? 'Generando...'
                  : format === 'PDF'
                  ? `Ver / Imprimir PDF Oficial (${filteredCount})`
                  : `Descargar ${currentTypeConfig?.title || 'Reporte'} (${filteredCount})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
