'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ExogenaYearNormativa } from '../types'

interface ExogenaYearSelectorProps {
  selectedYear: number
  availableYears: Array<{ year: number; label: string; status: string }>
  normativa: ExogenaYearNormativa | null
  onSelectYear: (year: number) => void
}

export function ExogenaYearSelector({
  selectedYear,
  availableYears,
  normativa,
  onSelectYear,
}: ExogenaYearSelectorProps) {
  const getYearStatusBadge = (status?: string) => {
    switch (status) {
      case 'FINALIZADO_Y_PRESENTADO':
        return <span className="state disponible">Presentado a la DIAN</span>
      case 'EN_PREPARACION':
        return <span className="state publicado">En Preparación Activa</span>
      case 'BORRADOR_PREVIO':
      default:
        return <span className="state pendiente">Borrador Preliminar</span>
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        padding: '16px 20px',
        borderRadius: 12,
        background: '#fff',
        border: '1px solid var(--line)',
        boxShadow: '0 4px 12px rgba(16, 33, 63, 0.03)',
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 42,
            height: 42,
            borderRadius: 10,
            background: '#eef2fa',
            color: 'var(--navy)',
          }}
        >
          <AppIcon name="calendar" size={22} />
        </div>

        <div>
          <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
            Periodo Fiscal de Medios Magnéticos
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {availableYears.map((y) => (
                <button
                  key={y.year}
                  type="button"
                  onClick={() => onSelectYear(y.year)}
                  className={`outline-button compact ${y.year === selectedYear ? 'selected-year-btn' : ''}`}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    fontWeight: 700,
                    fontSize: 13,
                    background: y.year === selectedYear ? 'var(--navy)' : '#fff',
                    color: y.year === selectedYear ? '#fff' : 'var(--foreground)',
                    borderColor: y.year === selectedYear ? 'var(--navy)' : 'var(--line)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: '0.2s',
                  }}
                >
                  {y.year}
                </button>
              ))}
            </div>
            {getYearStatusBadge(normativa?.status)}
          </div>
        </div>
      </div>

      {normativa && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 11, color: 'var(--muted)' }}>
          <div>
            <span style={{ display: 'block', color: 'var(--muted)', fontSize: 10 }}>Marco Normativo</span>
            <strong style={{ color: 'var(--foreground)', fontSize: 12 }}>
              {normativa.normativaResolution}
            </strong>
          </div>

          <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 20 }}>
            <span style={{ display: 'block', color: 'var(--muted)', fontSize: 10 }}>Fecha Límite DIAN</span>
            <strong style={{ color: 'var(--red)', fontSize: 12 }}>
              {normativa.dueDate}
            </strong>
          </div>

          <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 20 }}>
            <span style={{ display: 'block', color: 'var(--muted)', fontSize: 10 }}>Responsable</span>
            <strong style={{ color: 'var(--navy)', fontSize: 12 }}>
              {normativa.responsibleName}
            </strong>
          </div>
        </div>
      )}
    </div>
  )
}
