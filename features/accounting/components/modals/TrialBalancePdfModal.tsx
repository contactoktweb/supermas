'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { Heart } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  AccountingAccount,
  AccountingMovement,
  AccountingEntry,
  ThirdParty,
  TrialBalanceLevelFilter,
  TrialBalanceReportData,
  TrialBalanceTotals,
  AccountingExportType,
  AccountingExportFilterOptions,
  BalanceSheetReport,
  IncomeStatementReport,
  FinancialStatementNode,
} from '../../types'
import { accountingExportService } from '../../services/accounting-export.service'
import { accountingService } from '../../services/accounting.service'
import { useAccountingLocations } from '../../hooks/useAccountingLocations'
import { useAccountingCatalog, useAccountingCompanyHeader } from '../../hooks/useAccountingReportContext'
import { ACCOUNT_LEVEL_LABEL, flattenAccountTree, pruneZeroNodes, roundCurrency } from '../../utils/account-tree'
import { comparePucCodes, formatPucRangeLabel, isPucCodeInRange, isPucDescendantOrSelf } from '../../utils/puc-code-range'
import {
  formatAmount,
  formatCompanyNit,
  formatCop,
  formatIsoDateEs,
  formatNowBogota,
  taxRegimeLabel,
  todayBogotaIsoDate,
} from '../../utils/report-format'
import { AccountRangeFilter } from '../filters/AccountRangeFilter'
import { incomeStatementLines, incomeStatementSections } from '../../utils/income-statement'
import { DatePicker } from '@/components/ui/DatePicker'

export interface TrialBalancePdfModalProps {
  isOpen: boolean
  onClose: () => void
  reportType?: AccountingExportType
  /** Página visible del PUC (respaldo mientras carga el catálogo completo). */
  accounts: AccountingAccount[]
  movements: AccountingMovement[]
  entries?: AccountingEntry[]
  thirdParties: ThirdParty[]
  initialMainAccountCode?: string
  initialStartAccountCode?: string
  initialEndAccountCode?: string
  initialLocationId?: string
  initialVoucherType?: string
  selectedThirdPartyName?: string
  initialSelectedThirdPartyId?: string
  initialThirdPartyType?: string
  initialLegalNature?: string
  initialEntryStatus?: string
  initialSearchQuery?: string
  initialMaxLevel?: TrialBalanceLevelFilter
  initialIncludeThirdParties?: boolean
  initialHideZeroBalances?: boolean
  initialStartDate?: string
  initialEndDate?: string
}

type RemoteState = 'idle' | 'loading' | 'ready' | 'error'

const LEVEL_NUMBER_BY_FILTER: Record<TrialBalanceLevelFilter, number> = {
  CLASS: 1,
  GROUP: 2,
  ACCOUNT: 3,
  SUBACCOUNT: 4,
  AUXILIARY: 5,
  ALL: 5,
}

/** Sangría por nivel del PUC en el documento impreso (px). */
const PRINT_INDENT_PX = 10

/**
 * Saldo con sufijo D (débito) o C (crédito) según el lado en que queda, con separadores colombianos.
 */
function formatAccountingBalance(amount: number, nature: 'DEBIT' | 'CREDIT'): string {
  if (Math.abs(amount) < 0.005) return '0,00'
  const suffix = nature === 'DEBIT' ? (amount >= 0 ? 'D' : 'C') : amount >= 0 ? 'C' : 'D'
  return `${formatAmount(Math.abs(amount))} ${suffix}`
}

/** Débitos y créditos del periodo (siempre positivos). */
function formatAccountingMovement(amount: number): string {
  return formatAmount(Math.abs(amount))
}

/** Texto seguro dentro de una cadena CSS (content: "..."). */
function cssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')
}

/** Texto seguro para insertar en HTML. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const REPORT_CONFIG: Record<AccountingExportType, { title: string; subtitle: string; icon: LightIconName; badge: string }> = {
  trial_balance: {
    title: 'BALANCE DE COMPROBACIÓN',
    subtitle: 'Sumas y saldos por cuenta y subcuentas',
    icon: 'receipt',
    badge: 'Libro oficial',
  },
  movements: {
    title: 'LIBRO AUXILIAR DE CUENTAS CONTABLES',
    subtitle: 'Movimientos, débitos, créditos y saldos acumulados',
    icon: 'table',
    badge: 'Libro auxiliar',
  },
  entries: {
    title: 'COMPROBANTES DE DIARIO Y CAUSACIONES',
    subtitle: 'Asientos con partida doble verificada',
    icon: 'receipt',
    badge: 'Comprobantes',
  },
  journal: {
    title: 'LIBRO DIARIO GENERAL',
    subtitle: 'Líneas contables en orden cronológico',
    icon: 'fileText',
    badge: 'Diario general',
  },
  third_parties: {
    title: 'DIRECTORIO DE TERCEROS (DIAN)',
    subtitle: 'Clientes, proveedores, empleados y acreedores',
    icon: 'users',
    badge: 'Directorio DIAN',
  },
  accounts: {
    title: 'PLAN ÚNICO DE CUENTAS (PUC)',
    subtitle: 'Catálogo jerárquico de cuentas, naturalezas y niveles',
    icon: 'layers',
    badge: 'Catálogo PUC',
  },
  balance: {
    title: 'ESTADO DE SITUACIÓN FINANCIERA (BALANCE GENERAL)',
    subtitle: 'Activo, pasivo y patrimonio por niveles del PUC con ecuación patrimonial',
    icon: 'wallet',
    badge: 'Estado financiero',
  },
  income_statement: {
    title: 'ESTADO DE RESULTADOS INTEGRAL',
    subtitle: 'Ingresos, costos y gastos del periodo por niveles del PUC con utilidad neta',
    icon: 'pieChart',
    badge: 'Estado financiero',
  },
}

export function TrialBalancePdfModal({
  isOpen,
  onClose,
  reportType = 'trial_balance',
  accounts: pageAccounts,
  movements,
  entries = [],
  thirdParties,
  initialMainAccountCode = 'ALL',
  initialStartAccountCode = '',
  initialEndAccountCode = '',
  initialLocationId = 'ALL',
  initialVoucherType = 'TODOS',
  selectedThirdPartyName,
  initialSelectedThirdPartyId = 'ALL',
  initialThirdPartyType = 'ALL',
  initialLegalNature = 'ALL',
  initialEntryStatus = 'ALL',
  initialSearchQuery = '',
  initialMaxLevel = 'SUBACCOUNT',
  initialIncludeThirdParties = true,
  initialHideZeroBalances = true,
  initialStartDate,
  initialEndDate,
}: TrialBalancePdfModalProps) {
  const [mounted, setMounted] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const generatedBy = user?.fullName || user?.email || ''

  // Catálogo PUC completo, empresa (razón social, NIT, DV) y sedes reales.
  const catalog = useAccountingCatalog(isOpen)
  const accounts = catalog.accounts.length > 0 ? catalog.accounts : pageAccounts
  const { company, error: companyError } = useAccountingCompanyHeader(isOpen)
  const locations = useAccountingLocations()

  // Reporte activo actualmente en el visor
  const [activeReportType, setActiveReportType] = useState<AccountingExportType>(reportType)

  // Filtros interactivos del reporte
  const [mainAccountCode, setMainAccountCode] = useState<string>(initialMainAccountCode)
  const [startAccountCode, setStartAccountCode] = useState<string>(initialStartAccountCode)
  const [endAccountCode, setEndAccountCode] = useState<string>(initialEndAccountCode)
  const [locationId, setLocationId] = useState<string>(initialLocationId)
  const [voucherType, setVoucherType] = useState<string>(initialVoucherType)
  const [selectedThirdPartyId, setSelectedThirdPartyId] = useState<string>(initialSelectedThirdPartyId)
  const [maxLevel, setMaxLevel] = useState<TrialBalanceLevelFilter>(initialMaxLevel)
  const [includeThirdParties, setIncludeThirdParties] = useState<boolean>(initialIncludeThirdParties)
  const [hideZeroBalances, setHideZeroBalances] = useState<boolean>(initialHideZeroBalances)

  // Fechas del reporte (en el Balance General la fecha final es la fecha de corte)
  const todayIso = todayBogotaIsoDate()
  const [startDate, setStartDate] = useState<string>(initialStartDate || `${todayIso.slice(0, 4)}-01-01`)
  const [endDate, setEndDate] = useState<string>(initialEndDate || todayIso)

  // Momento de generación del documento (se fija al abrir y al cambiar filtros)
  const [generatedAt, setGeneratedAt] = useState<string>('')

  // Datos consultados en la base
  const [tbTotals, setTbTotals] = useState<TrialBalanceTotals | null>(null)
  const [tbState, setTbState] = useState<RemoteState>('idle')
  const [balanceReport, setBalanceReport] = useState<BalanceSheetReport | null>(null)
  const [balanceState, setBalanceState] = useState<RemoteState>('idle')
  const [incomeReport, setIncomeReport] = useState<IncomeStatementReport | null>(null)
  const [incomeState, setIncomeState] = useState<RemoteState>('idle')
  const [remoteError, setRemoteError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sincronizar props cuando se abre o cambia reportType
  useEffect(() => {
    if (!isOpen) return
    setActiveReportType(reportType)
    setMainAccountCode(initialMainAccountCode || 'ALL')
    setStartAccountCode(initialStartAccountCode || '')
    setEndAccountCode(initialEndAccountCode || '')
    setLocationId(initialLocationId || 'ALL')
    setVoucherType(initialVoucherType || 'TODOS')
    setSelectedThirdPartyId(initialSelectedThirdPartyId || 'ALL')
    setMaxLevel(initialMaxLevel || 'SUBACCOUNT')
    setIncludeThirdParties(initialIncludeThirdParties !== undefined ? initialIncludeThirdParties : true)
    setHideZeroBalances(initialHideZeroBalances !== undefined ? initialHideZeroBalances : true)
    const today = todayBogotaIsoDate()
    setStartDate(initialStartDate || `${today.slice(0, 4)}-01-01`)
    setEndDate(initialEndDate || today)
  }, [
    isOpen,
    reportType,
    initialMainAccountCode,
    initialStartAccountCode,
    initialEndAccountCode,
    initialLocationId,
    initialVoucherType,
    initialSelectedThirdPartyId,
    initialMaxLevel,
    initialIncludeThirdParties,
    initialHideZeroBalances,
    initialStartDate,
    initialEndDate,
  ])

  const locationName = locations.find((l) => l.id === locationId)?.name
  const sedeLabel = locationId !== 'ALL' ? locationName || 'Sede seleccionada' : 'Todas las sedes (consolidado)'
  const accountRange = useMemo(() => ({ from: startAccountCode, to: endAccountCode }), [startAccountCode, endAccountCode])
  const accountRangeLabel = formatPucRangeLabel(accountRange)

  // Totales del Balance de Comprobación (saldo anterior y periodo) desde la base
  useEffect(() => {
    if (!isOpen || activeReportType !== 'trial_balance') return
    let isActive = true
    setTbState('loading')
    setRemoteError(null)
    accountingService
      .getTrialBalanceTotals({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        locationId,
        accountFrom: startAccountCode || undefined,
        accountTo: endAccountCode || undefined,
      })
      .then((totals) => {
        if (!isActive) return
        setTbTotals(totals)
        setTbState('ready')
      })
      .catch((err: unknown) => {
        if (!isActive) return
        setTbTotals(null)
        setTbState('error')
        setRemoteError(err instanceof Error ? err.message : 'No se pudieron consultar los saldos.')
      })
    return () => {
      isActive = false
    }
  }, [isOpen, activeReportType, startDate, endDate, locationId, startAccountCode, endAccountCode])

  // Balance General desde la base (fecha de corte = fecha final)
  useEffect(() => {
    if (!isOpen || activeReportType !== 'balance') return
    let isActive = true
    setBalanceState('loading')
    setRemoteError(null)
    accountingService
      .getBalanceSheet({
        cutoffDate: endDate || todayBogotaIsoDate(),
        locationId,
        accountFrom: startAccountCode || undefined,
        accountTo: endAccountCode || undefined,
      })
      .then((report) => {
        if (!isActive) return
        setBalanceReport(report)
        setBalanceState('ready')
      })
      .catch((err: unknown) => {
        if (!isActive) return
        setBalanceReport(null)
        setBalanceState('error')
        setRemoteError(err instanceof Error ? err.message : 'No se pudo generar el Balance General.')
      })
    return () => {
      isActive = false
    }
  }, [isOpen, activeReportType, endDate, locationId, startAccountCode, endAccountCode])

  // Estado de Resultados del periodo [desde, hasta] desde la base
  useEffect(() => {
    if (!isOpen || activeReportType !== 'income_statement') return
    let isActive = true
    setIncomeState('loading')
    setRemoteError(null)
    accountingService
      .getIncomeStatement({ dateFrom: startDate, dateTo: endDate, locationId })
      .then((report) => {
        if (!isActive) return
        setIncomeReport(report)
        setIncomeState('ready')
      })
      .catch((err: unknown) => {
        if (!isActive) return
        setIncomeReport(null)
        setIncomeState('error')
        setRemoteError(err instanceof Error ? err.message : 'No se pudo generar el Estado de Resultados.')
      })
    return () => {
      isActive = false
    }
  }, [isOpen, activeReportType, startDate, endDate, locationId])

  // Cuentas de nivel 1 para el selector de clase
  const mainClasses = useMemo(
    () => accounts.filter((a) => a.code.length === 1).sort((a, b) => comparePucCodes(a.code, b.code)),
    [accounts]
  )

  // Nombre del tercero seleccionado
  const resolvedThirdPartyName = useMemo(() => {
    if (selectedThirdPartyName) return selectedThirdPartyName
    if (selectedThirdPartyId === 'ALL') return 'Todos'
    const found = thirdParties.find((tp) => tp.id === selectedThirdPartyId)
    return found ? `${found.documentNumber ? found.documentNumber + ' - ' : ''}${found.companyName}` : selectedThirdPartyId
  }, [selectedThirdPartyId, selectedThirdPartyName, thirdParties])

  // Opciones de filtro para el servicio de exportación
  const filterOptions: AccountingExportFilterOptions = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      startAccountCode: startAccountCode || undefined,
      endAccountCode: endAccountCode || undefined,
      mainAccountCode: mainAccountCode !== 'ALL' ? mainAccountCode : undefined,
      locationId,
      locationName,
      voucherType,
      selectedThirdPartyId,
      thirdPartyType: initialThirdPartyType as AccountingExportFilterOptions['thirdPartyType'],
      legalNature: initialLegalNature as AccountingExportFilterOptions['legalNature'],
      entryStatus: initialEntryStatus as AccountingExportFilterOptions['entryStatus'],
      searchQuery: initialSearchQuery,
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
      selectedThirdPartyId,
      initialThirdPartyType,
      initialLegalNature,
      initialEntryStatus,
      initialSearchQuery,
      maxLevel,
      includeThirdParties,
      hideZeroBalances,
      company,
    ]
  )

  useEffect(() => {
    if (isOpen) setGeneratedAt(formatNowBogota())
  }, [isOpen, filterOptions, activeReportType])

  // =========================================================================
  // 1. DATA: BALANCE DE COMPROBACIÓN (importes de la base cuando están disponibles)
  // =========================================================================
  const trialBalanceData: TrialBalanceReportData = useMemo(
    () =>
      accountingExportService.buildTrialBalanceData({
        accounts,
        movements,
        thirdParties,
        options: filterOptions,
        totals: tbTotals,
      }),
    [accounts, movements, thirdParties, filterOptions, tbTotals]
  )

  // =========================================================================
  // 2. DATA: LIBRO AUXILIAR (cuentas con movimientos propios dentro del rango)
  // =========================================================================
  const auxiliaryAccountsData = useMemo(() => {
    const scopedMovements = movements.filter((m) => {
      if (!isPucCodeInRange(m.accountCode, accountRange)) return false
      if (mainAccountCode !== 'ALL' && !isPucDescendantOrSelf(m.accountCode, mainAccountCode)) return false
      if (locationId !== 'ALL' && m.locationId !== locationId) return false
      return true
    })
    const byAccount = new Map<string, AccountingMovement[]>()
    for (const m of scopedMovements) {
      const list = byAccount.get(m.accountId) || []
      list.push(m)
      byAccount.set(m.accountId, list)
    }

    const result: Array<{
      account: AccountingAccount
      initialBalance: number
      movements: Array<{
        id: string
        date: string
        voucherNumber: string
        description: string
        thirdPartyName: string
        thirdPartyDoc: string
        debit: number
        credit: number
        runningBalance: number
      }>
      totalDebit: number
      totalCredit: number
      finalBalance: number
    }> = []

    for (const acc of accounts) {
      const accMovements = byAccount.get(acc.id) || []
      const priorMovs = accMovements.filter((m) => startDate && m.date.slice(0, 10) < startDate)
      const periodMovs = accMovements.filter((m) => {
        if (startDate && m.date.slice(0, 10) < startDate) return false
        if (endDate && m.date.slice(0, 10) > endDate) return false
        if (voucherType !== 'TODOS' && m.sourceType !== voucherType) return false
        if (selectedThirdPartyId !== 'ALL') {
          const tp = thirdParties.find((t) => t.id === selectedThirdPartyId)
          if (m.thirdPartyId !== selectedThirdPartyId && (!tp || m.thirdPartyDoc !== tp.documentNumber)) return false
        }
        return true
      })

      const priorDebit = priorMovs.reduce((s, m) => s + (m.debit || 0), 0)
      const priorCredit = priorMovs.reduce((s, m) => s + (m.credit || 0), 0)
      const initialBal = acc.nature === 'DEBIT' ? priorDebit - priorCredit : priorCredit - priorDebit

      if (Math.abs(initialBal) < 0.005 && periodMovs.length === 0) {
        if (hideZeroBalances || accMovements.length === 0) continue
      }

      let running = initialBal
      const sortedMovs = [...periodMovs].sort((a, b) => a.date.localeCompare(b.date))
      const movsWithRunning = sortedMovs.map((m) => {
        running = acc.nature === 'DEBIT' ? running + (m.debit || 0) - (m.credit || 0) : running + (m.credit || 0) - (m.debit || 0)
        return {
          id: m.id,
          date: m.date,
          voucherNumber: m.sourceDocumentNumber || m.entryNumber || '',
          description: m.description || '',
          thirdPartyName: m.thirdPartyName || '—',
          thirdPartyDoc: m.thirdPartyDoc || '',
          debit: m.debit || 0,
          credit: m.credit || 0,
          runningBalance: running,
        }
      })

      result.push({
        account: acc,
        initialBalance: initialBal,
        movements: movsWithRunning,
        totalDebit: periodMovs.reduce((s, m) => s + (m.debit || 0), 0),
        totalCredit: periodMovs.reduce((s, m) => s + (m.credit || 0), 0),
        finalBalance: running,
      })
    }

    return result.sort((a, b) => comparePucCodes(a.account.code, b.account.code))
  }, [
    accounts,
    movements,
    thirdParties,
    startDate,
    endDate,
    accountRange,
    mainAccountCode,
    locationId,
    voucherType,
    selectedThirdPartyId,
    hideZeroBalances,
  ])

  // =========================================================================
  // 3. DATA: COMPROBANTES DE DIARIO / ASIENTOS CONTABLES
  // =========================================================================
  const filteredEntriesList = useMemo(() => {
    return accountingExportService
      .filterEntries(entries, filterOptions)
      .filter((e) => voucherType === 'TODOS' || e.sourceType === voucherType)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [entries, filterOptions, voucherType])

  // =========================================================================
  // 4. DATA: LIBRO DIARIO GENERAL (líneas dentro del rango de cuentas)
  // =========================================================================
  const journalRows = useMemo(
    () =>
      accountingExportService
        .journalLines(entries, filterOptions)
        .filter((row) => voucherType === 'TODOS' || row.voucherType === voucherType),
    [entries, filterOptions, voucherType]
  )

  // =========================================================================
  // 5. DATA: TERCEROS (DIAN)
  // =========================================================================
  const filteredThirdPartiesList = useMemo(() => {
    return accountingExportService
      .filterThirdParties(thirdParties, {
        startDate,
        endDate,
        thirdPartyType: filterOptions.thirdPartyType,
        legalNature: filterOptions.legalNature,
        searchQuery: initialSearchQuery,
      })
      .sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''))
  }, [thirdParties, startDate, endDate, filterOptions.thirdPartyType, filterOptions.legalNature, initialSearchQuery])

  // =========================================================================
  // 6. DATA: PLAN DE CUENTAS (PUC)
  // =========================================================================
  const filteredAccountsList = useMemo(
    () => accountingExportService.filterAccounts(accounts, { ...filterOptions, startDate: undefined, endDate: undefined }),
    [accounts, filterOptions]
  )

  // =========================================================================
  // 7. DATA: BALANCE GENERAL (árbol por niveles)
  // =========================================================================
  const balanceSections = useMemo(() => {
    const maxLevelNumber = LEVEL_NUMBER_BY_FILTER[maxLevel] || 5
    const rowsOf = (node: FinancialStatementNode | null) => {
      if (!node) return []
      const nodes = hideZeroBalances ? pruneZeroNodes([node]) : [node]
      return flattenAccountTree(nodes, maxLevelNumber)
    }
    return {
      assets: rowsOf(balanceReport?.assets ?? null),
      liabilities: rowsOf(balanceReport?.liabilities ?? null),
      equity: rowsOf(balanceReport?.equity ?? null),
    }
  }, [balanceReport, hideZeroBalances, maxLevel])

  const incomeSections = useMemo(() => {
    if (!incomeReport) return []
    const maxLevelNumber = LEVEL_NUMBER_BY_FILTER[maxLevel] || 5
    return incomeStatementSections(incomeReport).map((section) => {
      const nodes = section.node ? (hideZeroBalances ? pruneZeroNodes([section.node]) : [section.node]) : []
      return { ...section, rows: flattenAccountTree(nodes, maxLevelNumber) }
    })
  }, [incomeReport, hideZeroBalances, maxLevel])

  const reportConfig = REPORT_CONFIG[activeReportType] || REPORT_CONFIG.trial_balance
  const isBalanceReport = activeReportType === 'balance'
  const isIncomeReport = activeReportType === 'income_statement'
  const formattedPeriod = isBalanceReport
    ? `Corte al ${formatIsoDateEs(endDate)}`
    : `${startDate ? formatIsoDateEs(startDate) : 'Inicio'} a ${endDate ? formatIsoDateEs(endDate) : 'Hoy'}`

  const companyName = company?.legalName || ''
  const companyNit = formatCompanyNit(company?.taxId, company?.verificationDigit)
  const companyRegime = taxRegimeLabel(company?.taxRegime)
  const isRemoteLoading =
    (activeReportType === 'trial_balance' && tbState === 'loading') ||
    (activeReportType === 'balance' && balanceState === 'loading') ||
    (isIncomeReport && incomeState === 'loading')
  const remoteFailed =
    (activeReportType === 'trial_balance' && tbState === 'error') ||
    (activeReportType === 'balance' && balanceState === 'error') ||
    (isIncomeReport && incomeState === 'error')

  // Impresión en ventana aislada con los estilos de la aplicación, numeración de páginas y pie.
  const handlePrint = () => {
    const printElement = reportRef.current
    if (!printElement) return

    const printWindow = window.open('', '_blank', 'width=1100,height=800')
    if (!printWindow) {
      window.print()
      return
    }

    const appStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join('\n')
    const footerLeft = cssString(
      `Generado el ${generatedAt || formatNowBogota()}${generatedBy ? ` por ${generatedBy}` : ''}`
    )
    const docTitle = escapeHtml(`${reportConfig.title}${companyName ? ` - ${companyName}` : ''}`)

    printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <base href="${window.location.origin}/" />
  <title>${docTitle}</title>
  ${appStyles}
  <style>
    @page {
      size: letter portrait;
      margin: 12mm 10mm 16mm 10mm;
      @bottom-left { content: "${footerLeft}"; font-family: monospace; font-size: 8px; color: #333; }
      @bottom-right { content: "Página " counter(page) " de " counter(pages); font-family: monospace; font-size: 8px; color: #333; }
    }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0; padding: 0; background: #ffffff !important; color: #000000; }
    body { font-size: 10.5px; line-height: 1.25; }
    #accounting-pdf-document { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: none !important; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    .print-avoid-break { page-break-inside: avoid; break-inside: avoid; }
  </style>
</head>
<body>
  ${printElement.outerHTML}
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); window.close(); }, 300);
    });
  </script>
</body>
</html>`)
    printWindow.document.close()
  }

  // Exportar Excel / CSV del reporte activo
  const handleExportFile = (format: 'EXCEL' | 'CSV') => {
    switch (activeReportType) {
      case 'trial_balance':
        if (format === 'EXCEL') accountingExportService.exportTrialBalanceExcel(trialBalanceData)
        else accountingExportService.exportTrialBalanceCSV(trialBalanceData)
        break
      case 'movements':
        accountingExportService.exportAuxiliary(movements, format, filterOptions)
        break
      case 'entries':
        accountingExportService.exportEntries(filteredEntriesList, format, { ...filterOptions, voucherType: undefined })
        break
      case 'journal':
        accountingExportService.exportJournal(entries, format, filterOptions)
        break
      case 'third_parties':
        accountingExportService.exportThirdParties(thirdParties, format, filterOptions)
        break
      case 'accounts':
        accountingExportService.exportAccounts(accounts, format, filterOptions)
        break
      case 'balance':
        if (balanceReport) {
          accountingExportService.exportBalanceSheet(balanceReport, format, {
            hideZeroBalances,
            maxLevel,
            companyHeader: company,
          })
        }
        break
      case 'income_statement':
        if (incomeReport) {
          accountingExportService.exportIncomeStatement(incomeReport, format, {
            hideZeroBalances,
            maxLevel,
            companyHeader: company,
          })
        }
        break
    }
  }

  if (!isOpen || !mounted) return null

  // Saldos netos (débito/crédito) de las sumas del Balance de Comprobación
  const netInitial = roundCurrency(trialBalanceData.totalInitialDebit - trialBalanceData.totalInitialCredit)
  const netFinal = roundCurrency(trialBalanceData.totalFinalDebit - trialBalanceData.totalFinalCredit)

  // Gran total del libro auxiliar
  const auxTotalDebit = auxiliaryAccountsData.reduce((s, a) => s + a.totalDebit, 0)
  const auxTotalCredit = auxiliaryAccountsData.reduce((s, a) => s + a.totalCredit, 0)

  // Gran total de asientos
  const entriesTotalDebit = filteredEntriesList.reduce((s, e) => s + e.totalDebit, 0)
  const entriesTotalCredit = filteredEntriesList.reduce((s, e) => s + e.totalCredit, 0)

  // Gran total del libro diario
  const journalTotalDebit = journalRows.reduce((s, r) => s + r.debit, 0)
  const journalTotalCredit = journalRows.reduce((s, r) => s + r.credit, 0)

  const balanceRowsTable = (rows: ReturnType<typeof flattenAccountTree>) =>
    rows.map(({ node, depth }) => {
      const isMajor = node.levelNumber <= 2
      return (
        <tr key={node.id} className={`text-black ${isMajor ? 'font-bold' : node.levelNumber === 3 ? 'font-semibold' : ''}`}>
          <td className="py-0.5 px-1 whitespace-nowrap">{node.code}</td>
          <td className="py-0.5 px-1 overflow-hidden text-ellipsis whitespace-nowrap">
            <span style={{ paddingLeft: depth * PRINT_INDENT_PX }}>
              {node.levelNumber <= 3 ? node.name.toUpperCase() : node.name}
            </span>
          </td>
          <td className="py-0.5 px-1 text-right whitespace-nowrap">{formatCop(node.balance)}</td>
        </tr>
      )
    })

  return createPortal(
    <div
      className="drawer-backdrop modal-center p-2 sm:p-4 z-50 print:p-0 print:bg-white"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="accounting-pdf-title"
    >
      <div
        className="modal-card animate-scale-up print:shadow-none print:border-none print:w-full print:max-w-none print:h-auto"
        style={{
          width: '100%',
          maxWidth: 1100,
          maxHeight: '96vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.3)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior de herramientas (oculta al imprimir) */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold shadow-2xs">
              <AppIcon name={reportConfig.icon} size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="accounting-pdf-title" className="text-sm font-bold text-slate-900 m-0">
                  {reportConfig.title}
                </h2>
                <span className="text-[10px] bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded-full">
                  {reportConfig.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 m-0">{reportConfig.subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeReportType}
              onChange={(e) => setActiveReportType(e.target.value as AccountingExportType)}
              className="text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 shadow-2xs focus:ring-1 focus:ring-blue-900"
              aria-label="Seleccionar reporte contable"
            >
              <option value="trial_balance">Balance de Comprobación</option>
              <option value="balance">Balance General</option>
              <option value="income_statement">Estado de Resultados</option>
              <option value="movements">Libro Auxiliar</option>
              <option value="journal">Libro Diario General</option>
              <option value="entries">Comprobantes de Diario</option>
              <option value="accounts">Plan de Cuentas (PUC)</option>
              <option value="third_parties">Directorio de Terceros (DIAN)</option>
            </select>

            <button
              type="button"
              className="outline-button compact text-xs flex items-center gap-1.5 active:scale-95 transition-transform"
              onClick={() => handleExportFile('EXCEL')}
              disabled={isRemoteLoading || remoteFailed}
            >
              <AppIcon name="invoices" size={13} color="#059669" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              className="outline-button compact text-xs flex items-center gap-1.5 active:scale-95 transition-transform"
              onClick={() => handleExportFile('CSV')}
              disabled={isRemoteLoading || remoteFailed}
            >
              <AppIcon name="table" size={13} />
              <span>CSV</span>
            </button>

            <button
              type="button"
              className="primary-button compact text-xs flex items-center gap-1.5 font-bold active:scale-95 transition-transform"
              style={{ background: 'var(--navy)' }}
              onClick={handlePrint}
              disabled={isRemoteLoading || remoteFailed}
            >
              <AppIcon name="printer" size={13} />
              <span>Imprimir / PDF</span>
            </button>

            <button
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              onClick={onClose}
              aria-label="Cerrar vista previa"
            >
              <AppIcon name="close" size={18} />
            </button>
          </div>
        </div>

        {/* Filtros interactivos (ocultos al imprimir) */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-white space-y-2.5 text-xs shrink-0 print:hidden max-h-[38vh] overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {!isBalanceReport && (
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Desde</span>
                <DatePicker
                  value={startDate}
                  size="sm"
                  onChange={(value) => setStartDate(value)}
                />
              </label>
            )}
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {isBalanceReport ? 'Fecha de corte' : 'Hasta'}
              </span>
              <DatePicker
                value={endDate}
                max={isBalanceReport ? todayIso : undefined}
                size="sm"
                onChange={(value) => setEndDate(value)}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sede</span>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full text-xs py-1 px-2 h-8 border border-slate-300 rounded focus:ring-1 focus:ring-blue-900"
              >
                <option value="ALL">Todas las sedes</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>
            {!isIncomeReport && (
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Clase PUC</span>
                <select
                  value={mainAccountCode}
                  onChange={(e) => setMainAccountCode(e.target.value)}
                  className="w-full text-xs py-1 px-2 h-8 border border-slate-300 rounded focus:ring-1 focus:ring-blue-900"
                >
                  <option value="ALL">Todas las clases</option>
                  {mainClasses.map((cls) => (
                    <option key={cls.code} value={cls.code}>
                      Clase {cls.code} - {cls.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hasta el nivel</span>
              <select
                value={maxLevel}
                onChange={(e) => setMaxLevel(e.target.value as TrialBalanceLevelFilter)}
                className="w-full text-xs py-1 px-2 h-8 border border-slate-300 rounded focus:ring-1 focus:ring-blue-900"
              >
                <option value="CLASS">Clase</option>
                <option value="GROUP">Grupo</option>
                <option value="ACCOUNT">Cuenta</option>
                <option value="SUBACCOUNT">Subcuenta</option>
                <option value="AUXILIARY">Auxiliar</option>
              </select>
            </label>
          </div>

          {!isIncomeReport && (
            <AccountRangeFilter
              accounts={accounts}
              value={accountRange}
              onChange={(range) => {
                setStartAccountCode(range.from)
                setEndAccountCode(range.to)
              }}
              disabled={catalog.state === 'loading' && accounts.length === 0}
            />
          )}

          <div className="flex flex-wrap items-center gap-4">
            {activeReportType === 'trial_balance' && (
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={includeThirdParties}
                  onChange={(e) => setIncludeThirdParties(e.target.checked)}
                  className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                />
                <span>Desglose por tercero (NIT)</span>
              </label>
            )}
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600 select-none">
              <input
                type="checkbox"
                checked={hideZeroBalances}
                onChange={(e) => setHideZeroBalances(e.target.checked)}
                className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
              />
              <span>Ocultar cuentas en cero</span>
            </label>
          </div>

          {(remoteError || companyError || catalog.error) && (
            <p role="alert" className="text-[11px] text-rose-700 flex items-start gap-1.5">
              <AppIcon name="warning" size={13} />
              <span>{remoteError || companyError || catalog.error}</span>
            </p>
          )}
        </div>

        {/* DOCUMENTO IMPRIMIBLE */}
        <div className="overflow-y-auto flex-1 p-3 sm:p-6 bg-slate-100/60 print:bg-white print:p-0 print:overflow-visible">
          <div
            id="accounting-pdf-document"
            ref={reportRef}
            aria-busy={isRemoteLoading}
            className={`bg-white rounded-none border border-slate-300 p-4 sm:p-8 max-w-4xl mx-auto shadow-sm print:shadow-none print:border-none print:p-0 print:max-w-none text-black transition-opacity motion-reduce:transition-none ${
              isRemoteLoading ? 'opacity-60' : 'opacity-100'
            }`}
            style={{ width: '100%', boxSizing: 'border-box' }}
          >
            {/* MEMBRETE */}
            <header className="pb-1 mb-2">
              <div className="flex flex-wrap justify-between items-start gap-2 text-xs font-mono">
                <div>
                  <div className="font-bold text-sm tracking-wide text-black uppercase">{companyName || '—'}</div>
                  <div className="text-black font-semibold">
                    {companyNit ? `NIT: ${companyNit}` : 'NIT no registrado en la empresa'}
                    {companyRegime ? ` | ${companyRegime}` : ''}
                  </div>
                </div>
                <div className="text-right text-[11px] font-mono text-black">
                  <div>Generado: {generatedAt}</div>
                  {generatedBy && <div>Usuario: {generatedBy}</div>}
                </div>
              </div>

              <div className="text-center my-2">
                <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-black m-0 font-mono">
                  {reportConfig.title}
                </h3>
                <div className="text-[11px] text-black font-mono mt-0.5">
                  {formattedPeriod} | Expresado en pesos colombianos (COP)
                </div>
              </div>

              <div
                className="py-1.5 px-1 my-1 text-[11px] font-mono grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-black"
                style={{ borderTop: '1.5px solid #000000', borderBottom: '1.5px solid #000000' }}
              >
                <div className="flex">
                  <span className="font-bold w-28 shrink-0">Sede:</span>
                  <span className="truncate">{sedeLabel}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-28 shrink-0">{isBalanceReport ? 'Fecha de corte:' : 'Periodo:'}</span>
                  <span>{isBalanceReport ? formatIsoDateEs(endDate) : formattedPeriod}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-28 shrink-0">Rango:</span>
                  <span>
                    {isIncomeReport ? 'Clases 4, 5, 6 y 7' : accountRangeLabel}
                    {!isIncomeReport && mainAccountCode !== 'ALL' ? ` (Clase ${mainAccountCode})` : ''}
                  </span>
                </div>
                <div className="flex">
                  <span className="font-bold w-28 shrink-0">Nivel:</span>
                  <span>Hasta {ACCOUNT_LEVEL_LABEL[maxLevel === 'ALL' ? 'AUXILIARY' : maxLevel].toLowerCase()}</span>
                </div>
                {selectedThirdPartyId !== 'ALL' && (
                  <div className="flex sm:col-span-2">
                    <span className="font-bold w-28 shrink-0">Tercero:</span>
                    <span className="truncate">{resolvedThirdPartyName}</span>
                  </div>
                )}
              </div>
            </header>

            {isRemoteLoading && (
              <p className="py-6 text-center text-xs text-slate-500 font-mono print:hidden" role="status">
                Consultando saldos contables...
              </p>
            )}

            {/* FORMATO 1: BALANCE DE COMPROBACIÓN */}
            {activeReportType === 'trial_balance' && !isRemoteLoading && (
              <div className="my-2 overflow-x-auto">
                <table className="w-full border-collapse font-mono text-[10.5px] leading-tight min-w-[640px]" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr className="font-bold uppercase text-black" style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000' }}>
                      <th className="py-1 px-1 text-left" style={{ width: '14%' }}>Cuenta</th>
                      <th className="py-1 px-1 text-left" style={{ width: '34%' }}>Nombre</th>
                      <th className="py-1 px-1 text-right" style={{ width: '13%' }}>Saldo anterior</th>
                      <th className="py-1 px-1 text-right" style={{ width: '13%' }}>Débito</th>
                      <th className="py-1 px-1 text-right" style={{ width: '13%' }}>Crédito</th>
                      <th className="py-1 px-1 text-right" style={{ width: '13%' }}>Saldo final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalanceData.rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                          No hay cuentas con saldo o movimientos para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      trialBalanceData.rows.map((row) => {
                        const levelNumber = { CLASS: 1, GROUP: 2, ACCOUNT: 3, SUBACCOUNT: 4, AUXILIARY: 5 }[row.level] || 5
                        const rowFontWeight = levelNumber <= 2 ? 'font-bold' : levelNumber === 3 ? 'font-semibold' : 'font-normal'
                        return (
                          <React.Fragment key={row.code}>
                            <tr className={`text-black ${rowFontWeight}`}>
                              <td className="py-0.5 px-1 whitespace-nowrap overflow-hidden text-ellipsis">{row.code}</td>
                              <td className="py-0.5 px-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                <span style={{ paddingLeft: (levelNumber - 1) * PRINT_INDENT_PX }}>
                                  {levelNumber <= 3 ? row.name.toUpperCase() : row.name}
                                </span>
                              </td>
                              <td className="py-0.5 px-1 text-right whitespace-nowrap">{formatAccountingBalance(row.initialBalance, row.nature)}</td>
                              <td className="py-0.5 px-1 text-right whitespace-nowrap">{formatAccountingMovement(row.debit)}</td>
                              <td className="py-0.5 px-1 text-right whitespace-nowrap">{formatAccountingMovement(row.credit)}</td>
                              <td className="py-0.5 px-1 text-right whitespace-nowrap">{formatAccountingBalance(row.finalBalance, row.nature)}</td>
                            </tr>
                            {includeThirdParties &&
                              row.thirdParties?.map((tp, tpIdx) => (
                                <tr key={`${row.code}-tp-${tpIdx}`} className="text-slate-800 text-[10px]">
                                  <td className="py-0.5 px-1 text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">{row.code}</td>
                                  <td className="py-0.5 px-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                    <span style={{ paddingLeft: levelNumber * PRINT_INDENT_PX }}>
                                      Tercero: {tp.docNumber ? `${tp.docNumber} - ` : ''}
                                      {tp.name}
                                    </span>
                                  </td>
                                  <td className="py-0.5 px-1 text-right whitespace-nowrap text-slate-600">{formatAccountingBalance(tp.initialBalance, row.nature)}</td>
                                  <td className="py-0.5 px-1 text-right whitespace-nowrap text-slate-600">{formatAccountingMovement(tp.debit)}</td>
                                  <td className="py-0.5 px-1 text-right whitespace-nowrap text-slate-600">{formatAccountingMovement(tp.credit)}</td>
                                  <td className="py-0.5 px-1 text-right whitespace-nowrap font-medium text-slate-900">{formatAccountingBalance(tp.finalBalance, row.nature)}</td>
                                </tr>
                              ))}
                          </React.Fragment>
                        )
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-black text-[10.5px]" style={{ borderTop: '1.5px solid #000', borderBottom: '3px double #000' }}>
                      <td className="py-2 px-1">TOTALES</td>
                      <td className="py-2 px-1">{trialBalanceData.isBalanced ? 'SUMAS IGUALES' : 'SUMAS DESCUADRADAS'}</td>
                      <td className="py-2 px-1 text-right whitespace-nowrap">{formatAccountingBalance(netInitial, 'DEBIT')}</td>
                      <td className="py-2 px-1 text-right whitespace-nowrap">{formatAccountingMovement(trialBalanceData.totalDebit)}</td>
                      <td className="py-2 px-1 text-right whitespace-nowrap">{formatAccountingMovement(trialBalanceData.totalCredit)}</td>
                      <td className="py-2 px-1 text-right whitespace-nowrap">{formatAccountingBalance(netFinal, 'DEBIT')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* FORMATO 2: LIBRO AUXILIAR */}
            {activeReportType === 'movements' && (
              <div className="my-2 space-y-4 overflow-x-auto">
                {auxiliaryAccountsData.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 font-mono text-xs">
                    No hay movimientos contables en las cuentas, sede o fechas seleccionadas.
                  </div>
                ) : (
                  auxiliaryAccountsData.map((item) => (
                    <section key={item.account.id} className="border-b border-slate-300 pb-3 min-w-[600px]">
                      <div className="bg-slate-100/90 py-1 px-2 font-mono text-xs font-bold flex flex-wrap justify-between gap-2 items-center text-black border-t border-b border-black">
                        <h4 className="text-xs font-bold m-0">
                          CUENTA: {item.account.code} - {item.account.name.toUpperCase()} ({item.account.nature === 'DEBIT' ? 'DÉBITO' : 'CRÉDITO'})
                        </h4>
                        <div>SALDO INICIAL: {formatAccountingBalance(item.initialBalance, item.account.nature)}</div>
                      </div>
                      <table className="w-full border-collapse font-mono text-[10px] my-1" style={{ tableLayout: 'fixed' }}>
                        <thead>
                          <tr className="font-bold border-b border-black text-black">
                            <th className="py-1 text-left" style={{ width: '10%' }}>FECHA</th>
                            <th className="py-1 text-left" style={{ width: '13%' }}>COMPROBANTE</th>
                            <th className="py-1 text-left" style={{ width: '25%' }}>CONCEPTO</th>
                            <th className="py-1 text-left" style={{ width: '18%' }}>TERCERO</th>
                            <th className="py-1 text-right" style={{ width: '11%' }}>DÉBITO</th>
                            <th className="py-1 text-right" style={{ width: '11%' }}>CRÉDITO</th>
                            <th className="py-1 text-right" style={{ width: '12%' }}>SALDO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.movements.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-2 text-center text-slate-500 italic">
                                Sin movimientos en el periodo (mantiene el saldo inicial).
                              </td>
                            </tr>
                          ) : (
                            item.movements.map((m) => (
                              <tr key={m.id} className="border-b border-slate-100">
                                <td className="py-0.5 whitespace-nowrap">{formatIsoDateEs(m.date)}</td>
                                <td className="py-0.5 whitespace-nowrap font-semibold overflow-hidden text-ellipsis">{m.voucherNumber}</td>
                                <td className="py-0.5 truncate">{m.description}</td>
                                <td className="py-0.5 truncate">
                                  {m.thirdPartyDoc ? `${m.thirdPartyDoc} - ` : ''}
                                  {m.thirdPartyName}
                                </td>
                                <td className="py-0.5 text-right whitespace-nowrap">{formatAccountingMovement(m.debit)}</td>
                                <td className="py-0.5 text-right whitespace-nowrap">{formatAccountingMovement(m.credit)}</td>
                                <td className="py-0.5 text-right whitespace-nowrap">{formatAccountingBalance(m.runningBalance, item.account.nature)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold border-t border-black text-black text-[10.5px]">
                            <td colSpan={4} className="py-1 text-right pr-2">TOTALES CUENTA {item.account.code}</td>
                            <td className="py-1 text-right whitespace-nowrap">{formatAccountingMovement(item.totalDebit)}</td>
                            <td className="py-1 text-right whitespace-nowrap">{formatAccountingMovement(item.totalCredit)}</td>
                            <td className="py-1 text-right whitespace-nowrap">{formatAccountingBalance(item.finalBalance, item.account.nature)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </section>
                  ))
                )}

                <div
                  className="p-2 font-mono text-xs font-bold flex flex-wrap justify-between gap-2 items-center text-black print-avoid-break"
                  style={{ borderTop: '2px solid #000', borderBottom: '3px double #000' }}
                >
                  <span>GRAN TOTAL LIBRO AUXILIAR</span>
                  <div className="flex flex-wrap gap-x-6">
                    <span>DÉBITOS: {formatAccountingMovement(auxTotalDebit)}</span>
                    <span>CRÉDITOS: {formatAccountingMovement(auxTotalCredit)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* FORMATO 3: COMPROBANTES DE DIARIO */}
            {activeReportType === 'entries' && (
              <div className="my-2 space-y-4 overflow-x-auto">
                {filteredEntriesList.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 font-mono text-xs">
                    No hay comprobantes para los filtros seleccionados.
                  </div>
                ) : (
                  filteredEntriesList.map((entry) => (
                    <section key={entry.id} className="border border-slate-300 p-2 mb-3 bg-white min-w-[560px] print-avoid-break">
                      <div className="border-b border-black pb-1 mb-1.5 flex justify-between items-start gap-2 font-mono text-xs">
                        <div>
                          <h4 className="text-black text-sm font-bold m-0 inline">{entry.entryNumber}</h4>{' '}
                          <span className="text-slate-600">({entry.sourceType})</span>
                          <div className="text-[11px] text-slate-800 font-sans mt-0.5">
                            <strong>Concepto:</strong> {entry.description}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold">Fecha:</span> {formatIsoDateEs(entry.date)}
                          <div>
                            <span className="text-[10px] font-bold px-1.5 bg-slate-100 border border-slate-300">
                              {entry.status === 'POSTED' ? 'CONTABILIZADO' : entry.status === 'REVERSED' ? 'REVERSADO' : 'BORRADOR'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <table className="w-full border-collapse font-mono text-[10px]" style={{ tableLayout: 'fixed' }}>
                        <thead>
                          <tr className="font-bold border-b border-black text-black">
                            <th className="py-0.5 text-left" style={{ width: '15%' }}>CÓDIGO PUC</th>
                            <th className="py-0.5 text-left" style={{ width: '35%' }}>CUENTA</th>
                            <th className="py-0.5 text-left" style={{ width: '24%' }}>TERCERO</th>
                            <th className="py-0.5 text-right" style={{ width: '13%' }}>DÉBITO</th>
                            <th className="py-0.5 text-right" style={{ width: '13%' }}>CRÉDITO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.lines.map((l, lIdx) => (
                            <tr key={l.id || lIdx} className="border-b border-slate-100">
                              <td className="py-0.5 whitespace-nowrap font-semibold">{l.accountCode}</td>
                              <td className="py-0.5 truncate">{l.accountName}</td>
                              <td className="py-0.5 truncate">{entry.thirdPartyName || '—'}</td>
                              <td className="py-0.5 text-right whitespace-nowrap">{formatAccountingMovement(l.debit)}</td>
                              <td className="py-0.5 text-right whitespace-nowrap">{formatAccountingMovement(l.credit)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold border-t border-black text-black text-[10.5px]">
                            <td colSpan={3} className="py-1 text-right pr-2">TOTAL COMPROBANTE</td>
                            <td className="py-1 text-right whitespace-nowrap">{formatAccountingMovement(entry.totalDebit)}</td>
                            <td className="py-1 text-right whitespace-nowrap">{formatAccountingMovement(entry.totalCredit)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </section>
                  ))
                )}
                <div
                  className="p-2 font-mono text-xs font-bold flex flex-wrap justify-between gap-2 items-center text-black print-avoid-break"
                  style={{ borderTop: '2px solid #000', borderBottom: '3px double #000' }}
                >
                  <span>TOTAL COMPROBANTES ({filteredEntriesList.length})</span>
                  <div className="flex flex-wrap gap-x-6">
                    <span>DÉBITO: {formatAccountingMovement(entriesTotalDebit)}</span>
                    <span>CRÉDITO: {formatAccountingMovement(entriesTotalCredit)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* FORMATO 4: LIBRO DIARIO GENERAL */}
            {activeReportType === 'journal' && (
              <div className="my-2 overflow-x-auto">
                <table className="w-full border-collapse font-mono text-[10px] leading-tight min-w-[640px]" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr className="font-bold uppercase text-black" style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000' }}>
                      <th className="py-1 text-left" style={{ width: '10%' }}>Fecha</th>
                      <th className="py-1 text-left" style={{ width: '13%' }}>Comprobante</th>
                      <th className="py-1 text-left" style={{ width: '13%' }}>Cuenta</th>
                      <th className="py-1 text-left" style={{ width: '24%' }}>Nombre de cuenta</th>
                      <th className="py-1 text-left" style={{ width: '18%' }}>Tercero / detalle</th>
                      <th className="py-1 text-right" style={{ width: '11%' }}>Débito</th>
                      <th className="py-1 text-right" style={{ width: '11%' }}>Crédito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                          No hay líneas contables para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      journalRows.map((row, rIdx) => (
                        <tr key={`${row.voucherNumber}-${rIdx}`} className="border-b border-slate-100">
                          <td className="py-0.5 whitespace-nowrap">{formatIsoDateEs(row.date)}</td>
                          <td className="py-0.5 whitespace-nowrap font-semibold overflow-hidden text-ellipsis">{row.voucherNumber}</td>
                          <td className="py-0.5 whitespace-nowrap">{row.accountCode}</td>
                          <td className="py-0.5 truncate">{row.accountName}</td>
                          <td className="py-0.5 truncate" title={row.description}>
                            {row.thirdPartyName ? `${row.thirdPartyName}: ` : ''}
                            {row.description}
                          </td>
                          <td className="py-0.5 text-right whitespace-nowrap">{formatAccountingMovement(row.debit)}</td>
                          <td className="py-0.5 text-right whitespace-nowrap">{formatAccountingMovement(row.credit)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-black text-[10.5px]" style={{ borderTop: '1.5px solid #000', borderBottom: '3px double #000' }}>
                      <td colSpan={5} className="py-1.5 text-right pr-2">TOTALES LIBRO DIARIO</td>
                      <td className="py-1.5 text-right whitespace-nowrap">{formatAccountingMovement(journalTotalDebit)}</td>
                      <td className="py-1.5 text-right whitespace-nowrap">{formatAccountingMovement(journalTotalCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* FORMATO 5: DIRECTORIO DE TERCEROS (DIAN) */}
            {activeReportType === 'third_parties' && (
              <div className="my-2 overflow-x-auto">
                <table className="w-full border-collapse font-mono text-[10px] leading-tight min-w-[640px]" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr className="font-bold uppercase text-black" style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000' }}>
                      <th className="py-1 text-left" style={{ width: '8%' }}>Tipo</th>
                      <th className="py-1 text-left" style={{ width: '15%' }}>Documento / NIT</th>
                      <th className="py-1 text-left" style={{ width: '28%' }}>Razón social / nombre</th>
                      <th className="py-1 text-left" style={{ width: '17%' }}>Nombre comercial</th>
                      <th className="py-1 text-left" style={{ width: '12%' }}>Rol</th>
                      <th className="py-1 text-left" style={{ width: '20%' }}>Contacto / ciudad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredThirdPartiesList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                          No hay terceros registrados con los criterios seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredThirdPartiesList.map((tp) => (
                        <tr key={tp.id} className="border-b border-slate-100">
                          <td className="py-0.5 whitespace-nowrap">{tp.documentType}</td>
                          <td className="py-0.5 whitespace-nowrap font-bold">
                            {tp.documentNumber}
                            {tp.verificationDigit ? `-${tp.verificationDigit}` : ''}
                          </td>
                          <td className="py-0.5 truncate font-semibold">{tp.companyName}</td>
                          <td className="py-0.5 truncate text-slate-600">{tp.commercialName || '—'}</td>
                          <td className="py-0.5 whitespace-nowrap text-[9px]">{tp.thirdPartyType}</td>
                          <td className="py-0.5 truncate text-slate-700">
                            {tp.city || '—'} {tp.phone ? `| Tel: ${tp.phone}` : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-black text-[10.5px]" style={{ borderTop: '1.5px solid #000', borderBottom: '3px double #000' }}>
                      <td colSpan={6} className="py-1.5">TOTAL TERCEROS: {filteredThirdPartiesList.length}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* FORMATO 6: PLAN DE CUENTAS */}
            {activeReportType === 'accounts' && (
              <div className="my-2 overflow-x-auto">
                <table className="w-full border-collapse font-mono text-[10px] leading-tight min-w-[560px]" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr className="font-bold uppercase text-black" style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000' }}>
                      <th className="py-1 text-left" style={{ width: '18%' }}>Código PUC</th>
                      <th className="py-1 text-left" style={{ width: '50%' }}>Descripción de la cuenta</th>
                      <th className="py-1 text-left" style={{ width: '16%' }}>Nivel</th>
                      <th className="py-1 text-left" style={{ width: '16%' }}>Naturaleza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccountsList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500 font-medium">
                          No hay cuentas contables con los criterios seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredAccountsList.map((acc) => {
                        const levelNumber = { CLASS: 1, GROUP: 2, ACCOUNT: 3, SUBACCOUNT: 4, AUXILIARY: 5 }[acc.level] || 5
                        return (
                          <tr key={acc.id} className={`border-b border-slate-100 ${levelNumber <= 3 ? 'font-bold text-black' : 'text-slate-800'}`}>
                            <td className="py-0.5 whitespace-nowrap">{acc.code}</td>
                            <td className="py-0.5 truncate">
                              <span style={{ paddingLeft: (levelNumber - 1) * PRINT_INDENT_PX }}>{acc.name}</span>
                            </td>
                            <td className="py-0.5 whitespace-nowrap text-slate-600">{ACCOUNT_LEVEL_LABEL[acc.level]}</td>
                            <td className="py-0.5 whitespace-nowrap font-semibold">{acc.nature === 'DEBIT' ? 'Débito' : 'Crédito'}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-black text-[10.5px]" style={{ borderTop: '1.5px solid #000', borderBottom: '3px double #000' }}>
                      <td colSpan={4} className="py-1.5">TOTAL CUENTAS: {filteredAccountsList.length}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* FORMATO 7: BALANCE GENERAL DESGLOSADO */}
            {isBalanceReport && !isRemoteLoading && balanceReport && (
              <div className="my-2 space-y-3 font-mono text-[10.5px] overflow-x-auto">
                {(
                  [
                    { key: 'assets', title: '1. ACTIVO', rows: balanceSections.assets, total: balanceReport.totalAssets, totalLabel: 'TOTAL ACTIVO' },
                    { key: 'liabilities', title: '2. PASIVO', rows: balanceSections.liabilities, total: balanceReport.totalLiabilities, totalLabel: 'TOTAL PASIVO' },
                    { key: 'equity', title: '3. PATRIMONIO', rows: balanceSections.equity, total: balanceReport.totalEquityAccounts, totalLabel: 'SUBTOTAL CLASE 3' },
                  ] as const
                ).map((section) => (
                  <section key={section.key} className="min-w-[520px]">
                    <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                      <thead>
                        <tr className="font-bold uppercase text-black" style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000' }}>
                          <th className="py-1 px-1 text-left" style={{ width: '18%' }}>{section.title}</th>
                          <th className="py-1 px-1 text-left" style={{ width: '57%' }}>Cuenta</th>
                          <th className="py-1 px-1 text-right" style={{ width: '25%' }}>Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-2 px-1 text-slate-500">Sin saldos en esta clase para los filtros seleccionados.</td>
                          </tr>
                        ) : (
                          balanceRowsTable(section.rows)
                        )}
                      </tbody>
                      <tfoot>
                        {section.key === 'equity' && (
                          <>
                            <tr className="text-black">
                              <td className="py-0.5 px-1" />
                              <td className="py-0.5 px-1 font-semibold">RESULTADO DEL EJERCICIO (4 − 5 − 6 − 7, SIN CIERRE)</td>
                              <td className="py-0.5 px-1 text-right whitespace-nowrap font-semibold">{formatCop(balanceReport.currentYearResult)}</td>
                            </tr>
                            <tr className="text-slate-700 text-[10px]">
                              <td className="px-1" />
                              <td className="px-1" style={{ paddingLeft: PRINT_INDENT_PX * 2 }}>
                                Ingresos {formatCop(balanceReport.resultBreakdown.revenues)} − Gastos {formatCop(balanceReport.resultBreakdown.expenses)} − Costos de ventas{' '}
                                {formatCop(balanceReport.resultBreakdown.costOfSales)} − Costos de producción {formatCop(balanceReport.resultBreakdown.productionCosts)}
                              </td>
                              <td className="px-1" />
                            </tr>
                          </>
                        )}
                        <tr className="font-bold text-black" style={{ borderTop: '1px solid #000' }}>
                          <td className="py-1 px-1" />
                          <td className="py-1 px-1">{section.totalLabel}</td>
                          <td className="py-1 px-1 text-right whitespace-nowrap">{formatCop(section.total)}</td>
                        </tr>
                        {section.key === 'equity' && (
                          <tr className="font-bold text-black">
                            <td className="py-1 px-1" />
                            <td className="py-1 px-1">TOTAL PATRIMONIO</td>
                            <td className="py-1 px-1 text-right whitespace-nowrap">{formatCop(balanceReport.totalEquity)}</td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </section>
                ))}

                <div
                  className="p-2 font-mono text-xs font-bold bg-slate-50 flex flex-wrap justify-between gap-2 items-center text-black print-avoid-break min-w-[520px]"
                  style={{ borderTop: '2px solid #000', borderBottom: '3px double #000' }}
                >
                  <div>
                    ECUACIÓN PATRIMONIAL: ACTIVO = PASIVO + PATRIMONIO
                    <div className="text-[10px] text-slate-700 font-normal">
                      {formatCop(balanceReport.totalAssets)} = {formatCop(balanceReport.totalLiabilities)} + {formatCop(balanceReport.totalEquity)}
                      {' '}(Total pasivo + patrimonio: {formatCop(balanceReport.totalLiabilitiesAndEquity)})
                    </div>
                  </div>
                  <span className="font-extrabold">
                    {balanceReport.accountFrom || balanceReport.accountTo
                      ? 'RANGO PARCIAL DE CUENTAS'
                      : balanceReport.isBalanced
                      ? 'CUADRADO (DIFERENCIA $ 0,00)'
                      : `DESCUADRE: ${formatCop(balanceReport.difference)}`}
                  </span>
                </div>
              </div>
            )}

            {/* FORMATO 8: ESTADO DE RESULTADOS DESGLOSADO */}
            {isIncomeReport && !isRemoteLoading && incomeReport && (
              <div className="my-2 space-y-3 font-mono text-[10.5px] overflow-x-auto">
                {incomeSections.map((section) => (
                  <section key={section.key} className="min-w-[520px]">
                    <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                      <thead>
                        <tr className="font-bold uppercase text-black" style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000' }}>
                          <th className="py-1 px-1 text-left" style={{ width: '18%' }}>{section.title}</th>
                          <th className="py-1 px-1 text-left" style={{ width: '57%' }}>Cuenta</th>
                          <th className="py-1 px-1 text-right" style={{ width: '25%' }}>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-2 px-1 text-slate-500">Sin movimientos en esta clase durante el periodo.</td>
                          </tr>
                        ) : (
                          balanceRowsTable(section.rows)
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="font-bold text-black" style={{ borderTop: '1px solid #000' }}>
                          <td className="py-1 px-1" />
                          <td className="py-1 px-1 uppercase">{section.totalLabel}</td>
                          <td className="py-1 px-1 text-right whitespace-nowrap">{formatCop(section.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </section>
                ))}

                <table className="w-full border-collapse min-w-[520px] print-avoid-break" style={{ tableLayout: 'fixed' }}>
                  <caption className="text-left font-bold uppercase text-black py-1">Resumen del resultado</caption>
                  <tbody>
                    {incomeStatementLines(incomeReport).map((line) => (
                      <tr
                        key={line.key}
                        className={`text-black ${line.kind === 'line' ? '' : 'font-bold'}`}
                        style={
                          line.kind === 'total'
                            ? { borderTop: '2px solid #000', borderBottom: '3px double #000' }
                            : line.kind === 'subtotal'
                            ? { borderTop: '1px solid #000' }
                            : undefined
                        }
                      >
                        <td className="py-0.5 px-1" style={{ width: '75%', paddingLeft: line.kind === 'line' ? PRINT_INDENT_PX * 2 : undefined }}>
                          {line.kind === 'line' ? line.label : line.label.toUpperCase()}
                        </td>
                        <td className="py-0.5 px-1 text-right whitespace-nowrap" style={{ width: '25%' }}>
                          {formatCop(line.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="text-slate-700 text-[10px]">
                      <td className="pt-1 px-1">
                        Margen bruto {incomeReport.grossMarginPercent} % | Margen neto {incomeReport.netMarginPercent} %
                      </td>
                      <td className="px-1" />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* FIRMAS */}
            <div className="mt-8 pt-4 print-avoid-break">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-xs font-mono">
                <div>
                  <div className="w-40 border-b border-black mx-auto mb-1.5 mt-8" />
                  <strong className="block text-[11px] uppercase text-black">Representante legal</strong>
                  <span className="text-[10px] text-slate-700 block">{company?.legalRepresentative || 'C.C. ___________________'}</span>
                  {companyName && <span className="text-[9.5px] text-slate-500 block">{companyName}</span>}
                </div>
                <div>
                  <div className="w-40 border-b border-black mx-auto mb-1.5 mt-8" />
                  <strong className="block text-[11px] uppercase text-black">Contador público</strong>
                  <span className="text-[10px] text-slate-600 block">T.P. No. ________________-T</span>
                </div>
                <div>
                  <div className="w-40 border-b border-black mx-auto mb-1.5 mt-8" />
                  <strong className="block text-[11px] uppercase text-black">Revisor fiscal</strong>
                  <span className="text-[10px] text-slate-600 block">T.P. No. ________________-T</span>
                </div>
              </div>
            </div>

            {/* PIE DEL DOCUMENTO */}
            <footer className="mt-8 pt-3 border-t border-slate-300 text-[10px] text-slate-600 flex flex-wrap items-center justify-between gap-2 font-sans">
              <span>
                Generado el {generatedAt}
                {generatedBy ? ` por ${generatedBy}` : ''}
              </span>
              <span>
                © {new Date().getFullYear()} {company?.tradeName || companyName}. Todos los derechos reservados.
              </span>
              <a
                href="https://www.kytcode.lat"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-black hover:text-blue-900 inline-flex items-center gap-1 transition-colors"
                style={{ textDecoration: 'none' }}
              >
                <span>Desarrollado por K&T</span>
                <Heart className="w-3 h-3 fill-black text-black inline-block" aria-hidden="true" />
              </a>
            </footer>
          </div>
        </div>

        {/* Pie del modal (oculto al imprimir) */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0 print:hidden">
          <button type="button" className="outline-button compact text-xs" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="primary-button compact text-xs flex items-center gap-2 font-bold active:scale-95 transition-transform"
            style={{ background: 'var(--navy)' }}
            onClick={handlePrint}
            disabled={isRemoteLoading || remoteFailed}
          >
            <AppIcon name="printer" size={14} />
            <span>Imprimir / Guardar en PDF</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
