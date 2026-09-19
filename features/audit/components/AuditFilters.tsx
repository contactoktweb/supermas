'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { AuditFilters as AuditFiltersType } from '../types'
import { db } from '@/lib/supabase/db'

interface AuditFiltersProps {
  filters: AuditFiltersType
  onUpdateFilter: (key: keyof AuditFiltersType, value: any) => void
  onResetFilters: () => void
  isLoading?: boolean
}

export function AuditFilters({
  filters,
  onUpdateFilter,
  onResetFilters,
  isLoading,
}: AuditFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.searchQuery || '')

  // Debounce para la búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      onUpdateFilter('searchQuery', localSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch])

  const locations = db.locations || []
  const users = db.users || []

  return (
    <div
      style={{
        background: 'var(--surface, #ffffff)',
        border: '1px solid var(--line, #e2e8f0)',
        borderRadius: 10,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      {/* Fila 1: Búsqueda y Filtros Rápidos */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
          <input
            type="text"
            placeholder="Buscar por usuario, documento, ID, factura, producto o detalle..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 6,
              border: '1px solid var(--line, #cbd5e1)',
              background: 'var(--table-header-bg, #f8fafc)',
              fontSize: 13,
              color: 'var(--text)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 11,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted)',
              pointerEvents: 'none',
            }}
          >
            <AppIcon name="search" size={15} />
          </div>
        </div>

        {/* Nivel de Severidad */}
        <select
          value={filters.level || 'ALL'}
          onChange={(e) => onUpdateFilter('level', e.target.value)}
          disabled={isLoading}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid var(--line, #cbd5e1)',
            background: 'var(--surface, #ffffff)',
            fontSize: 13,
            color: 'var(--text)',
            minWidth: 150,
          }}
        >
          <option value="ALL">Todas las severidades</option>
          <option value="CRITICAL">Solo Críticas</option>
          <option value="WARNING">Advertencias</option>
          <option value="INFO">Informativas</option>
        </select>

        {/* Módulo */}
        <select
          value={filters.module || 'ALL'}
          onChange={(e) => onUpdateFilter('module', e.target.value)}
          disabled={isLoading}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid var(--line, #cbd5e1)',
            background: 'var(--surface, #ffffff)',
            fontSize: 13,
            color: 'var(--text)',
            minWidth: 140,
          }}
        >
          <option value="ALL">Todos los módulos</option>
          <option value="INVENTORY">Inventario</option>
          <option value="SALES">Ventas</option>
          <option value="PURCHASES">Compras</option>
          <option value="INVOICING">Facturación</option>
          <option value="CASH">Cajas</option>
          <option value="TRANSFERS">Transferencias</option>
          <option value="PRODUCTS">Productos</option>
          <option value="SECURITY">Seguridad</option>
          <option value="TAXES">Impuestos</option>
          <option value="WAREHOUSES">Bodegas</option>
          <option value="EXOGENA">Exógena</option>
        </select>

        {/* Bodega */}
        <select
          value={filters.locationId || 'ALL'}
          onChange={(e) => onUpdateFilter('locationId', e.target.value)}
          disabled={isLoading}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid var(--line, #cbd5e1)',
            background: 'var(--surface, #ffffff)',
            fontSize: 13,
            color: 'var(--text)',
            minWidth: 160,
          }}
        >
          <option value="ALL">Todas las bodegas</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>

        {/* Limpiar Filtros */}
        <button
          type="button"
          className="outline-button compact"
          onClick={() => {
            setLocalSearch('')
            onResetFilters()
          }}
          title="Restablecer todos los filtros"
          style={{ fontSize: 12 }}
        >
          Limpiar
        </button>
      </div>

      {/* Fila 2: Conmutadores Rápidos & Filtro por Usuario y Fechas */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          paddingTop: 10,
          borderTop: '1px solid var(--line, #f1f5f9)',
          fontSize: 12.5,
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Toggle Solo Críticas */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontWeight: filters.onlyCritical ? 700 : 500,
              color: filters.onlyCritical ? '#b91c1c' : 'var(--text)',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={!!filters.onlyCritical}
              onChange={(e) => onUpdateFilter('onlyCritical', e.target.checked)}
              style={{ accentColor: '#dc2626' }}
            />
            <span>Solo acciones críticas</span>
          </label>

          {/* Toggle Solo Cambios con Diff */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontWeight: filters.onlyWithChanges ? 700 : 500,
              color: filters.onlyWithChanges ? 'var(--primary, #00205B)' : 'var(--text)',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={!!filters.onlyWithChanges}
              onChange={(e) => onUpdateFilter('onlyWithChanges', e.target.checked)}
              style={{ accentColor: 'var(--primary, #00205B)' }}
            />
            <span>Solo cambios con comparativa (diff)</span>
          </label>
        </div>

        {/* Filtro por Colaborador */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>Usuario:</span>
          <select
            value={filters.userId || 'ALL'}
            onChange={(e) => onUpdateFilter('userId', e.target.value)}
            disabled={isLoading}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid var(--line, #cbd5e1)',
              background: 'var(--surface, #ffffff)',
              fontSize: 12,
              color: 'var(--text)',
            }}
          >
            <option value="ALL">Todos los usuarios</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({(u as any).roleName || u.role})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
