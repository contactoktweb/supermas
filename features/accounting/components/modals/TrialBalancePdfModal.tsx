'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Heart } from 'lucide-react'
import {
  AccountingAccount,
  AccountingMovement,
  ThirdParty,
  TrialBalanceLevelFilter,
  TrialBalanceReportData,
} from '../../types'
import { accountingExportService } from '../../services/accounting-export.service'

interface TrialBalancePdfModalProps {
  isOpen: boolean
  onClose: () => void
  accounts: AccountingAccount[]
  movements: AccountingMovement[]
  thirdParties: ThirdParty[]
  initialMainAccountCode?: string
  initialStartAccountCode?: string
  initialEndAccountCode?: string
  initialBranch?: string
  initialCostCenter?: string
  initialAdministrativeArea?: string
  initialVoucherType?: string
  initialSelectedThirdPartyId?: string
  initialMaxLevel?: TrialBalanceLevelFilter
  initialIncludeThirdParties?: boolean
  initialStartDate?: string
  initialEndDate?: string
}

/**
 * Formatea un valor según el estándar contable colombiano (TNS SAS):
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

export function TrialBalancePdfModal({
  isOpen,
  onClose,
  accounts,
  movements,
  thirdParties,
  initialMainAccountCode = 'ALL',
  initialStartAccountCode = '',
  initialEndAccountCode = '',
  initialBranch = '01 - SUPER MÁS PRINCIPAL',
  initialCostCenter = 'TODOS',
  initialAdministrativeArea = 'TODAS',
  initialVoucherType = 'TODOS',
  initialSelectedThirdPartyId = 'ALL',
  initialMaxLevel = 'SUBACCOUNT',
  initialIncludeThirdParties = true,
  initialStartDate,
  initialEndDate,
}: TrialBalancePdfModalProps) {
  const [mounted, setMounted] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

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
  const [hideZeroBalances, setHideZeroBalances] = useState<boolean>(true)

  // Fechas del balance
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

  // Sincronizar props cuando se abre
  useEffect(() => {
    if (isOpen) {
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
      if (initialStartDate) setStartDate(initialStartDate)
      if (initialEndDate) setEndDate(initialEndDate)
    }
  }, [
    isOpen,
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
    initialStartDate,
    initialEndDate,
  ])

  // Cuentas disponibles para el selector de Cuenta Principal PUC
  const mainAccountOptions = useMemo(() => {
    const mains = accounts.filter((a) => a.code.length <= 4)
    mains.sort((a, b) => a.code.localeCompare(b.code))
    return mains
  }, [accounts])

  // Cálculo en vivo del reporte oficial de Balance de Comprobación
  const reportData: TrialBalanceReportData = useMemo(() => {
    return accountingExportService.buildTrialBalanceData({
      accounts,
      movements,
      thirdParties,
      options: {
        startDate,
        endDate,
        mainAccountCode,
        startAccountCode,
        endAccountCode,
        branch,
        costCenter,
        administrativeArea,
        voucherType,
        selectedThirdPartyId,
        maxLevel,
        includeThirdParties,
        hideZeroBalances,
      },
    })
  }, [
    accounts,
    movements,
    thirdParties,
    startDate,
    endDate,
    mainAccountCode,
    startAccountCode,
    endAccountCode,
    branch,
    costCenter,
    administrativeArea,
    voucherType,
    selectedThirdPartyId,
    maxLevel,
    includeThirdParties,
    hideZeroBalances,
  ])

  // Cálculo neto de sumas para saldo anterior y total
  const netInitialDebit = useMemo(() => {
    return Math.max(0, reportData.totalInitialDebit - reportData.totalInitialCredit)
  }, [reportData.totalInitialDebit, reportData.totalInitialCredit])

  const netInitialCredit = useMemo(() => {
    return Math.max(0, reportData.totalInitialCredit - reportData.totalInitialDebit)
  }, [reportData.totalInitialDebit, reportData.totalInitialCredit])

  const netFinalDebit = useMemo(() => {
    return Math.max(0, reportData.totalFinalDebit - reportData.totalFinalCredit)
  }, [reportData.totalFinalDebit, reportData.totalFinalCredit])

  const netFinalCredit = useMemo(() => {
    return Math.max(0, reportData.totalFinalCredit - reportData.totalFinalDebit)
  }, [reportData.totalFinalDebit, reportData.totalFinalCredit])

  // Formato de periodo legible (ej: 01/01/2026 - 17/10/2026)
  const formattedPeriod = useMemo(() => {
    const formatDate = (d: string) => {
      const parts = d.split('-')
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
      return d
    }
    return `${formatDate(startDate)} - ${formatDate(endDate)}`
  }, [startDate, endDate])

  // Función de impresión / generación PDF nativa y limpia
  const handlePrint = () => {
    if (typeof window === 'undefined') return

    const printElement = document.getElementById('trial-balance-pdf-document')
    if (!printElement) {
      window.print()
      return
    }

    // Creación de ventana de impresión aislada para asegurar ajuste 100% perfecto
    // sin cortes por modales ni scrollbars
    const printWindow = window.open('', '_blank', 'width=1024,height=800')
    if (!printWindow) {
      window.print()
      return
    }

    const currentYearDynamic = new Date().getFullYear()

    printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Balance de Comprobación - ${reportData.companyName}</title>
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
      font-size: 11px;
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
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 6px 0;
    }
    .meta-box {
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      padding: 4px 2px;
      margin: 4px 0 8px 0;
      font-family: monospace;
      font-size: 10.5px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      row-gap: 3px;
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
      font-size: 10px;
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
      font-size: 10.5px;
    }
    .totals-row td {
      padding: 4px 2px;
    }
    .signatures {
      margin-top: 28px;
      padding-top: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      column-gap: 24px;
      text-align: center;
      font-family: monospace;
      font-size: 10px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-line {
      width: 160px;
      border-bottom: 1px solid #000;
      margin: 20px auto 4px auto;
    }
    .footer-bar {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #ccc;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: sans-serif;
      font-size: 9.5px;
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

  // Descarga alternativa en Excel
  const handleExportExcel = () => {
    accountingExportService.exportTrialBalanceExcel(reportData)
  }

  // Descarga alternativa en CSV
  const handleExportCSV = () => {
    accountingExportService.exportTrialBalanceCSV(reportData)
  }

  if (!isOpen || !mounted) return null

  return createPortal(
    <div
      className="drawer-backdrop modal-center p-2 sm:p-4 z-50 print:p-0 print:bg-white"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-balance-pdf-title"
    >
      <div
        className="modal-card animate-scale-up print:shadow-none print:border-none print:w-full print:max-w-none print:h-auto"
        style={{
          width: '100%',
          maxWidth: 1080,
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
              <AppIcon name="receipt" size={16} />
            </div>
            <div>
              <h2 id="trial-balance-pdf-title" className="text-sm font-bold text-slate-900 m-0">
                Balance de Comprobación (Libro Oficial)
              </h2>
              <span className="text-[11px] text-slate-500">
                Formato formal de informe contable fiduciario (TNS SAS)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="outline-button text-xs py-1 px-2.5 flex items-center gap-1.5 shadow-2xs"
              title="Descargar datos en CSV compatible con Excel"
            >
              <AppIcon name="download" size={13} />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="outline-button text-xs py-1 px-2.5 flex items-center gap-1.5 shadow-2xs text-emerald-800 hover:border-emerald-500 hover:bg-emerald-50"
              title="Descargar en Excel nativo (.xls)"
            >
              <AppIcon name="invoices" size={13} />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="primary-button text-xs py-1 px-3 flex items-center gap-1.5 shadow-sm font-bold"
              style={{ background: 'var(--navy)' }}
              title="Imprimir o Guardar como PDF oficial ajustado al 100%"
            >
              <AppIcon name="printer" size={14} />
              <span>Imprimir / Guardar PDF</span>
            </button>

            <button
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
              onClick={onClose}
              aria-label="Cerrar reporte"
            >
              <AppIcon name="close" size={18} />
            </button>
          </div>
        </div>

        {/* Panel de Parámetros Contables del Reporte (Inspirado en el estándar TNS) */}
        <div className="px-5 py-2.5 border-b border-slate-200 bg-white grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs shrink-0 print:hidden">
          {/* Cuenta Principal PUC */}
          <div>
            <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
              Clase PUC:
            </label>
            <select
              className="w-full h-7.5 px-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

          {/* Rango Cuentas Inicial - Final */}
          <div>
            <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
              Cuenta Inicial:
            </label>
            <input
              type="text"
              placeholder="Ej: 1105"
              className="w-full h-7.5 px-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={startAccountCode}
              onChange={(e) => setStartAccountCode(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
              Cuenta Final:
            </label>
            <input
              type="text"
              placeholder="Ej: 1305"
              className="w-full h-7.5 px-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={endAccountCode}
              onChange={(e) => setEndAccountCode(e.target.value)}
            />
          </div>

          {/* Fechas */}
          <div>
            <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
              Fecha Inicial:
            </label>
            <input
              type="date"
              className="w-full h-7.5 px-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
              Fecha Final:
            </label>
            <input
              type="date"
              className="w-full h-7.5 px-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Opciones Rápidas */}
          <div className="flex flex-col justify-center gap-1">
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-800 select-none">
              <input
                type="checkbox"
                checked={includeThirdParties}
                onChange={(e) => setIncludeThirdParties(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-900">Incluir Terceros</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] text-slate-600 select-none">
              <input
                type="checkbox"
                checked={hideZeroBalances}
                onChange={(e) => setHideZeroBalances(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Ocultar saldos $0</span>
            </label>
          </div>
        </div>

        {/* DOCUMENTO PDF IMPRIMIBLE (ÁREA OFICIAL DEL REPORTE TNS SAS) */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 bg-slate-100/60 print:bg-white print:p-0 print:overflow-visible">
          <div
            id="trial-balance-pdf-document"
            ref={reportRef}
            className="bg-white rounded-none border border-slate-300 p-6 sm:p-8 max-w-4xl mx-auto shadow-sm print:shadow-none print:border-none print:p-0 print:max-w-none text-black"
            style={{ width: '100%', boxSizing: 'border-box' }}
          >
            {/* MEMBRETE SUPERIOR INSTITUCIONAL (Idéntico a TNS SAS) */}
            <div className="pb-1 mb-2">
              <div className="flex justify-between items-start text-xs font-mono">
                <div>
                  <div className="font-bold text-sm tracking-wide text-black uppercase">
                    {reportData.companyName}
                  </div>
                  <div className="text-black font-semibold">
                    NIT: {reportData.companyNit}
                  </div>
                </div>
                <div className="text-right text-[11px] font-mono text-black">
                  <div>1 de 1 paginas</div>
                  <div>Fecha: {reportData.generatedAt}</div>
                </div>
              </div>

              {/* TÍTULO PRINCIPAL DEL BALANCE */}
              <div className="text-center my-2">
                <h1 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-black m-0 font-mono">
                  BALANCE DE COMPROBACION
                </h1>
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
                  <span className="font-bold w-40 shrink-0">Area Administrativa:</span>
                  <span className="truncate">{administrativeArea}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-28 shrink-0">Periodo:</span>
                  <span>{formattedPeriod}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-40 shrink-0">Centro Costo:</span>
                  <span>{costCenter}</span>
                </div>
                {(startAccountCode || endAccountCode || mainAccountCode !== 'ALL' || includeThirdParties) && (
                  <>
                    <div className="flex text-[10.5px]">
                      <span className="font-bold w-28 shrink-0">Rango Cuentas:</span>
                      <span>
                        {startAccountCode || 'Inicio'} a {endAccountCode || 'Fin'}
                        {mainAccountCode !== 'ALL' ? ` (Clase ${mainAccountCode})` : ''}
                      </span>
                    </div>
                    <div className="flex text-[10.5px]">
                      <span className="font-bold w-40 shrink-0">Desglose Terceros:</span>
                      <span>{includeThirdParties ? 'SÍ (Discriminado por NIT)' : 'NO (Consolidado)'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* TABLA PRINCIPAL DE SUMAS Y SALDOS (6 Columnas exactas, 100% responsive sin cortes) */}
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
                      DEBITO
                    </th>
                    <th className="py-1 px-1 text-right" style={{ width: '12%' }}>
                      CREDITO
                    </th>
                    <th className="py-1 px-1 text-right" style={{ width: '13%' }}>
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                        No se encontraron cuentas o movimientos con los criterios y fechas especificadas.
                      </td>
                    </tr>
                  ) : (
                    reportData.rows.map((row) => {
                      const isClass = row.code.length === 1
                      const isGroup = row.code.length === 2
                      const isAccount = row.code.length === 4
                      const isSubaccount = row.code.length === 6

                      const rowFontWeight = isClass || isGroup ? 'font-bold' : isAccount ? 'font-semibold' : 'font-normal'
                      const indentPx = isClass ? 0 : isGroup ? 6 : isAccount ? 12 : isSubaccount ? 18 : 24

                      return (
                        <React.Fragment key={row.code}>
                          <tr className={`text-black ${rowFontWeight} hover:bg-slate-50/50`}>
                            {/* 1. Código PUC */}
                            <td className="py-0.5 px-1 whitespace-nowrap overflow-hidden text-ellipsis">
                              {row.code}
                            </td>

                            {/* 2. Nombre con sangría jerárquica */}
                            <td className="py-0.5 px-1 overflow-hidden text-ellipsis whitespace-nowrap">
                              <span style={{ paddingLeft: `${indentPx}px` }}>
                                {isClass || isGroup || isAccount ? row.name.toUpperCase() : row.name}
                              </span>
                            </td>

                            {/* 3. Saldo Anterior con D o C */}
                            <td className="py-0.5 px-1 text-right whitespace-nowrap">
                              {formatAccountingBalance(row.initialBalance, row.nature)}
                            </td>

                            {/* 4. Débito Periodo */}
                            <td className="py-0.5 px-1 text-right whitespace-nowrap">
                              {formatAccountingMovement(row.debit)}
                            </td>

                            {/* 5. Crédito Periodo */}
                            <td className="py-0.5 px-1 text-right whitespace-nowrap">
                              {formatAccountingMovement(row.credit)}
                            </td>

                            {/* 6. Total (Saldo Final con D o C) */}
                            <td className="py-0.5 px-1 text-right whitespace-nowrap">
                              {formatAccountingBalance(row.finalBalance, row.nature)}
                            </td>
                          </tr>

                          {/* Filas Hijas de Terceros (Si está activado) */}
                          {reportData.includeThirdParties &&
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

                {/* FILA DE TOTALES Y SUMAS IGUALES CON DOBLE LÍNEA */}
                <tfoot>
                  <tr
                    className="font-bold text-black text-[10.5px]"
                    style={{
                      borderTop: '1.5px solid #000000',
                      borderBottom: '3px double #000000',
                    }}
                  >
                    <td className="py-2 px-1">TOTALES</td>
                    <td className="py-2 px-1">
                      SUMAS IGUALES DEL BALANCE DE COMPROBACION
                    </td>
                    <td className="py-2 px-1 text-right whitespace-nowrap">
                      {formatAccountingBalance(netInitialDebit || netInitialCredit, netInitialDebit >= netInitialCredit ? 'DEBIT' : 'CREDIT')}
                    </td>
                    <td className="py-2 px-1 text-right whitespace-nowrap">
                      {formatAccountingMovement(reportData.totalDebit)}
                    </td>
                    <td className="py-2 px-1 text-right whitespace-nowrap">
                      {formatAccountingMovement(reportData.totalCredit)}
                    </td>
                    <td className="py-2 px-1 text-right whitespace-nowrap">
                      {formatAccountingBalance(netFinalDebit || netFinalCredit, netFinalDebit >= netFinalCredit ? 'DEBIT' : 'CREDIT')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* SECCIÓN DE FIRMAS LEGALES Y CONTABLES */}
            <div className="mt-8 pt-4 page-break-inside-avoid">
              <div className="grid grid-cols-3 gap-6 text-center text-xs font-mono">
                <div>
                  <div className="w-40 border-b border-black mx-auto mb-1.5 mt-8"></div>
                  <strong className="block text-[11px] uppercase text-black">
                    REPRESENTANTE LEGAL
                  </strong>
                  <span className="text-[10px] text-slate-600 block">
                    C.C. ___________________
                  </span>
                  <span className="text-[9.5px] text-slate-500 block">
                    Distribuidora Super Más S.A.S.
                  </span>
                </div>

                <div>
                  <div className="w-40 border-b border-black mx-auto mb-1.5 mt-8"></div>
                  <strong className="block text-[11px] uppercase text-black">
                    CONTADOR PÚBLICO
                  </strong>
                  <span className="text-[10px] text-slate-600 block">
                    T.P. No. ________________-T
                  </span>
                  <span className="text-[9.5px] text-slate-500 block">
                    Responsable de Certificación
                  </span>
                </div>

                <div>
                  <div className="w-40 border-b border-black mx-auto mb-1.5 mt-8"></div>
                  <strong className="block text-[11px] uppercase text-black">
                    REVISOR FISCAL
                  </strong>
                  <span className="text-[10px] text-slate-600 block">
                    T.P. No. ________________-T
                  </span>
                  <span className="text-[9.5px] text-slate-500 block">
                    Dictamen Fiduciario
                  </span>
                </div>
              </div>
            </div>

            {/* PIE DE PÁGINA OBLIGATORIO SEGÚN REGLAS 29-32 */}
            <div className="mt-8 pt-3 border-t border-slate-300 text-center text-[10px] text-slate-600 flex flex-wrap items-center justify-between gap-2 font-sans">
              <span>
                Documento contable oficial expedido el {reportData.generatedAt}.
              </span>
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
            Formato oficial optimizado para impresión en hoja Carta / A4 sin cortes horizontales.
          </span>
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              className="outline-button compact text-xs"
              onClick={onClose}
            >
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
