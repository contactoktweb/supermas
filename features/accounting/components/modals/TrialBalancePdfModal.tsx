'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { Heart } from 'lucide-react'
import {
  AccountingAccount,
  AccountingMovement,
  AccountingEntry,
  ThirdParty,
  TrialBalanceLevelFilter,
  TrialBalanceReportData,
  AccountingExportType,
  ThirdPartyType,
  LegalNature,
  AccountingEntryStatus,
} from '../../types'
import { accountingExportService } from '../../services/accounting-export.service'

export interface TrialBalancePdfModalProps {
  isOpen: boolean
  onClose: () => void
  reportType?: AccountingExportType
  accounts: AccountingAccount[]
  movements: AccountingMovement[]
  entries?: AccountingEntry[]
  thirdParties: ThirdParty[]
  initialMainAccountCode?: string
  initialStartAccountCode?: string
  initialEndAccountCode?: string
  initialBranch?: string
  initialCostCenter?: string
  initialAdministrativeArea?: string
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

/**
 * Formatea un valor según el estándar contable oficial colombiano:
 * Millares separados por coma, 2 decimales separados por punto,
 * seguido por ' D' (Débito) o ' C' (Crédito).
 */
function formatAccountingBalance(amount: number, nature: 'DEBIT' | 'CREDIT'): string {
  const absAmount = Math.abs(amount)
  if (absAmount < 0.005) {
    return '0.00'
  }
  const formattedNumber = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  let suffix = 'D'
  if (nature === 'DEBIT') {
    suffix = amount >= 0 ? 'D' : 'C'
  } else {
    suffix = amount >= 0 ? 'C' : 'D'
  }

  return `${formattedNumber} ${suffix}`
}

/**
 * Formatea débitos y créditos del periodo (número con 2 decimales o '0.00')
 */
function formatAccountingMovement(amount: number): string {
  const absAmount = Math.abs(amount)
  if (absAmount < 0.005) {
    return '0.00'
  }
  return absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Formato monetario estándar colombiano
 */
function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function TrialBalancePdfModal({
  isOpen,
  onClose,
  reportType = 'trial_balance',
  accounts,
  movements,
  entries = [],
  thirdParties,
  initialMainAccountCode = 'ALL',
  initialStartAccountCode = '',
  initialEndAccountCode = '',
  initialBranch = '01 - SUPER MÁS PRINCIPAL',
  initialCostCenter = 'TODOS',
  initialAdministrativeArea = 'TODAS',
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

  // Reporte activo actualmente en el visor
  const [activeReportType, setActiveReportType] = useState<AccountingExportType>(reportType)

  // Filtros interactivos del reporte
  const [mainAccountCode, setMainAccountCode] = useState<string>(initialMainAccountCode)
  const [startAccountCode, setStartAccountCode] = useState<string>(initialStartAccountCode)
  const [endAccountCode, setEndAccountCode] = useState<string>(initialEndAccountCode)
  const [branch, setBranch] = useState<string>(initialBranch)
  const [costCenter, setCostCenter] = useState<string>(initialCostCenter)
  const [administrativeArea, setAdministrativeArea] = useState<string>(initialAdministrativeArea)
  const [voucherType, setVoucherType] = useState<string>(initialVoucherType)
  const [selectedThirdPartyId, setSelectedThirdPartyId] = useState<string>(initialSelectedThirdPartyId)
  const [maxLevel, setMaxLevel] = useState<TrialBalanceLevelFilter>(initialMaxLevel)
  const [includeThirdParties, setIncludeThirdParties] = useState<boolean>(initialIncludeThirdParties)
  const [hideZeroBalances, setHideZeroBalances] = useState<boolean>(initialHideZeroBalances)

  // Fechas del balance / reporte
  const now = new Date()
  const currentYear = now.getFullYear()
  const defaultStartDate = initialStartDate || `${currentYear}-01-01`
  const defaultEndDate =
    initialEndDate ||
    `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`

  const [startDate, setStartDate] = useState<string>(defaultStartDate)
  const [endDate, setEndDate] = useState<string>(defaultEndDate)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sincronizar props cuando se abre o cambia reportType
  useEffect(() => {
    if (isOpen) {
      if (reportType) setActiveReportType(reportType)
      if (initialMainAccountCode) setMainAccountCode(initialMainAccountCode)
      if (initialStartAccountCode) setStartAccountCode(initialStartAccountCode)
      if (initialEndAccountCode) setEndAccountCode(initialEndAccountCode)
      if (initialBranch) setBranch(initialBranch)
      if (initialCostCenter) setCostCenter(initialCostCenter)
      if (initialAdministrativeArea) setAdministrativeArea(initialAdministrativeArea)
      if (initialVoucherType) setVoucherType(initialVoucherType)
      if (initialSelectedThirdPartyId) setSelectedThirdPartyId(initialSelectedThirdPartyId)
      if (initialMaxLevel) setMaxLevel(initialMaxLevel)
      if (initialIncludeThirdParties !== undefined) setIncludeThirdParties(initialIncludeThirdParties)
      if (initialHideZeroBalances !== undefined) setHideZeroBalances(initialHideZeroBalances)
      if (initialStartDate) setStartDate(initialStartDate)
      if (initialEndDate) setEndDate(initialEndDate)
    }
  }, [
    isOpen,
    reportType,
    initialMainAccountCode,
    initialStartAccountCode,
    initialEndAccountCode,
    initialBranch,
    initialCostCenter,
    initialAdministrativeArea,
    initialVoucherType,
    initialSelectedThirdPartyId,
    initialMaxLevel,
    initialIncludeThirdParties,
    initialHideZeroBalances,
    initialStartDate,
    initialEndDate,
  ])

  // Cuentas principales de nivel 1
  const mainClasses = useMemo(() => {
    return accounts
      .filter((a) => a.code.length === 1)
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [accounts])

  // Nombre del tercero seleccionado
  const resolvedThirdPartyName = useMemo(() => {
    if (selectedThirdPartyName) return selectedThirdPartyName
    if (selectedThirdPartyId === 'ALL') return 'TODOS'
    const found = thirdParties.find((tp) => tp.id === selectedThirdPartyId)
    return found ? `${found.documentNumber ? found.documentNumber + ' - ' : ''}${found.companyName}` : selectedThirdPartyId
  }, [selectedThirdPartyId, selectedThirdPartyName, thirdParties])

  // Opciones de filtro para el servicio de exportación
  const filterOptions = useMemo(() => {
    return {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      startAccountCode: startAccountCode || undefined,
      endAccountCode: endAccountCode || undefined,
      mainAccountCode: mainAccountCode !== 'ALL' ? mainAccountCode : undefined,
      branch,
      costCenter,
      administrativeArea,
      voucherType,
      selectedThirdPartyId,
      maxLevel,
      includeThirdParties,
      hideZeroBalances,
    }
  }, [
    startDate,
    endDate,
    startAccountCode,
    endAccountCode,
    mainAccountCode,
    branch,
    costCenter,
    administrativeArea,
    voucherType,
    selectedThirdPartyId,
    maxLevel,
    includeThirdParties,
    hideZeroBalances,
  ])

  // =========================================================================
  // 1. DATA: BALANCE DE COMPROBACIÓN
  // =========================================================================
  const trialBalanceData: TrialBalanceReportData = useMemo(() => {
    return accountingExportService.buildTrialBalanceData({
      accounts,
      movements,
      thirdParties,
      options: filterOptions,
    })
  }, [accounts, movements, thirdParties, filterOptions])

  // =========================================================================
  // 2. DATA: LIBRO AUXILIAR DE CUENTAS
  // =========================================================================
  const auxiliaryAccountsData = useMemo(() => {
    const accMap = new Map<
      string,
      {
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
      }
    >()

    const activeAccounts = accounts.filter((acc) => {
      if (startAccountCode && acc.code < startAccountCode) return false
      if (endAccountCode && acc.code > endAccountCode) return false
      if (mainAccountCode !== 'ALL' && !acc.code.startsWith(mainAccountCode)) return false
      return true
    })

    for (const acc of activeAccounts) {
      const accMovements = movements.filter(
        (m) => m.accountCode === acc.code || m.accountCode.startsWith(acc.code)
      )
      const priorMovs = accMovements.filter(
        (m) => startDate && m.date.slice(0, 10) < startDate
      )
      const periodMovs = accMovements.filter((m) => {
        if (startDate && m.date.slice(0, 10) < startDate) return false
        if (endDate && m.date.slice(0, 10) > endDate) return false
        if (voucherType !== 'TODOS' && m.sourceType !== voucherType) return false
        if (selectedThirdPartyId !== 'ALL' && m.thirdPartyId !== selectedThirdPartyId) return false
        return true
      })

      const priorDebit = priorMovs.reduce((s, m) => s + (m.debit || 0), 0)
      const priorCredit = priorMovs.reduce((s, m) => s + (m.credit || 0), 0)
      const initialBal =
        acc.nature === 'DEBIT' ? priorDebit - priorCredit : priorCredit - priorDebit

      if (hideZeroBalances && initialBal === 0 && periodMovs.length === 0) {
        continue
      }

      let running = initialBal
      const sortedMovs = [...periodMovs].sort((a, b) => a.date.localeCompare(b.date))
      const movsWithRunning = sortedMovs.map((m) => {
        const tp = thirdParties.find((t) => t.id === m.thirdPartyId)
        if (acc.nature === 'DEBIT') {
          running = running + (m.debit || 0) - (m.credit || 0)
        } else {
          running = running + (m.credit || 0) - (m.debit || 0)
        }
        return {
          id: m.id,
          date: m.date,
          voucherNumber: m.entryNumber || 'CD',
          description: m.description || 'Movimiento de causación',
          thirdPartyName: m.thirdPartyName || tp?.companyName || '—',
          thirdPartyDoc: tp?.documentNumber || '',
          debit: m.debit || 0,
          credit: m.credit || 0,
          runningBalance: running,
        }
      })

      const totDebit = periodMovs.reduce((s, m) => s + (m.debit || 0), 0)
      const totCredit = periodMovs.reduce((s, m) => s + (m.credit || 0), 0)

      accMap.set(acc.code, {
        account: acc,
        initialBalance: initialBal,
        movements: movsWithRunning,
        totalDebit: totDebit,
        totalCredit: totCredit,
        finalBalance: running,
      })
    }

    return Array.from(accMap.values()).sort((a, b) => a.account.code.localeCompare(b.account.code))
  }, [
    accounts,
    movements,
    thirdParties,
    startDate,
    endDate,
    startAccountCode,
    endAccountCode,
    mainAccountCode,
    voucherType,
    selectedThirdPartyId,
    hideZeroBalances,
  ])

  // =========================================================================
  // 3. DATA: COMPROBANTES DE DIARIO / ASIENTOS CONTABLES
  // =========================================================================
  const filteredEntriesList = useMemo(() => {
    return (entries || [])
      .filter((e) => {
        if (startDate && e.date.slice(0, 10) < startDate) return false
        if (endDate && e.date.slice(0, 10) > endDate) return false
        if (voucherType !== 'TODOS' && e.sourceType !== voucherType) return false
        if (initialEntryStatus && initialEntryStatus !== 'ALL' && e.status !== initialEntryStatus) return false
        if (initialSearchQuery) {
          const q = initialSearchQuery.toLowerCase()
          const matchNum = e.entryNumber.toLowerCase().includes(q)
          const matchDesc = e.description.toLowerCase().includes(q)
          if (!matchNum && !matchDesc) return false
        }
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [entries, startDate, endDate, voucherType, initialEntryStatus, initialSearchQuery])

  // =========================================================================
  // 4. DATA: LIBRO DIARIO GENERAL
  // =========================================================================
  const journalRows = useMemo(() => {
    const rows: Array<{
      date: string
      voucherNumber: string
      voucherType: string
      accountCode: string
      accountName: string
      thirdPartyName: string
      description: string
      debit: number
      credit: number
    }> = []

    for (const e of filteredEntriesList) {
      for (const line of e.lines) {
        if (startAccountCode && line.accountCode < startAccountCode) continue
        if (endAccountCode && line.accountCode > endAccountCode) continue
        if (mainAccountCode !== 'ALL' && !line.accountCode.startsWith(mainAccountCode)) continue

        rows.push({
          date: e.date,
          voucherNumber: e.entryNumber,
          voucherType: e.sourceType || 'CD',
          accountCode: line.accountCode,
          accountName: line.accountName,
          thirdPartyName: e.thirdPartyName || (e.thirdPartyId ? 'Tercero' : '—'),
          description: line.description || e.description,
          debit: line.debit,
          credit: line.credit,
        })
      }
    }

    return rows.sort(
      (a, b) => a.date.localeCompare(b.date) || a.voucherNumber.localeCompare(b.voucherNumber)
    )
  }, [filteredEntriesList, startAccountCode, endAccountCode, mainAccountCode])

  // =========================================================================
  // 5. DATA: TERCEROS (DIAN)
  // =========================================================================
  const filteredThirdPartiesList = useMemo(() => {
    return accountingExportService
      .filterThirdParties(thirdParties, {
        startDate,
        endDate,
        thirdPartyType: initialThirdPartyType as any,
        legalNature: initialLegalNature as any,
        searchQuery: initialSearchQuery,
      })
      .sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''))
  }, [thirdParties, startDate, endDate, initialThirdPartyType, initialLegalNature, initialSearchQuery])

  // =========================================================================
  // 6. DATA: PLAN DE CUENTAS (PUC)
  // =========================================================================
  const filteredAccountsList = useMemo(() => {
    return accountingExportService
      .filterAccounts(accounts, {
        startAccountCode,
        endAccountCode,
        mainAccountCode: mainAccountCode !== 'ALL' ? mainAccountCode : undefined,
        maxLevel,
        searchQuery: initialSearchQuery,
      })
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [accounts, startAccountCode, endAccountCode, mainAccountCode, maxLevel, initialSearchQuery])

  // =========================================================================
  // 7. DATA: BALANCE GENERAL (SITUACIÓN FINANCIERA)
  // =========================================================================
  const balanceSheetStructure = useMemo(() => {
    const calcAccountBalance = (codePrefix: string) => {
      const matchAccs = accounts.filter((a) => a.code.startsWith(codePrefix))
      let total = 0
      for (const a of matchAccs) {
        const movs = movements.filter((m) => m.accountCode === a.code || m.accountCode.startsWith(a.code))
        const debit = movs.reduce((s, m) => s + (m.debit || 0), 0)
        const credit = movs.reduce((s, m) => s + (m.credit || 0), 0)
        if (a.nature === 'DEBIT') {
          total += debit - credit
        } else {
          total += credit - debit
        }
      }
      return total
    }

    // Activo (1)
    const efectivo = calcAccountBalance('11')
    const deudores = calcAccountBalance('13')
    const inventarios = calcAccountBalance('14')
    const activoCorriente = efectivo + deudores + inventarios

    const propiedadPlantaEquipo = calcAccountBalance('15')
    const otrosActivos = calcAccountBalance('17') + calcAccountBalance('18') + calcAccountBalance('19')
    const activoNoCorriente = propiedadPlantaEquipo + otrosActivos
    const totalActivo = activoCorriente + activoNoCorriente

    // Pasivo (2)
    const obligacionesFinancieras = calcAccountBalance('21')
    const proveedores = calcAccountBalance('22')
    const cuentasPorPagar = calcAccountBalance('23')
    const impuestosPorPagar = calcAccountBalance('24')
    const obligacionesLaborales = calcAccountBalance('25')
    const pasivoCorriente = proveedores + cuentasPorPagar + impuestosPorPagar + obligacionesLaborales
    const pasivoNoCorriente = obligacionesFinancieras
    const totalPasivo = pasivoCorriente + pasivoNoCorriente

    // Patrimonio (3)
    const capitalSocial = calcAccountBalance('31')
    const reservas = calcAccountBalance('33')
    const resultadosAcumulados = calcAccountBalance('37')
    const resultadoEjercicio = totalActivo - totalPasivo - (capitalSocial + reservas + resultadosAcumulados)
    const totalPatrimonio = capitalSocial + reservas + resultadosAcumulados + resultadoEjercicio

    const ecuacionDiferencia = totalActivo - (totalPasivo + totalPatrimonio)

    return {
      activo: {
        corriente: {
          efectivo,
          deudores,
          inventarios,
          total: activoCorriente,
        },
        noCorriente: {
          propiedadPlantaEquipo,
          otrosActivos,
          total: activoNoCorriente,
        },
        total: totalActivo,
      },
      pasivo: {
        corriente: {
          proveedores,
          cuentasPorPagar,
          impuestosPorPagar,
          obligacionesLaborales,
          total: pasivoCorriente,
        },
        noCorriente: {
          obligacionesFinancieras,
          total: pasivoNoCorriente,
        },
        total: totalPasivo,
      },
      patrimonio: {
        capitalSocial,
        reservas,
        resultadosAcumulados,
        resultadoEjercicio,
        total: totalPatrimonio,
      },
      ecuacionDiferencia,
    }
  }, [accounts, movements])

  // Metadatos de títulos según el reporte activo
  const reportConfig = useMemo(() => {
    const map: Record<
      AccountingExportType,
      { title: string; subtitle: string; icon: LightIconName; badge: string }
    > = {
      trial_balance: {
        title: 'BALANCE DE COMPROBACION',
        subtitle: 'Informe Fiduciario Oficial de Sumas y Saldos por Cuenta y Subcuentas',
        icon: 'receipt',
        badge: 'Libro Oficial',
      },
      movements: {
        title: 'LIBRO AUXILIAR DE CUENTAS CONTABLES',
        subtitle: 'Detalle Cronológico de Movimientos, Débitos, Créditos y Saldos Acumulados',
        icon: 'table',
        badge: 'Libro Auxiliar',
      },
      entries: {
        title: 'COMPROBANTES DE DIARIO Y CAUSACIONES',
        subtitle: 'Registro Oficial de Asientos de Causación con Partida Doble Verificada',
        icon: 'receipt',
        badge: 'Comprobantes',
      },
      journal: {
        title: 'LIBRO DIARIO GENERAL DE OPERACIONES',
        subtitle: 'Histórico Cronológico Consolidado de Transacciones Contables',
        icon: 'fileText',
        badge: 'Diario General',
      },
      third_parties: {
        title: 'DIRECTORIO FISCAL DE TERCEROS (DIAN)',
        subtitle: 'Registro Tributario Oficial de Clientes, Proveedores, Empleados y Acreedores',
        icon: 'users',
        badge: 'Directorio DIAN',
      },
      accounts: {
        title: 'PLAN UNICO DE CUENTAS (PUC MAESTRO)',
        subtitle: 'Catálogo Maestro Jerárquico de Cuentas, Naturalezas y Niveles Contables',
        icon: 'layers',
        badge: 'Catálogo PUC',
      },
      balance: {
        title: 'ESTADO DE SITUACION FINANCIERA (BALANCE GENERAL)',
        subtitle: 'Estructura Clasificada de Activos, Pasivos y Patrimonio con Ecuación Patrimonial',
        icon: 'wallet',
        badge: 'Estado Financiero',
      },
    }
    return map[activeReportType] || map.trial_balance
  }, [activeReportType])

  // Formato legible de periodo
  const formattedPeriod = useMemo(() => {
    return `${startDate} a ${endDate}`
  }, [startDate, endDate])

  // Impresión en ventana aislada para garantizar formato exacto al 100%
  const handlePrint = () => {
    const printElement = reportRef.current
    if (!printElement) {
      window.print()
      return
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=800')
    if (!printWindow) {
      window.print()
      return
    }

    const currentYearDynamic = new Date().getFullYear()

    printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${reportConfig.title} - ${trialBalanceData.companyName}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10.5px;
      line-height: 1.25;
    }
    .print-doc {
      width: 100%;
      max-width: 100%;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      font-family: monospace;
      font-size: 11px;
      margin-bottom: 4px;
    }
    .header-title {
      text-align: center;
      font-weight: bold;
      font-size: 13.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 4px 0;
    }
    .meta-box {
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      padding: 4px 2px;
      margin: 4px 0 8px 0;
      font-family: monospace;
      font-size: 10px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      row-gap: 2px;
      column-gap: 16px;
    }
    .meta-row {
      display: flex;
    }
    .meta-label {
      font-weight: bold;
      min-width: 130px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-family: monospace;
      font-size: 9.5px;
    }
    thead {
      display: table-header-group;
    }
    thead tr {
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      font-weight: bold;
    }
    th {
      padding: 3px 2px;
      text-transform: uppercase;
      vertical-align: middle;
    }
    td {
      padding: 2px 2px;
      vertical-align: middle;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .t-right {
      text-align: right;
    }
    .t-left {
      text-align: left;
    }
    .font-bold {
      font-weight: bold;
    }
    .totals-row {
      border-top: 1.5px solid #000 !important;
      border-bottom: 3px double #000 !important;
      font-weight: bold;
      font-size: 10px;
    }
    .signatures {
      margin-top: 24px;
      padding-top: 12px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      column-gap: 20px;
      text-align: center;
      font-family: monospace;
      font-size: 9.5px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-line {
      width: 150px;
      border-bottom: 1px solid #000;
      margin: 18px auto 4px auto;
    }
    .footer-bar {
      margin-top: 20px;
      padding-top: 6px;
      border-top: 1px solid #ccc;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: sans-serif;
      font-size: 9px;
      color: #555;
    }
    .kyt-link {
      color: #000;
      text-decoration: none;
      font-weight: bold;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
  </style>
</head>
<body>
  <div class="print-doc">
    ${printElement.innerHTML}
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 250);
    });
  </script>
</body>
</html>`)
    printWindow.document.close()
  }

  // Exportar Excel alternativo
  const handleExportExcel = () => {
    switch (activeReportType) {
      case 'trial_balance':
        accountingExportService.exportTrialBalanceExcel(trialBalanceData)
        break
      case 'movements':
        accountingExportService.exportAuxiliary(movements, 'EXCEL', filterOptions)
        break
      case 'entries':
        accountingExportService.exportEntries(entries, 'EXCEL', filterOptions)
        break
      case 'journal':
        accountingExportService.exportJournal(entries, 'EXCEL', filterOptions)
        break
      case 'third_parties':
        accountingExportService.exportThirdParties(thirdParties, 'EXCEL', filterOptions)
        break
      case 'accounts':
        accountingExportService.exportAccounts(accounts, 'EXCEL', filterOptions)
        break
      case 'balance':
        accountingExportService.exportBalance(accounts, 'EXCEL', filterOptions)
        break
    }
  }

  // Exportar CSV alternativo
  const handleExportCSV = () => {
    switch (activeReportType) {
      case 'trial_balance':
        accountingExportService.exportTrialBalanceCSV(trialBalanceData)
        break
      case 'movements':
        accountingExportService.exportAuxiliary(movements, 'CSV', filterOptions)
        break
      case 'entries':
        accountingExportService.exportEntries(entries, 'CSV', filterOptions)
        break
      case 'journal':
        accountingExportService.exportJournal(entries, 'CSV', filterOptions)
        break
      case 'third_parties':
        accountingExportService.exportThirdParties(thirdParties, 'CSV', filterOptions)
        break
      case 'accounts':
        accountingExportService.exportAccounts(accounts, 'CSV', filterOptions)
        break
      case 'balance':
        accountingExportService.exportBalance(accounts, 'CSV', filterOptions)
        break
    }
  }

  if (!isOpen || !mounted) return null

  // Cálculo de totales netos para Balance de Comprobación
  const netInitialDebit =
    trialBalanceData.totalInitialDebit >= trialBalanceData.totalInitialCredit
      ? trialBalanceData.totalInitialDebit - trialBalanceData.totalInitialCredit
      : 0
  const netInitialCredit =
    trialBalanceData.totalInitialCredit > trialBalanceData.totalInitialDebit
      ? trialBalanceData.totalInitialCredit - trialBalanceData.totalInitialCredit
      : 0

  const netFinalDebit =
    trialBalanceData.totalFinalDebit >= trialBalanceData.totalFinalCredit
      ? trialBalanceData.totalFinalDebit - trialBalanceData.totalFinalCredit
      : 0
  const netFinalCredit =
    trialBalanceData.totalFinalCredit > trialBalanceData.totalFinalDebit
      ? trialBalanceData.totalFinalCredit - trialBalanceData.totalFinalDebit
      : 0

  // Gran total del libro auxiliar
  const auxTotalDebit = auxiliaryAccountsData.reduce((s, a) => s + a.totalDebit, 0)
  const auxTotalCredit = auxiliaryAccountsData.reduce((s, a) => s + a.totalCredit, 0)

  // Gran total de asientos
  const entriesTotalDebit = filteredEntriesList.reduce((s, e) => s + e.totalDebit, 0)
  const entriesTotalCredit = filteredEntriesList.reduce((s, e) => s + e.totalCredit, 0)

  // Gran total del libro diario
  const journalTotalDebit = journalRows.reduce((s, r) => s + r.debit, 0)
  const journalTotalCredit = journalRows.reduce((s, r) => s + r.credit, 0)

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
        {/* Barra Superior de Herramientas y Filtros (Oculta al Imprimir) */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold shadow-2xs">
              <AppIcon name={reportConfig.icon} size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-2">
            {/* Selector Rápido de Formato de Reporte */}
            <select
              value={activeReportType}
              onChange={(e) => setActiveReportType(e.target.value as AccountingExportType)}
              className="text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 shadow-2xs focus:ring-1 focus:ring-blue-900"
              aria-label="Seleccionar formato contable"
            >
              <option value="trial_balance">Balance de Comprobación</option>
              <option value="movements">Libro Auxiliar</option>
              <option value="entries">Comprobantes de Diario</option>
              <option value="journal">Libro Diario General</option>
              <option value="third_parties">Directorio de Terceros (DIAN)</option>
              <option value="accounts">Plan de Cuentas (PUC)</option>
              <option value="balance">Balance General</option>
            </select>

            <button
              type="button"
              className="outline-button compact text-xs flex items-center gap-1.5"
              onClick={handleExportExcel}
              title="Descargar datos en Excel (.xls)"
            >
              <AppIcon name="invoices" size={13} color="#059669" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              className="outline-button compact text-xs flex items-center gap-1.5"
              onClick={handleExportCSV}
              title="Descargar datos en CSV"
            >
              <AppIcon name="table" size={13} />
              <span>CSV</span>
            </button>

            <button
              type="button"
              className="primary-button compact text-xs flex items-center gap-1.5 font-bold"
              style={{ background: 'var(--navy)' }}
              onClick={handlePrint}
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

        {/* Panel de Filtros Interactivos (Oculto al Imprimir) */}
        <div className="px-5 py-2.5 border-b border-slate-200 bg-white grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 text-xs shrink-0 print:hidden">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              Desde:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs py-1 px-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-900"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              Hasta:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs py-1 px-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-900"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              Cuenta Inicial:
            </label>
            <input
              type="text"
              placeholder="Ej: 1105"
              value={startAccountCode}
              onChange={(e) => setStartAccountCode(e.target.value)}
              className="w-full text-xs py-1 px-2 font-mono border border-slate-300 rounded focus:ring-1 focus:ring-blue-900"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              Cuenta Final:
            </label>
            <input
              type="text"
              placeholder="Ej: 5999"
              value={endAccountCode}
              onChange={(e) => setEndAccountCode(e.target.value)}
              className="w-full text-xs py-1 px-2 font-mono border border-slate-300 rounded focus:ring-1 focus:ring-blue-900"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              Clase PUC:
            </label>
            <select
              value={mainAccountCode}
              onChange={(e) => setMainAccountCode(e.target.value)}
              className="w-full text-xs py-1 px-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-900"
            >
              <option value="ALL">Todas las Clases</option>
              {mainClasses.map((cls) => (
                <option key={cls.code} value={cls.code}>
                  Clase {cls.code} - {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end gap-1">
            <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] text-slate-600 select-none">
              <input
                type="checkbox"
                checked={includeThirdParties}
                onChange={(e) => setIncludeThirdParties(e.target.checked)}
                className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
              />
              <span>Terceros (NIT)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] text-slate-600 select-none">
              <input
                type="checkbox"
                checked={hideZeroBalances}
                onChange={(e) => setHideZeroBalances(e.target.checked)}
                className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
              />
              <span>Ocultar saldos $0</span>
            </label>
          </div>
        </div>

        {/* DOCUMENTO PDF IMPRIMIBLE (ÁREA OFICIAL DEL REPORTE) */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 bg-slate-100/60 print:bg-white print:p-0 print:overflow-visible">
          <div
            id="accounting-pdf-document"
            ref={reportRef}
            className="bg-white rounded-none border border-slate-300 p-6 sm:p-8 max-w-4xl mx-auto shadow-sm print:shadow-none print:border-none print:p-0 print:max-w-none text-black"
            style={{ width: '100%', boxSizing: 'border-box' }}
          >
            {/* MEMBRETE SUPERIOR INSTITUCIONAL */}
            <div className="pb-1 mb-2">
              <div className="flex justify-between items-start text-xs font-mono">
                <div>
                  <div className="font-bold text-sm tracking-wide text-black uppercase">
                    {trialBalanceData.companyName}
                  </div>
                  <div className="text-black font-semibold">
                    NIT: {trialBalanceData.companyNit} | Régimen Común IVA
                  </div>
                </div>
                <div className="text-right text-[11px] font-mono text-black">
                  <div>Página 1 de 1</div>
                  <div>Fecha: {trialBalanceData.generatedAt}</div>
                </div>
              </div>

              {/* TÍTULO PRINCIPAL DEL REPORTE */}
              <div className="text-center my-2">
                <h1 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-black m-0 font-mono">
                  {reportConfig.title}
                </h1>
                <div className="text-[11px] text-black font-mono mt-0.5">
                  Periodo: {formattedPeriod} | Expresado en Pesos Colombianos (COP)
                </div>
              </div>

              {/* RECUADRO DE FILTROS Y SUCURSAL CON LÍNEAS HORIZONTALES SÓLIDAS */}
              <div
                className="py-1.5 px-1 my-1 text-[11px] font-mono grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-black"
                style={{
                  borderTop: '1.5px solid #000000',
                  borderBottom: '1.5px solid #000000',
                }}
              >
                <div className="flex">
                  <span className="font-bold w-28 shrink-0">Sucursal:</span>
                  <span className="truncate">{branch}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-40 shrink-0">Área Administrativa:</span>
                  <span className="truncate">{administrativeArea}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-28 shrink-0">Periodo:</span>
                  <span>{formattedPeriod}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-40 shrink-0">Centro de Costos:</span>
                  <span>{costCenter}</span>
                </div>
                {(startAccountCode || endAccountCode || mainAccountCode !== 'ALL' || selectedThirdPartyId !== 'ALL') && (
                  <>
                    <div className="flex text-[10.5px]">
                      <span className="font-bold w-28 shrink-0">Rango Cuentas:</span>
                      <span>
                        {startAccountCode || 'Inicio'} a {endAccountCode || 'Fin'}
                        {mainAccountCode !== 'ALL' ? ` (Clase ${mainAccountCode})` : ''}
                      </span>
                    </div>
                    <div className="flex text-[10.5px]">
                      <span className="font-bold w-40 shrink-0">Tercero Específico:</span>
                      <span className="truncate">{resolvedThirdPartyName}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* =============================================================== */}
            {/* FORMATO 1: BALANCE DE COMPROBACIÓN */}
            {/* =============================================================== */}
            {activeReportType === 'trial_balance' && (
              <div className="my-2" style={{ width: '100%', overflow: 'hidden' }}>
                <table
                  className="w-full border-collapse font-mono text-[10.5px] leading-tight"
                  style={{ width: '100%', tableLayout: 'fixed' }}
                >
                  <thead>
                    <tr
                      className="font-bold uppercase text-black"
                      style={{
                        borderTop: '1.5px solid #000000',
                        borderBottom: '1.5px solid #000000',
                      }}
                    >
                      <th className="py-1 px-1 text-left" style={{ width: '14%' }}>
                        CUENTA
                      </th>
                      <th className="py-1 px-1 text-left" style={{ width: '36%' }}>
                        NOMBRE
                      </th>
                      <th className="py-1 px-1 text-right" style={{ width: '13%' }}>
                        SALDO ANTERIOR
                      </th>
                      <th className="py-1 px-1 text-right" style={{ width: '12%' }}>
                        DÉBITO
                      </th>
                      <th className="py-1 px-1 text-right" style={{ width: '12%' }}>
                        CRÉDITO
                      </th>
                      <th className="py-1 px-1 text-right" style={{ width: '13%' }}>
                        TOTAL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalanceData.rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                          No se encontraron cuentas o movimientos con los criterios y fechas especificadas.
                        </td>
                      </tr>
                    ) : (
                      trialBalanceData.rows.map((row) => {
                        const isClass = row.code.length === 1
                        const isGroup = row.code.length === 2
                        const isAccount = row.code.length === 4
                        const isSubaccount = row.code.length === 6

                        const rowFontWeight =
                          isClass || isGroup ? 'font-bold' : isAccount ? 'font-semibold' : 'font-normal'
                        const indentPx = isClass ? 0 : isGroup ? 6 : isAccount ? 12 : isSubaccount ? 18 : 24

                        return (
                          <React.Fragment key={row.code}>
                            <tr className={`text-black ${rowFontWeight} hover:bg-slate-50/50`}>
                              <td className="py-0.5 px-1 whitespace-nowrap overflow-hidden text-ellipsis">
                                {row.code}
                              </td>
                              <td className="py-0.5 px-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                <span style={{ paddingLeft: `${indentPx}px` }}>
                                  {isClass || isGroup || isAccount ? row.name.toUpperCase() : row.name}
                                </span>
                              </td>
                              <td className="py-0.5 px-1 text-right whitespace-nowrap">
                                {formatAccountingBalance(row.initialBalance, row.nature)}
                              </td>
                              <td className="py-0.5 px-1 text-right whitespace-nowrap">
                                {formatAccountingMovement(row.debit)}
                              </td>
                              <td className="py-0.5 px-1 text-right whitespace-nowrap">
                                {formatAccountingMovement(row.credit)}
                              </td>
                              <td className="py-0.5 px-1 text-right whitespace-nowrap">
                                {formatAccountingBalance(row.finalBalance, row.nature)}
                              </td>
                            </tr>

                            {includeThirdParties &&
                              row.thirdParties &&
                              row.thirdParties.map((tp, tpIdx) => (
                                <tr
                                  key={`${row.code}-tp-${tpIdx}`}
                                  className="text-slate-800 text-[10px] hover:bg-slate-50/40"
                                >
                                  <td className="py-0.5 px-1 text-slate-500 pl-4 whitespace-nowrap overflow-hidden text-ellipsis">
                                    {row.code}
                                  </td>
                                  <td className="py-0.5 px-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                    <span style={{ paddingLeft: '28px' }}>
                                      ↳ {tp.docNumber ? `${tp.docNumber} - ` : ''}{tp.name}
                                    </span>
                                  </td>
                                  <td className="py-0.5 px-1 text-right whitespace-nowrap text-slate-600">
                                    {formatAccountingBalance(tp.initialBalance, row.nature)}
                                  </td>
                                  <td className="py-0.5 px-1 text-right whitespace-nowrap text-slate-600">
                                    {formatAccountingMovement(tp.debit)}
                                  </td>
                                  <td className="py-0.5 px-1 text-right whitespace-nowrap text-slate-600">
                                    {formatAccountingMovement(tp.credit)}
                                  </td>
                                  <td className="py-0.5 px-1 text-right whitespace-nowrap font-medium text-slate-900">
                                    {formatAccountingBalance(tp.finalBalance, row.nature)}
                                  </td>
                                </tr>
                              ))}
                          </React.Fragment>
                        )
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr
                      className="font-bold text-black text-[10.5px]"
                      style={{
                        borderTop: '1.5px solid #000000',
                        borderBottom: '3px double #000000',
                      }}
                    >
                      <td className="py-2 px-1">TOTALES</td>
                      <td className="py-2 px-1">SUMAS IGUALES DEL BALANCE DE COMPROBACIÓN</td>
                      <td className="py-2 px-1 text-right whitespace-nowrap">
                        {formatAccountingBalance(
                          netInitialDebit || netInitialCredit,
                          netInitialDebit >= netInitialCredit ? 'DEBIT' : 'CREDIT'
                        )}
                      </td>
                      <td className="py-2 px-1 text-right whitespace-nowrap">
                        {formatAccountingMovement(trialBalanceData.totalDebit)}
                      </td>
                      <td className="py-2 px-1 text-right whitespace-nowrap">
                        {formatAccountingMovement(trialBalanceData.totalCredit)}
                      </td>
                      <td className="py-2 px-1 text-right whitespace-nowrap">
                        {formatAccountingBalance(
                          netFinalDebit || netFinalCredit,
                          netFinalDebit >= netFinalCredit ? 'DEBIT' : 'CREDIT'
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* =============================================================== */}
            {/* FORMATO 2: LIBRO AUXILIAR DE CUENTAS */}
            {/* =============================================================== */}
            {activeReportType === 'movements' && (
              <div className="my-2 space-y-4" style={{ width: '100%' }}>
                {auxiliaryAccountsData.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 font-mono text-xs">
                    No se encontraron movimientos contables en las cuentas o fechas seleccionadas.
                  </div>
                ) : (
                  auxiliaryAccountsData.map((item) => (
                    <div key={item.account.code} className="border-b border-slate-300 pb-3">
                      {/* Cabecera de Cuenta Auxiliar */}
                      <div className="bg-slate-100/90 py-1 px-2 font-mono text-xs font-bold flex justify-between items-center text-black border-t border-b border-black">
                        <div>
                          CUENTA: {item.account.code} - {item.account.name.toUpperCase()} (
                          {item.account.nature === 'DEBIT' ? 'DÉBITO' : 'CRÉDITO'})
                        </div>
                        <div>
                          SALDO INICIAL: {formatAccountingBalance(item.initialBalance, item.account.nature)}
                        </div>
                      </div>

                      {/* Tabla de Movimientos de la Cuenta */}
                      <table className="w-full border-collapse font-mono text-[10px] my-1" style={{ tableLayout: 'fixed' }}>
                        <thead>
                          <tr className="font-bold border-b border-black text-black">
                            <th className="py-1 text-left" style={{ width: '11%' }}>FECHA</th>
                            <th className="py-1 text-left" style={{ width: '14%' }}>COMPROBANTE</th>
                            <th className="py-1 text-left" style={{ width: '27%' }}>CONCEPTO / GLOSA</th>
                            <th className="py-1 text-left" style={{ width: '22%' }}>TERCERO</th>
                            <th className="py-1 text-right" style={{ width: '13%' }}>DÉBITO</th>
                            <th className="py-1 text-right" style={{ width: '13%' }}>CRÉDITO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.movements.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-2 text-center text-slate-500 italic">
                                Sin movimientos en el periodo seleccionado (Mantiene saldo inicial).
                              </td>
                            </tr>
                          ) : (
                            item.movements.map((m) => (
                              <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                <td className="py-0.5 whitespace-nowrap">{m.date.slice(0, 10)}</td>
                                <td className="py-0.5 whitespace-nowrap font-semibold">{m.voucherNumber}</td>
                                <td className="py-0.5 truncate">{m.description}</td>
                                <td className="py-0.5 truncate">
                                  {m.thirdPartyDoc ? `${m.thirdPartyDoc} - ` : ''}{m.thirdPartyName}
                                </td>
                                <td className="py-0.5 text-right whitespace-nowrap">
                                  {formatAccountingMovement(m.debit)}
                                </td>
                                <td className="py-0.5 text-right whitespace-nowrap">
                                  {formatAccountingMovement(m.credit)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold border-t border-black text-black text-[10.5px]">
                            <td colSpan={4} className="py-1 text-right pr-2">
                              TOTALES CUENTA {item.account.code} | SALDO FINAL:
                            </td>
                            <td className="py-1 text-right whitespace-nowrap">
                              {formatAccountingMovement(item.totalDebit)}
                            </td>
                            <td className="py-1 text-right whitespace-nowrap">
                              {formatAccountingMovement(item.totalCredit)}
                            </td>
                          </tr>
                          <tr className="font-bold text-black text-[10px]">
                            <td colSpan={6} className="py-0.5 text-right text-blue-950">
                              Saldo Final Acumulado: {formatAccountingBalance(item.finalBalance, item.account.nature)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))
                )}

                {/* Resumen Final de Todos los Auxiliares */}
                <div className="pt-2">
                  <div
                    className="p-2 font-mono text-xs font-bold flex justify-between items-center text-black"
                    style={{ borderTop: '2px solid #000', borderBottom: '3px double #000' }}
                  >
                    <span>GRAN TOTAL LIBRO AUXILIAR:</span>
                    <div className="space-x-6">
                      <span>DÉBITOS: {formatAccountingMovement(auxTotalDebit)}</span>
                      <span>CRÉDITOS: {formatAccountingMovement(auxTotalCredit)}</span>
                      <span className="text-blue-900">
                        {auxTotalDebit === auxTotalCredit ? 'SUMAS IGUALES' : 'DIFERENCIA'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* FORMATO 3: COMPROBANTES DE DIARIO / ASIENTOS CONTABLES */}
            {/* =============================================================== */}
            {activeReportType === 'entries' && (
              <div className="my-2 space-y-4" style={{ width: '100%' }}>
                {filteredEntriesList.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 font-mono text-xs">
                    No se encontraron comprobantes de diario en el rango de fechas seleccionado.
                  </div>
                ) : (
                  filteredEntriesList.map((entry) => (
                    <div key={entry.id} className="border border-slate-300 rounded-none p-2 mb-3 bg-white">
                      {/* Cabecera del Comprobante */}
                      <div className="border-b border-black pb-1 mb-1.5 flex justify-between items-start font-mono text-xs">
                        <div>
                          <strong className="text-black text-sm">{entry.entryNumber}</strong>{' '}
                          <span className="text-slate-600">({entry.sourceType || 'COMPROBANTE DIARIO'})</span>
                          <div className="text-[11px] text-slate-800 font-sans mt-0.5">
                            <strong>Concepto:</strong> {entry.description}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold">Fecha:</span> {entry.date.slice(0, 10)}
                          <div>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 border border-slate-300">
                              {entry.status === 'POSTED' ? 'ASENTADO' : 'BORRADOR'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tabla de Líneas del Asiento */}
                      <table className="w-full border-collapse font-mono text-[10px]" style={{ tableLayout: 'fixed' }}>
                        <thead>
                          <tr className="font-bold border-b border-black text-black">
                            <th className="py-0.5 text-left" style={{ width: '15%' }}>CÓDIGO PUC</th>
                            <th className="py-0.5 text-left" style={{ width: '35%' }}>CUENTA CONTABLE</th>
                            <th className="py-0.5 text-left" style={{ width: '24%' }}>TERCERO</th>
                            <th className="py-0.5 text-right" style={{ width: '13%' }}>DÉBITO</th>
                            <th className="py-0.5 text-right" style={{ width: '13%' }}>CRÉDITO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.lines.map((l, lIdx) => (
                            <tr key={lIdx} className="border-b border-slate-100">
                              <td className="py-0.5 whitespace-nowrap font-semibold">{l.accountCode}</td>
                              <td className="py-0.5 truncate">{l.accountName}</td>
                              <td className="py-0.5 truncate">{entry.thirdPartyName || '—'}</td>
                              <td className="py-0.5 text-right whitespace-nowrap">
                                {formatAccountingMovement(l.debit)}
                              </td>
                              <td className="py-0.5 text-right whitespace-nowrap">
                                {formatAccountingMovement(l.credit)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold border-t border-black text-black text-[10.5px]">
                            <td colSpan={3} className="py-1 text-right pr-2">
                              TOTAL COMPROBANTE (SUMAS IGUALES):
                            </td>
                            <td className="py-1 text-right whitespace-nowrap">
                              {formatAccountingMovement(entry.totalDebit)}
                            </td>
                            <td className="py-1 text-right whitespace-nowrap">
                              {formatAccountingMovement(entry.totalCredit)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))
                )}

                {/* Gran Total Asientos */}
                <div
                  className="p-2 font-mono text-xs font-bold flex justify-between items-center text-black"
                  style={{ borderTop: '2px solid #000', borderBottom: '3px double #000' }}
                >
                  <span>TOTAL COMPROBANTES ({filteredEntriesList.length}):</span>
                  <div className="space-x-6">
                    <span>DÉBITO: {formatAccountingMovement(entriesTotalDebit)}</span>
                    <span>CRÉDITO: {formatAccountingMovement(entriesTotalCredit)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* FORMATO 4: LIBRO DIARIO GENERAL */}
            {/* =============================================================== */}
            {activeReportType === 'journal' && (
              <div className="my-2" style={{ width: '100%', overflow: 'hidden' }}>
                <table
                  className="w-full border-collapse font-mono text-[10px] leading-tight"
                  style={{ width: '100%', tableLayout: 'fixed' }}
                >
                  <thead>
                    <tr
                      className="font-bold uppercase text-black"
                      style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000' }}
                    >
                      <th className="py-1 text-left" style={{ width: '10%' }}>FECHA</th>
                      <th className="py-1 text-left" style={{ width: '13%' }}>COMPROBANTE</th>
                      <th className="py-1 text-left" style={{ width: '13%' }}>CUENTA</th>
                      <th className="py-1 text-left" style={{ width: '24%' }}>NOMBRE DE CUENTA</th>
                      <th className="py-1 text-left" style={{ width: '18%' }}>TERCERO / DETALLE</th>
                      <th className="py-1 text-right" style={{ width: '11%' }}>DÉBITO</th>
                      <th className="py-1 text-right" style={{ width: '11%' }}>CRÉDITO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                          No se registraron movimientos en el libro diario para este periodo.
                        </td>
                      </tr>
                    ) : (
                      journalRows.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-0.5 whitespace-nowrap">{row.date.slice(0, 10)}</td>
                          <td className="py-0.5 whitespace-nowrap font-semibold">{row.voucherNumber}</td>
                          <td className="py-0.5 whitespace-nowrap font-mono">{row.accountCode}</td>
                          <td className="py-0.5 truncate">{row.accountName}</td>
                          <td className="py-0.5 truncate" title={row.description}>
                            {row.thirdPartyName !== '—' ? `${row.thirdPartyName}: ` : ''}{row.description}
                          </td>
                          <td className="py-0.5 text-right whitespace-nowrap">
                            {formatAccountingMovement(row.debit)}
                          </td>
                          <td className="py-0.5 text-right whitespace-nowrap">
                            {formatAccountingMovement(row.credit)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr
                      className="font-bold text-black text-[10.5px]"
                      style={{ borderTop: '1.5px solid #000', borderBottom: '3px double #000' }}
                    >
                      <td colSpan={5} className="py-1.5 text-right pr-2">
                        TOTALES GENERALES LIBRO DIARIO:
                      </td>
                      <td className="py-1.5 text-right whitespace-nowrap">
                        {formatAccountingMovement(journalTotalDebit)}
                      </td>
                      <td className="py-1.5 text-right whitespace-nowrap">
                        {formatAccountingMovement(journalTotalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* =============================================================== */}
            {/* FORMATO 5: DIRECTORIO DE TERCEROS (DIAN) */}
            {/* =============================================================== */}
            {activeReportType === 'third_parties' && (
              <div className="my-2" style={{ width: '100%', overflow: 'hidden' }}>
                <table
                  className="w-full border-collapse font-mono text-[10px] leading-tight"
                  style={{ width: '100%', tableLayout: 'fixed' }}
                >
                  <thead>
                    <tr
                      className="font-bold uppercase text-black"
                      style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000' }}
                    >
                      <th className="py-1 text-left" style={{ width: '8%' }}>TIPO</th>
                      <th className="py-1 text-left" style={{ width: '15%' }}>DOCUMENTO / NIT</th>
                      <th className="py-1 text-left" style={{ width: '28%' }}>RAZÓN SOCIAL / NOMBRE</th>
                      <th className="py-1 text-left" style={{ width: '17%' }}>NOMBRE COMERCIAL</th>
                      <th className="py-1 text-left" style={{ width: '12%' }}>ROL / CALIDAD</th>
                      <th className="py-1 text-left" style={{ width: '20%' }}>CONTACTO / CIUDAD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredThirdPartiesList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                          No se encontraron terceros registrados con los criterios seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredThirdPartiesList.map((tp) => (
                        <tr key={tp.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-0.5 whitespace-nowrap">{tp.documentType || 'NIT'}</td>
                          <td className="py-0.5 whitespace-nowrap font-bold">
                            {tp.documentNumber}
                            {tp.verificationDigit ? `-${tp.verificationDigit}` : ''}
                          </td>
                          <td className="py-0.5 truncate font-semibold">{tp.companyName}</td>
                          <td className="py-0.5 truncate text-slate-600">{tp.commercialName || '—'}</td>
                          <td className="py-0.5 whitespace-nowrap">
                            <span className="px-1 py-0.2 bg-slate-100 text-slate-800 border border-slate-300 text-[9px]">
                              {tp.thirdPartyType}
                            </span>
                          </td>
                          <td className="py-0.5 truncate text-slate-700">
                            {tp.city || 'Medellín'} {tp.phone ? `| Tel: ${tp.phone}` : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr
                      className="font-bold text-black text-[10.5px]"
                      style={{ borderTop: '1.5px solid #000', borderBottom: '3px double #000' }}
                    >
                      <td colSpan={3} className="py-1.5">
                        TOTAL TERCEROS CERTIFICADOS: {filteredThirdPartiesList.length}
                      </td>
                      <td colSpan={3} className="py-1.5 text-right">
                        REGISTRO FISCAL OFICIAL DIAN
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* =============================================================== */}
            {/* FORMATO 6: PLAN DE CUENTAS (PUC MAESTRO) */}
            {/* =============================================================== */}
            {activeReportType === 'accounts' && (
              <div className="my-2" style={{ width: '100%', overflow: 'hidden' }}>
                <table
                  className="w-full border-collapse font-mono text-[10px] leading-tight"
                  style={{ width: '100%', tableLayout: 'fixed' }}
                >
                  <thead>
                    <tr
                      className="font-bold uppercase text-black"
                      style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000' }}
                    >
                      <th className="py-1 text-left" style={{ width: '16%' }}>CÓDIGO PUC</th>
                      <th className="py-1 text-left" style={{ width: '42%' }}>DESCRIPCIÓN DE LA CUENTA</th>
                      <th className="py-1 text-left" style={{ width: '14%' }}>NIVEL</th>
                      <th className="py-1 text-left" style={{ width: '14%' }}>NATURALEZA</th>
                      <th className="py-1 text-left" style={{ width: '14%' }}>TIPO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccountsList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 font-medium">
                          No se encontraron cuentas contables según los criterios especificados.
                        </td>
                      </tr>
                    ) : (
                      filteredAccountsList.map((acc) => {
                        const isMajor = acc.code.length <= 4
                        const indent =
                          acc.code.length === 1 ? 0 : acc.code.length === 2 ? 6 : acc.code.length === 4 ? 12 : 18
                        return (
                          <tr
                            key={acc.id}
                            className={`border-b border-slate-100 ${
                              isMajor ? 'font-bold text-black' : 'text-slate-800'
                            }`}
                          >
                            <td className="py-0.5 whitespace-nowrap">{acc.code}</td>
                            <td className="py-0.5 truncate">
                              <span style={{ paddingLeft: `${indent}px` }}>{acc.name}</span>
                            </td>
                            <td className="py-0.5 whitespace-nowrap text-slate-600">{acc.level}</td>
                            <td className="py-0.5 whitespace-nowrap font-semibold">
                              {acc.nature === 'DEBIT' ? 'DÉBITO' : 'CRÉDITO'}
                            </td>
                            <td className="py-0.5 whitespace-nowrap text-slate-600">{acc.type}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr
                      className="font-bold text-black text-[10.5px]"
                      style={{ borderTop: '1.5px solid #000', borderBottom: '3px double #000' }}
                    >
                      <td colSpan={3} className="py-1.5">
                        TOTAL CUENTAS CATALOGADAS: {filteredAccountsList.length}
                      </td>
                      <td colSpan={2} className="py-1.5 text-right">
                        PLAN ÚNICO DE CUENTAS VIGENTE
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* =============================================================== */}
            {/* FORMATO 7: BALANCE GENERAL (SITUACIÓN FINANCIERA) */}
            {/* =============================================================== */}
            {activeReportType === 'balance' && (
              <div className="my-2 space-y-3 font-mono text-[11px]" style={{ width: '100%' }}>
                {/* 1. ACTIVOS */}
                <div className="border border-black">
                  <div className="bg-black text-white px-2 py-1 font-bold text-xs uppercase flex justify-between">
                    <span>1. ACTIVO</span>
                    <span>{formatCurrency(balanceSheetStructure.activo.total)}</span>
                  </div>
                  <div className="p-2 space-y-2">
                    <div>
                      <div className="font-bold text-black border-b border-slate-300 pb-0.5 flex justify-between">
                        <span>ACTIVO CORRIENTE</span>
                        <span>{formatCurrency(balanceSheetStructure.activo.corriente.total)}</span>
                      </div>
                      <div className="pl-4 py-1 space-y-0.5 text-slate-800">
                        <div className="flex justify-between">
                          <span>11 - Efectivo y Equivalentes de Efectivo:</span>
                          <span>{formatCurrency(balanceSheetStructure.activo.corriente.efectivo)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>13 - Deudores Comerciales y Cuentas por Cobrar:</span>
                          <span>{formatCurrency(balanceSheetStructure.activo.corriente.deudores)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>14 - Inventarios y Mercancías en Existencia:</span>
                          <span>{formatCurrency(balanceSheetStructure.activo.corriente.inventarios)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-black border-b border-slate-300 pb-0.5 flex justify-between">
                        <span>ACTIVO NO CORRIENTE</span>
                        <span>{formatCurrency(balanceSheetStructure.activo.noCorriente.total)}</span>
                      </div>
                      <div className="pl-4 py-1 space-y-0.5 text-slate-800">
                        <div className="flex justify-between">
                          <span>15 - Propiedades, Planta y Equipo:</span>
                          <span>{formatCurrency(balanceSheetStructure.activo.noCorriente.propiedadPlantaEquipo)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>17/18/19 - Otros Activos e Intangibles:</span>
                          <span>{formatCurrency(balanceSheetStructure.activo.noCorriente.otrosActivos)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. PASIVOS */}
                <div className="border border-black">
                  <div className="bg-black text-white px-2 py-1 font-bold text-xs uppercase flex justify-between">
                    <span>2. PASIVO</span>
                    <span>{formatCurrency(balanceSheetStructure.pasivo.total)}</span>
                  </div>
                  <div className="p-2 space-y-2">
                    <div>
                      <div className="font-bold text-black border-b border-slate-300 pb-0.5 flex justify-between">
                        <span>PASIVO CORRIENTE</span>
                        <span>{formatCurrency(balanceSheetStructure.pasivo.corriente.total)}</span>
                      </div>
                      <div className="pl-4 py-1 space-y-0.5 text-slate-800">
                        <div className="flex justify-between">
                          <span>22 - Proveedores Nacionales:</span>
                          <span>{formatCurrency(balanceSheetStructure.pasivo.corriente.proveedores)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>23 - Cuentas Comerciales por Pagar:</span>
                          <span>{formatCurrency(balanceSheetStructure.pasivo.corriente.cuentasPorPagar)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>24 - Impuestos, Gravámenes y Tasas:</span>
                          <span>{formatCurrency(balanceSheetStructure.pasivo.corriente.impuestosPorPagar)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>25 - Obligaciones Laborales y Nómina:</span>
                          <span>{formatCurrency(balanceSheetStructure.pasivo.corriente.obligacionesLaborales)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-black border-b border-slate-300 pb-0.5 flex justify-between">
                        <span>PASIVO NO CORRIENTE</span>
                        <span>{formatCurrency(balanceSheetStructure.pasivo.noCorriente.total)}</span>
                      </div>
                      <div className="pl-4 py-1 space-y-0.5 text-slate-800">
                        <div className="flex justify-between">
                          <span>21 - Obligaciones Financieras a Largo Plazo:</span>
                          <span>{formatCurrency(balanceSheetStructure.pasivo.noCorriente.obligacionesFinancieras)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. PATRIMONIO */}
                <div className="border border-black">
                  <div className="bg-black text-white px-2 py-1 font-bold text-xs uppercase flex justify-between">
                    <span>3. PATRIMONIO</span>
                    <span>{formatCurrency(balanceSheetStructure.patrimonio.total)}</span>
                  </div>
                  <div className="p-2 space-y-1 pl-4 text-slate-800">
                    <div className="flex justify-between">
                      <span>31 - Capital Social:</span>
                      <span>{formatCurrency(balanceSheetStructure.patrimonio.capitalSocial)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>33 - Reservas Estatutarias:</span>
                      <span>{formatCurrency(balanceSheetStructure.patrimonio.reservas)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>37 - Resultados de Ejercicios Anteriores:</span>
                      <span>{formatCurrency(balanceSheetStructure.patrimonio.resultadosAcumulados)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-black">
                      <span>36 - Utilidad / Resultado del Ejercicio:</span>
                      <span>{formatCurrency(balanceSheetStructure.patrimonio.resultadoEjercicio)}</span>
                    </div>
                  </div>
                </div>

                {/* VERIFICACIÓN FORMAL DE LA ECUACIÓN PATRIMONIAL */}
                <div
                  className="p-2 font-mono text-xs font-bold bg-slate-50 flex justify-between items-center text-black"
                  style={{ borderTop: '2px solid #000', borderBottom: '3px double #000' }}
                >
                  <div>
                    ECUACIÓN PATRIMONIAL: ACTIVO = PASIVO + PATRIMONIO
                    <div className="text-[10px] text-slate-600 font-normal">
                      {formatCurrency(balanceSheetStructure.activo.total)} ={' '}
                      {formatCurrency(balanceSheetStructure.pasivo.total)} +{' '}
                      {formatCurrency(balanceSheetStructure.patrimonio.total)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-blue-900 font-extrabold">
                      {Math.abs(balanceSheetStructure.ecuacionDiferencia) < 0.01
                        ? 'BALANCEADO (Diferencia: $0.00 COP)'
                        : `DIFERENCIA: ${formatCurrency(balanceSheetStructure.ecuacionDiferencia)}`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN DE FIRMAS LEGALES Y CONTABLES */}
            <div className="mt-8 pt-4 page-break-inside-avoid">
              <div className="grid grid-cols-3 gap-6 text-center text-xs font-mono">
                <div>
                  <div className="w-40 border-b border-black mx-auto mb-1.5 mt-8"></div>
                  <strong className="block text-[11px] uppercase text-black">REPRESENTANTE LEGAL</strong>
                  <span className="text-[10px] text-slate-600 block">C.C. ___________________</span>
                  <span className="text-[9.5px] text-slate-500 block">Distribuidora Super Más S.A.S.</span>
                </div>

                <div>
                  <div className="w-40 border-b border-black mx-auto mb-1.5 mt-8"></div>
                  <strong className="block text-[11px] uppercase text-black">CONTADOR PÚBLICO</strong>
                  <span className="text-[10px] text-slate-600 block">T.P. No. ________________-T</span>
                  <span className="text-[9.5px] text-slate-500 block">Responsable de Certificación</span>
                </div>

                <div>
                  <div className="w-40 border-b border-black mx-auto mb-1.5 mt-8"></div>
                  <strong className="block text-[11px] uppercase text-black">REVISOR FISCAL</strong>
                  <span className="text-[10px] text-slate-600 block">T.P. No. ________________-T</span>
                  <span className="text-[9.5px] text-slate-500 block">Dictamen Fiduciario</span>
                </div>
              </div>
            </div>

            {/* PIE DE PÁGINA OBLIGATORIO SEGÚN REGLAS 29-32 */}
            <div className="mt-8 pt-3 border-t border-slate-300 text-center text-[10px] text-slate-600 flex flex-wrap items-center justify-between gap-2 font-sans">
              <span>Documento contable oficial expedido el {trialBalanceData.generatedAt}.</span>
              <span>
                © {new Date().getFullYear()} Super Más S.A.S. Todos los derechos reservados.
              </span>
              <a
                href="https://www.kytcode.lat"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-black hover:text-blue-900 inline-flex items-center gap-1 transition-colors"
                style={{ textDecoration: 'none' }}
              >
                <span>Desarrollado por K&T</span>
                <Heart className="w-3 h-3 fill-black text-black inline-block" />
              </a>
            </div>
          </div>
        </div>

        {/* Pie del Modal con Acciones Rápidas (Oculto al Imprimir) */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 print:hidden">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Formato oficial fiduciario optimizado para impresión en hoja Carta / A4 sin cortes horizontales.
          </span>
          <div className="flex items-center gap-3 ml-auto">
            <button type="button" className="outline-button compact text-xs" onClick={onClose}>
              Cerrar
            </button>
            <button
              type="button"
              className="primary-button compact text-xs flex items-center gap-2 font-bold"
              style={{ background: 'var(--navy)' }}
              onClick={handlePrint}
            >
              <AppIcon name="printer" size={14} />
              <span>Imprimir / Guardar en PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
