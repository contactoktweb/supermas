'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { TaxReportItem, TaxReportSummary, TaxReportFilters } from '../types'
import { taxService } from '../services/tax.service'
import { taxCalculationService } from '../services/tax-calculation.service'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { db } from '@/lib/supabase/db'

interface TaxReportsDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function TaxReportsDrawer({ isOpen, onClose }: TaxReportsDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [filters, setFilters] = useState<TaxReportFilters>({
    dateFrom: '',
    dateUntil: '',
    locationId: 'ALL',
    documentType: 'ALL',
  })

  const [items, setItems] = useState<TaxReportItem[]>([])
  const [summary, setSummary] = useState<TaxReportSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'MOVEMENTS' | 'BY_LOCATION' | 'BY_RATE'>('MOVEMENTS')

  useEffect(() => {
    setMounted(true)
  }, [])

  const loadReport = () => {
    setIsLoading(true)
    taxService
      .getTaxReports(filters)
      .then((res) => {
        setItems(res.items)
        setSummary(res.summary)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    if (isOpen) {
      loadReport()
    }
  }, [isOpen, filters])

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!mounted || !isOpen) return null

  const handleExportCSV = async () => {
    const csv = await taxService.exportTaxReportsToCSV(filters)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `reporte_tributario_supermas_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const locationOptions = [
    { value: 'ALL', label: 'Todas las bodegas y puntos' },
    ...db.locations.map((l) => ({ value: l.id, label: l.name })),
  ]

  const docTypeOptions = [
    { value: 'ALL', label: 'Todos los comprobantes' },
    { value: 'SALE', label: 'Facturas de Venta (Generado)' },
    { value: 'PURCHASE', label: 'Facturas de Compra (Descontable)' },
  ]

  const drawerContent = (
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tax-reports-title"
    >
      <div
        className="product-drawer"
        style={{ width: 'min(100%, 780px)', padding: '28px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <p className="eyebrow" style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Libro Fiscal & Liquidación de IVA
            </p>
            <h2 id="tax-reports-title" style={{ margin: 0, fontSize: 20 }}>
              Reportes Tributarios y Declaración DIAN
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="outline-button compact"
              onClick={handleExportCSV}
              title="Descargar reporte en formato CSV"
            >
              <AppIcon name="download" size={14} />
              <span>Exportar CSV</span>
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Cerrar panel"
            >
              <AppIcon name="close" size={18} />
            </button>
          </div>
        </div>

        {/* Filtros del reporte */}
        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 10,
            background: '#f8fafc',
            border: '1px solid var(--line)',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 5 }}>
              Ubicación / Bodega
            </label>
            <CustomSelect
              value={filters.locationId || 'ALL'}
              options={locationOptions}
              onChange={(val) => setFilters((prev) => ({ ...prev, locationId: val }))}
              icon={<AppIcon name="warehouse" size={14} />}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 5 }}>
              Tipo de comprobante
            </label>
            <CustomSelect
              value={filters.documentType || 'ALL'}
              options={docTypeOptions}
              onChange={(val) => setFilters((prev) => ({ ...prev, documentType: val as any }))}
              icon={<AppIcon name="receipt" size={14} />}
            />
          </div>
        </div>

        {/* Resumen Fiscal */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
            <div style={{ padding: 14, borderRadius: 10, border: '1px solid #fca5a5', background: '#fef2f2' }}>
              <span style={{ fontSize: 11, color: '#991b1b', fontWeight: 600 }}>
                IVA Generado (Ventas)
              </span>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--red)', marginTop: 4 }}>
                {taxCalculationService.formatCOP(summary.generatedTaxes)}
              </div>
              <small style={{ fontSize: 10, color: 'var(--muted)' }}>
                Base: {taxCalculationService.formatCOP(summary.totalBaseSales)}
              </small>
            </div>

            <div style={{ padding: 14, borderRadius: 10, border: '1px solid #a7f3d0', background: '#ecfdf5' }}>
              <span style={{ fontSize: 11, color: '#065f46', fontWeight: 600 }}>
                IVA Descontable (Compras)
              </span>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--green)', marginTop: 4 }}>
                {taxCalculationService.formatCOP(summary.deductibleTaxes)}
              </div>
              <small style={{ fontSize: 10, color: 'var(--muted)' }}>
                Base: {taxCalculationService.formatCOP(summary.totalBasePurchases)}
              </small>
            </div>

            <div style={{ padding: 14, borderRadius: 10, border: '1px solid #bfdbfe', background: '#eff6ff' }}>
              <span style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>
                {summary.netBalance >= 0 ? 'Saldo a Pagar DIAN' : 'Saldo a Favor'}
              </span>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--navy)', marginTop: 4 }}>
                {taxCalculationService.formatCOP(Math.abs(summary.netBalance))}
              </div>
              <small style={{ fontSize: 10, color: 'var(--muted)' }}>
                {summary.recordsCount} operaciones liquidadas
              </small>
            </div>
          </div>
        )}

        {/* Tabs de vista */}
        <div className="drawer-tabs" style={{ marginTop: 18 }}>
          <button
            type="button"
            className={activeTab === 'MOVEMENTS' ? 'active' : ''}
            onClick={() => setActiveTab('MOVEMENTS')}
          >
            Libro de Movimientos ({items.length})
          </button>
          <button
            type="button"
            className={activeTab === 'BY_LOCATION' ? 'active' : ''}
            onClick={() => setActiveTab('BY_LOCATION')}
          >
            Por Bodega / Sucursal
          </button>
          <button
            type="button"
            className={activeTab === 'BY_RATE' ? 'active' : ''}
            onClick={() => setActiveTab('BY_RATE')}
          >
            Por Tarifa de Impuesto
          </button>
        </div>

        {/* Contenido de Tabs */}
        <div style={{ marginTop: 14, flex: 1, overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>
              <AppIcon name="refresh" size={24} className="animate-spin" />
              <p style={{ marginTop: 8, fontSize: 12 }}>Procesando balance tributario...</p>
            </div>
          ) : activeTab === 'MOVEMENTS' ? (
            <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Comprobante</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Tercero</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Tarifa</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Base</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Impuesto</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <strong style={{ color: 'var(--foreground)' }}>{it.documentNumber}</strong>
                      <small style={{ display: 'block', color: 'var(--muted)', fontSize: 9 }}>
                        {it.operationType === 'GENERATED' ? 'Venta' : 'Compra'} · {it.date.split('T')[0]}
                      </small>
                    </td>

                    <td style={{ padding: '8px 10px' }}>
                      <span>{it.thirdPartyName}</span>
                      <small style={{ display: 'block', color: 'var(--muted)', fontSize: 9 }}>
                        {it.thirdPartyDoc}
                      </small>
                    </td>

                    <td style={{ padding: '8px 10px' }}>
                      <span className={it.operationType === 'GENERATED' ? 'state publicado' : 'state disponible'}>
                        {it.taxConfigCode} ({it.ratePercent}%)
                      </span>
                    </td>

                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {taxCalculationService.formatCOP(it.baseAmount)}
                    </td>

                    <td
                      style={{
                        padding: '8px 10px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: it.operationType === 'GENERATED' ? 'var(--red)' : 'var(--green)',
                      }}
                    >
                      {taxCalculationService.formatCOP(it.taxAmount)}
                    </td>

                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                      {taxCalculationService.formatCOP(it.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === 'BY_LOCATION' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Bodega / Sucursal</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>IVA Generado</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>IVA Descontable</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Saldo Neto</th>
                </tr>
              </thead>
              <tbody>
                {summary?.byLocation.map((loc) => {
                  const net = loc.generated - loc.deductible
                  return (
                    <tr key={loc.locationName} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{loc.locationName}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--red)' }}>
                        {taxCalculationService.formatCOP(loc.generated)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--green)' }}>
                        {taxCalculationService.formatCOP(loc.deductible)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800 }}>
                        {taxCalculationService.formatCOP(net)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Tarifa Tributaria</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>IVA Generado</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>IVA Descontable</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Impuesto</th>
                </tr>
              </thead>
              <tbody>
                {summary?.byRate.map((r) => (
                  <tr key={r.ratePercent} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.label}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--red)' }}>
                      {taxCalculationService.formatCOP(r.generated)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--green)' }}>
                      {taxCalculationService.formatCOP(r.deductible)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800 }}>
                      {taxCalculationService.formatCOP(r.generated + r.deductible)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(drawerContent, document.body)
}
