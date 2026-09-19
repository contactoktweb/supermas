'use client'

import React, { useState, useMemo } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect'
import { ReportPeriod, ExportFormat } from '../types'

interface ReportHeaderProps {
  title: string
  description: string
  categoryName?: string
  period: ReportPeriod
  setPeriod: (p: ReportPeriod) => void
  locationId: string
  setLocationId: (l: string) => void
  locations: { value: string; label: string; code?: string }[]
  periods: { value: string; label: string }[]
  onExport: (format: ExportFormat) => void
  onRefresh: () => void
  loading?: boolean
}

export function ReportHeader({
  title,
  description,
  categoryName,
  period,
  setPeriod,
  locationId,
  setLocationId,
  locations,
  periods,
  onExport,
  onRefresh,
  loading = false,
}: ReportHeaderProps) {
  const [exportOpen, setExportOpen] = useState(false)

  const periodOptions: SelectOption[] = useMemo(() => {
    return periods.map((p) => ({ value: p.value, label: p.label }))
  }, [periods])

  const locationOptions: SelectOption[] = useMemo(() => {
    return locations.map((loc) => ({ value: loc.value, label: loc.label }))
  }, [locations])

  return (
    <div className="page-heading page-enter" style={{ marginBottom: 20 }}>
      <div>
        <p className="eyebrow">{categoryName ? `Analítica & Reportes · ${categoryName}` : 'Analítica & Gestión Inteligente'}</p>
        <h1>{title}</h1>
        <p className="welcome-subtitle">{description}</p>
      </div>

      <div className="heading-actions flex flex-wrap items-center gap-2.5">
        {/* Period Selector con CustomSelect */}
        <div style={{ minWidth: 155 }}>
          <CustomSelect
            options={periodOptions}
            value={period}
            onChange={(val) => setPeriod(val as ReportPeriod)}
            placeholder="Periodo"
            size="sm"
            icon={<AppIcon name="calendar" size={14} color="#64748b" />}
          />
        </div>

        {/* Location Selector con CustomSelect */}
        <div style={{ minWidth: 175 }}>
          <CustomSelect
            options={locationOptions}
            value={locationId}
            onChange={(val) => setLocationId(val)}
            placeholder="Bodega"
            size="sm"
            icon={<AppIcon name="warehouse" size={14} color="#64748b" />}
          />
        </div>

        {/* Export Button & Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportOpen(!exportOpen)}
            className="outline-button flex items-center gap-1.5"
            aria-expanded={exportOpen}
            aria-haspopup="true"
          >
            <AppIcon name="download" size={15} />
            <span>Exportar</span>
            <AppIcon name="chevronDown" size={12} className={exportOpen ? 'rotate-180' : ''} />
          </button>

          {exportOpen && (
            <div
              className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 animate-scale-up text-left"
              onMouseLeave={() => setExportOpen(false)}
            >
              <button
                type="button"
                onClick={() => {
                  onExport('EXCEL')
                  setExportOpen(false)
                }}
                className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[var(--navy)] flex items-center gap-2 font-medium transition-colors"
              >
                <AppIcon name="table" size={14} className="text-emerald-600" />
                <span>Microsoft Excel (.xls)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onExport('CSV')
                  setExportOpen(false)
                }}
                className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[var(--navy)] flex items-center gap-2 font-medium transition-colors"
              >
                <AppIcon name="fileText" size={14} className="text-blue-600" />
                <span>Archivo CSV (.csv)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onExport('PDF')
                  setExportOpen(false)
                }}
                className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[var(--navy)] flex items-center gap-2 font-medium transition-colors border-t border-slate-100"
              >
                <AppIcon name="print" size={14} className="text-amber-600" />
                <span>Imprimir / PDF</span>
              </button>
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="outline-button flex items-center justify-center p-0"
          style={{ width: 42, height: 42 }}
          title="Recargar métricas"
          aria-label="Recargar métricas"
        >
          <AppIcon name="refresh" size={16} className={loading ? 'animate-spin text-[var(--red)]' : ''} />
        </button>
      </div>
    </div>
  )
}
