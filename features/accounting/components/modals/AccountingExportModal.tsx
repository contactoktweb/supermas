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
} from '../../types'
import { accountingExportService } from '../../services/accounting-export.service'

interface AccountingExportModalProps {
  isOpen: boolean
  onClose: () => void
  initialType?: AccountingExportType
  thirdParties: ThirdParty[]
  entries: AccountingEntry[]
  movements: AccountingMovement[]
  accounts: AccountingAccount[]
  onSuccessToast?: (title: string, message: string) => void
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
  initialType = 'third_parties',
  thirdParties,
  entries,
  movements,
  accounts,
  onSuccessToast,
}: AccountingExportModalProps) {
  const [mounted, setMounted] = useState(false)
  const [selectedType, setSelectedType] = useState<AccountingExportType>(initialType)
  const [format, setFormat] = useState<AccountingExportFormat>('CSV')
  const [isExporting, setIsExporting] = useState(false)

  // Filtros de fecha opcionales
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Filtros contextuales
  const [thirdPartyType, setThirdPartyType] = useState<'ALL' | ThirdPartyType>('ALL')
  const [legalNature, setLegalNature] = useState<'ALL' | LegalNature>('ALL')
  const [entryStatus, setEntryStatus] = useState<'ALL' | AccountingEntryStatus>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sincronizar tipo inicial cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setSelectedType(initialType)
    }
  }, [isOpen, initialType])

  // Configuración de módulos exportables
  const exportTypes: ExportTypeConfig[] = useMemo(() => [
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

  // Cálculo en vivo de registros filtrados según el tipo y opciones seleccionadas
  const filteredCount = useMemo(() => {
    const filterOpts = {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      thirdPartyType,
      legalNature,
      entryStatus,
      searchQuery,
    }

    switch (selectedType) {
      case 'third_parties':
        return accountingExportService.filterThirdParties(thirdParties, filterOpts).length
      case 'entries':
        return accountingExportService.filterEntries(entries, filterOpts).length
      case 'movements':
        return accountingExportService.filterMovements(movements, filterOpts).length
      case 'accounts':
        return accountingExportService.filterAccounts(accounts, filterOpts).length
      case 'journal':
        return accountingExportService.filterEntries(entries, filterOpts).length
      case 'balance':
        return accountingExportService.filterAccounts(accounts, filterOpts).length
      default:
        return 0
    }
  }, [
    selectedType,
    thirdParties,
    entries,
    movements,
    accounts,
    startDate,
    endDate,
    thirdPartyType,
    legalNature,
    entryStatus,
    searchQuery,
  ])

  // Presets rápidos de fechas
  const handleSetDatePreset = (preset: 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR') => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    if (preset === 'ALL') {
      setStartDate('')
      setEndDate('')
      return
    }

    if (preset === 'THIS_MONTH') {
      const firstDay = new Date(currentYear, currentMonth, 1)
      const dateToIso = (d: Date) => d.toISOString().slice(0, 10)
      setStartDate(dateToIso(firstDay))
      setEndDate(now.toISOString().slice(0, 10))
      return
    }

    if (preset === 'LAST_MONTH') {
      const firstDayLastMonth = new Date(currentYear, currentMonth - 1, 1)
      const lastDayLastMonth = new Date(currentYear, currentMonth, 0)
      const dateToIso = (d: Date) => d.toISOString().slice(0, 10)
      setStartDate(dateToIso(firstDayLastMonth))
      setEndDate(dateToIso(lastDayLastMonth))
      return
    }

    if (preset === 'THIS_YEAR') {
      setStartDate(`${currentYear}-01-01`)
      setEndDate(now.toISOString().slice(0, 10))
      return
    }
  }

  // Ejecución de la descarga
  const handleExport = () => {
    setIsExporting(true)

    setTimeout(() => {
      try {
        const filterOpts = {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          thirdPartyType,
          legalNature,
          entryStatus,
          searchQuery,
        }

        let result: { count: number; filename: string } = { count: 0, filename: '' }

        switch (selectedType) {
          case 'third_parties':
            result = accountingExportService.exportThirdParties(thirdParties, format, filterOpts)
            break
          case 'entries':
            result = accountingExportService.exportEntries(entries, format, filterOpts)
            break
          case 'movements':
            result = accountingExportService.exportAuxiliary(movements, format, filterOpts)
            break
          case 'accounts':
            result = accountingExportService.exportAccounts(accounts, format, filterOpts)
            break
          case 'journal':
            result = accountingExportService.exportJournal(entries, format, filterOpts)
            break
          case 'balance':
            result = accountingExportService.exportBalance(accounts, format, filterOpts)
            break
        }

        if (onSuccessToast) {
          const typeName =
            exportTypes.find((t) => t.id === selectedType)?.title || 'Información Contable'
          onSuccessToast(
            'Exportación Completada',
            `Se descargaron exitosamente ${result.count} registros de ${typeName} en formato ${format}.`
          )
        }

        onClose()
      } catch (err: any) {
        console.error('Error al exportar información contable:', err)
        alert(`Ocurrió un error al generar la exportación: ${err?.message || 'Error desconocido'}`)
      } finally {
        setIsExporting(false)
      }
    }, 250)
  }

  if (!isOpen || !mounted) return null

  const currentTypeConfig = exportTypes.find((t) => t.id === selectedType)

  return createPortal(
    <div
      className="drawer-backdrop modal-center p-3 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="accounting-export-title"
    >
      <div
        className="modal-card animate-scale-up"
        style={{
          width: '100%',
          maxWidth: 760,
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
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0"
              style={{
                backgroundColor: currentTypeConfig?.iconBg || '#eff6ff',
                color: currentTypeConfig?.iconColor || 'var(--navy)',
              }}
            >
              <AppIcon name="download" size={20} />
            </div>
            <div>
              <h2 id="accounting-export-title" className="text-base font-bold text-slate-900 m-0">
                Exportar Información Contable
              </h2>
              <p className="text-xs text-slate-500 m-0">
                Selecciona el módulo, rango de fechas opcional y formato para descargar reportes oficiales.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={20} />
          </button>
        </div>

        {/* Cuerpo del Modal con Scroll */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* PASO 1: SELECCIONAR QUÉ EXPORTAR */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">
                  1
                </span>
                ¿Qué información deseas exportar? *
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Módulo seleccionado: <strong>{currentTypeConfig?.title}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {exportTypes.map((t) => {
                const isSelected = selectedType === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedType(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-950 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ backgroundColor: t.iconBg, color: t.iconColor }}
                      >
                        <AppIcon name={t.icon} size={15} />
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.count} {t.unit}
                      </span>
                    </div>
                    <div>
                      <strong className="block text-xs font-bold text-slate-900">
                        {t.title}
                      </strong>
                      <span className="text-[10.5px] text-slate-500 leading-tight block mt-0.5">
                        {t.subtitle}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* PASO 2: RANGO DE FECHAS (OPCIONAL) */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">
                  2
                </span>
                Rango de Fechas (Opcional)
              </label>

              {/* Botones de Presets Rápidos */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('ALL')}
                  className={`px-2 py-1 rounded text-[10.5px] font-semibold border transition-all ${
                    !startDate && !endDate
                      ? 'bg-white text-blue-700 border-blue-300 shadow-2xs font-bold'
                      : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-200/60'
                  }`}
                >
                  Todo el Histórico
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('THIS_MONTH')}
                  className="px-2 py-1 rounded text-[10.5px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
                >
                  Este Mes
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('LAST_MONTH')}
                  className="px-2 py-1 rounded text-[10.5px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
                >
                  Mes Anterior
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDatePreset('THIS_YEAR')}
                  className="px-2 py-1 rounded text-[10.5px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
                >
                  Este Año
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Fecha Desde (Inicio):
                </span>
                <div className="relative">
                  <input
                    type="date"
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-2xs"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  {startDate && (
                    <button
                      type="button"
                      onClick={() => setStartDate('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                      title="Quitar fecha inicial"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              <div>
                <span className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Fecha Hasta (Fin):
                </span>
                <div className="relative">
                  <input
                    type="date"
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-2xs"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  {endDate && (
                    <button
                      type="button"
                      onClick={() => setEndDate('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                      title="Quitar fecha final"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[10.5px] text-slate-500 m-0">
              {selectedType === 'third_parties' &&
                '💡 Filtra terceros según su fecha de registro en el sistema. Deja los campos vacíos para exportar el directorio completo.'}
              {selectedType === 'entries' &&
                '💡 Filtra los comprobantes por su fecha contable de causación.'}
              {selectedType === 'movements' &&
                '💡 Filtra las líneas del libro auxiliar según la fecha del movimiento contable.'}
              {selectedType === 'journal' &&
                '💡 Filtra el libro diario cronológico por fecha de emisión.'}
              {(selectedType === 'accounts' || selectedType === 'balance') &&
                '💡 Si no defines fechas, se exportarán todas las cuentas con su saldo fiduciario actual.'}
            </p>
          </div>

          {/* PASO 3: FILTROS ESPECÍFICOS SEGÚN EL MÓDULO */}
          {selectedType === 'third_parties' && (
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
              <label className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">
                  3
                </span>
                Filtros Específicos de Terceros
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Clasificación / Rol */}
                <div>
                  <span className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Clasificación / Rol:
                  </span>
                  <select
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    value={thirdPartyType}
                    onChange={(e) => setThirdPartyType(e.target.value as any)}
                  >
                    <option value="ALL">Todos los Roles (Clientes, Proveedores, Empleados, etc.)</option>
                    <option value="CLIENTE">🛒 Clientes (Ventas y Cartera)</option>
                    <option value="PROVEEDOR">📦 Proveedores (Compras y CXP)</option>
                    <option value="EMPLEADO">👤 Empleados (Nómina)</option>
                    <option value="ACREEDOR">🏢 Acreedores Varios</option>
                    <option value="OTRO">⚪ Otros Terceros</option>
                  </select>
                </div>

                {/* Naturaleza Jurídica */}
                <div>
                  <span className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Naturaleza Jurídica:
                  </span>
                  <select
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    value={legalNature}
                    onChange={(e) => setLegalNature(e.target.value as any)}
                  >
                    <option value="ALL">Todas las Naturalezas</option>
                    <option value="JURIDICA">🏢 Personas Jurídicas (NIT con DV)</option>
                    <option value="NATURAL">👤 Personas Naturales (CC / CE / TI)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {selectedType === 'entries' && (
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
              <label className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">
                  3
                </span>
                Filtros de Asientos Contables
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Estado del Comprobante:
                  </span>
                  <select
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    value={entryStatus}
                    onChange={(e) => setEntryStatus(e.target.value as any)}
                  >
                    <option value="ALL">Todos los Estados (Asentados, Borradores, Reversados)</option>
                    <option value="POSTED">✓ Asentados / Confirmados (POSTED)</option>
                    <option value="DRAFT">⏳ Borradores (DRAFT)</option>
                    <option value="REVERSED">↩ Reversados / Anulados (REVERSED)</option>
                  </select>
                </div>

                <div>
                  <span className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Búsqueda de Texto (Opcional):
                  </span>
                  <input
                    type="text"
                    placeholder="Número de comprobante, concepto o tercero..."
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* PASO 4: FORMATO DE ARCHIVO */}
          <div>
            <label className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">
                {selectedType === 'third_parties' || selectedType === 'entries' ? '4' : '3'}
              </span>
              Formato de Archivo para la Descarga *
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  format === 'CSV'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20 font-bold'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
                onClick={() => setFormat('CSV')}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  CSV
                </div>
                <strong className="text-xs">CSV (Excel UTF-8)</strong>
                <span className="text-[10px] text-slate-500 leading-tight">
                  Con delimitador ; y BOM para Excel en español sin descuadres
                </span>
              </button>

              <button
                type="button"
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  format === 'EXCEL'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20 font-bold'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
                onClick={() => setFormat('EXCEL')}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
                  XLS
                </div>
                <strong className="text-xs">Excel Nativo (.xls)</strong>
                <span className="text-[10px] text-slate-500 leading-tight">
                  Spreadsheet XML estructurado con encabezados y tipado formal
                </span>
              </button>

              <button
                type="button"
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  format === 'JSON'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20 font-bold'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
                onClick={() => setFormat('JSON')}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                  JSON
                </div>
                <strong className="text-xs">JSON Estructurado</strong>
                <span className="text-[10px] text-slate-500 leading-tight">
                  Para APIs, respaldos técnicos o migración entre sistemas
                </span>
              </button>
            </div>
          </div>

          {/* BANNER DE RESUMEN Y CONTEO EN VIVO */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
              filteredCount > 0
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/80 border-amber-300 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{filteredCount > 0 ? '✨' : '⚠️'}</span>
              <div>
                <strong className="block text-xs">
                  {filteredCount > 0
                    ? `${filteredCount} ${
                        filteredCount === 1 ? 'registro listo' : 'registros listos'
                      } para exportar`
                    : 'No hay registros que coincidan con los filtros aplicados'}
                </strong>
                <span className="text-[10.5px] opacity-80 block">
                  Módulo: {currentTypeConfig?.title} | Formato: {format}
                  {(startDate || endDate) &&
                    ` | Periodo: ${startDate || 'Inicio'} a ${endDate || 'Hoy'}`}
                  {selectedType === 'third_parties' && thirdPartyType !== 'ALL' &&
                    ` | Rol: ${thirdPartyType}`}
                </span>
              </div>
            </div>

            <span className="text-base font-bold font-mono px-2.5 py-1 rounded-lg bg-white/80 border border-current shadow-2xs">
              {filteredCount}
            </span>
          </div>
        </div>

        {/* Pie del Modal */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            La exportación se procesa en el cliente con codificación optimizada.
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
              className="primary-button compact text-xs flex items-center gap-2"
              onClick={handleExport}
              disabled={isExporting || filteredCount === 0}
            >
              <AppIcon name="download" size={14} className={isExporting ? 'animate-bounce' : ''} />
              <span>
                {isExporting
                  ? 'Generando archivo...'
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
