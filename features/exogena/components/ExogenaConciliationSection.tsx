'use client'

import React, { useState, useMemo } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ExogenaConciliationItem } from '../types'

interface ExogenaConciliationSectionProps {
  items: ExogenaConciliationItem[]
  isLoading: boolean
  onRefresh: () => void
}

export function ExogenaConciliationSection({
  items,
  isLoading,
  onRefresh,
}: ExogenaConciliationSectionProps) {
  const [filter, setFilter] = useState<'ALL' | 'RECONCILED' | 'DIFFERENCE'>('ALL')
  const [selectedItem, setSelectedItem] = useState<ExogenaConciliationItem | null>(null)

  const formatCOP = (val: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)

  const summary = useMemo(() => {
    let totalAccounting = 0
    let totalExogena = 0
    let totalDiff = 0
    let countDiffs = 0

    items.forEach((it) => {
      totalAccounting += it.accountingTotalCOP
      totalExogena += it.exogenaTotalCOP
      totalDiff += Math.abs(it.differenceCOP)
      if (Math.abs(it.differenceCOP) > 0.01) {
        countDiffs++
      }
    })

    return {
      totalAccounting,
      totalExogena,
      totalDiff,
      countDiffs,
      isFullyReconciled: countDiffs === 0,
    }
  }, [items])

  const filteredItems = useMemo(() => {
    if (filter === 'RECONCILED') {
      return items.filter((it) => it.status === 'CONCILIATED')
    }
    if (filter === 'DIFFERENCE') {
      return items.filter((it) => it.status !== 'CONCILIATED')
    }
    return items
  }, [items, filter])

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '24px' }}>
        <div className="skeleton" style={{ height: 28, width: '30%', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 80, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '24px' }}>
      {/* Encabezado de la sección */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
              Conciliación Contable vs. Medios Magnéticos
            </h2>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 12,
                background: summary.isFullyReconciled ? '#dcfce7' : '#fee2e2',
                color: summary.isFullyReconciled ? '#166534' : '#991b1b',
                fontWeight: 700,
              }}
            >
              {summary.isFullyReconciled ? '100% Conciliado' : `${summary.countDiffs} Partidas con Descuadre`}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            Compara en tiempo real los saldos contables del ERP contra los importes consolidados a reportar en cada formato DIAN.
          </p>
        </div>

        <button
          type="button"
          className="outline-button compact"
          onClick={onRefresh}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <AppIcon name="accounting" size={14} />
          <span>Recalcular Saldos</span>
        </button>
      </div>

      {/* KPI Cards de resumen conciliatorio */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: 16,
            background: 'var(--table-header-bg, #f8fafc)',
            borderRadius: 8,
            border: '1px solid var(--line, #e2e8f0)',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Saldo Total Contabilidad
          </span>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
            {formatCOP(summary.totalAccounting)}
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Cuentas PUC 13, 14, 22, 24, 41, 62</span>
        </div>

        <div
          style={{
            padding: 16,
            background: 'var(--table-header-bg, #f8fafc)',
            borderRadius: 8,
            border: '1px solid var(--line, #e2e8f0)',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Total Consolidado Exógena
          </span>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--primary, #00205B)', marginTop: 4 }}>
            {formatCOP(summary.totalExogena)}
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Bases Reportables DIAN</span>
        </div>

        <div
          style={{
            padding: 16,
            background: summary.totalDiff === 0 ? '#f0fdf4' : '#fef2f2',
            borderRadius: 8,
            border: summary.totalDiff === 0 ? '1px solid #bbf7d0' : '1px solid #fecaca',
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: summary.totalDiff === 0 ? '#166534' : '#991b1b',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Diferencia Neta
          </span>
          <div
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: summary.totalDiff === 0 ? '#15803d' : '#b91c1c',
              marginTop: 4,
            }}
          >
            {formatCOP(summary.totalDiff)}
          </div>
          <span style={{ fontSize: 11, color: summary.totalDiff === 0 ? '#166534' : '#991b1b' }}>
            {summary.totalDiff === 0 ? 'Sin descuadre global' : 'Identifica el origen en la tabla'}
          </span>
        </div>
      </div>

      {/* Filtros de estado */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`compact ${filter === 'ALL' ? 'primary-button' : 'outline-button'}`}
          style={{ fontSize: 12 }}
        >
          Todos ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('RECONCILED')}
          className={`compact ${filter === 'RECONCILED' ? 'primary-button' : 'outline-button'}`}
          style={{ fontSize: 12 }}
        >
          Conciliados ({items.filter((i) => i.status === 'CONCILIATED').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('DIFFERENCE')}
          className={`compact ${filter === 'DIFFERENCE' ? 'primary-button' : 'outline-button'}`}
          style={{ fontSize: 12 }}
        >
          Con Diferencia ({items.filter((i) => i.status !== 'CONCILIATED').length})
        </button>
      </div>

      {/* Tabla de conciliación */}
      <div className="table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 14px' }}>Concepto / Rubro</th>
              <th style={{ textAlign: 'left', padding: '10px 14px' }}>Cuenta PUC</th>
              <th style={{ textAlign: 'right', padding: '10px 14px' }}>Saldo Contabilidad</th>
              <th style={{ textAlign: 'right', padding: '10px 14px' }}>Base Exógena</th>
              <th style={{ textAlign: 'right', padding: '10px 14px' }}>Diferencia</th>
              <th style={{ textAlign: 'center', padding: '10px 14px' }}>Estado</th>
              <th style={{ textAlign: 'center', padding: '10px 14px' }}>Trazabilidad</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px 14px', color: 'var(--muted)' }}>
                  No se encontraron partidas con el filtro seleccionado.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isMatch = item.status === 'CONCILIATED'
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--line, #e2e8f0)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                        {item.concept}
                      </div>
                      {item.notes && (
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{item.notes}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: '#f1f5f9',
                          color: '#334155',
                          fontWeight: 600,
                        }}
                      >
                        {item.accountingAccountCode}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                      {formatCOP(item.accountingTotalCOP)}
                    </td>
                    <td
                      style={{
                        padding: '12px 14px',
                        textAlign: 'right',
                        fontWeight: 600,
                        fontSize: 13,
                        color: 'var(--primary, #00205B)',
                      }}
                    >
                      {formatCOP(item.exogenaTotalCOP)}
                    </td>
                    <td
                      style={{
                        padding: '12px 14px',
                        textAlign: 'right',
                        fontWeight: 700,
                        fontSize: 13,
                        color: isMatch ? '#166534' : '#dc2626',
                      }}
                    >
                      {formatCOP(item.differenceCOP)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 12,
                          fontWeight: 700,
                          background: isMatch ? '#dcfce7' : '#fee2e2',
                          color: isMatch ? '#166534' : '#991b1b',
                        }}
                      >
                        {isMatch ? 'CONCILIADO' : 'DESCUADRE'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button
                        type="button"
                        className="outline-button compact"
                        onClick={() => setSelectedItem(item)}
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        title="Ver detalle del origen del dato contable"
                      >
                        <AppIcon name="search" size={12} />
                        <span>Ver Origen</span>
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de trazabilidad de origen */}
      {selectedItem && (
        <div
          className="drawer-backdrop"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="product-drawer"
            style={{ width: 'min(100%, 640px)', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Trazabilidad de Conciliación
                </p>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                  {selectedItem.concept}
                </h3>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedItem(null)}
                aria-label="Cerrar modal"
              >
                <AppIcon name="close" size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Saldo Contable Registrado</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  {formatCOP(selectedItem.accountingTotalCOP)}
                </div>
              </div>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Reportado en Medios</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary, #00205B)' }}>
                  {formatCOP(selectedItem.exogenaTotalCOP)}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Cuenta del Plan Único Involucrada:</h4>
              <span
                style={{
                  fontSize: 12,
                  fontFamily: 'monospace',
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                }}
              >
                Cuenta {selectedItem.accountingAccountCode}
              </span>
            </div>

            {selectedItem.notes && (
              <div style={{ padding: 12, background: '#f0f9ff', borderRadius: 6, border: '1px solid #bae6fd', fontSize: 12, color: '#0369a1', lineHeight: 1.5 }}>
                <strong>Nota Técnica del Mapeo:</strong> {selectedItem.notes}
                <br />
                <span style={{ marginTop: 6, display: 'inline-block', fontSize: 11.5, color: '#0284c7' }}>
                  Toda la información se rastrea directamente a los asientos contables y facturas del periodo fiscal.
                </span>
              </div>
            )}

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button
                type="button"
                className="outline-button compact"
                onClick={() => setSelectedItem(null)}
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
