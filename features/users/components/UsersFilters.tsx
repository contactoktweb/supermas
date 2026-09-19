'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { UserFilters } from '../types'
import { SYSTEM_ROLES } from '../services/role-permissions'

interface UsersFiltersProps {
  filters: UserFilters
  locations: Array<{ id: string; code: string; name: string; type: string }>
  onUpdateFilter: (key: keyof UserFilters, value: any) => void
  onResetFilters: () => void
  isLoading?: boolean
}

export function UsersFilters({
  filters,
  locations,
  onUpdateFilter,
  onResetFilters,
  isLoading,
}: UsersFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.searchQuery || '')

  useEffect(() => {
    const timer = setTimeout(() => {
      onUpdateFilter('searchQuery', localSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch])

  const activeFiltersCount = [
    filters.role !== 'ALL' ? 1 : 0,
    filters.status !== 'ALL' ? 1 : 0,
    filters.locationId !== 'ALL' ? 1 : 0,
    filters.searchQuery?.trim() ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

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
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Buscador general */}
        <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
          <input
            type="text"
            placeholder="Buscar por nombre, usuario, email, teléfono o rol..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 6,
              border: '1px solid var(--line, #cbd5e1)',
              background: 'var(--surface, #ffffff)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              pointerEvents: 'none',
            }}
          >
            <AppIcon name="search" size={16} />
          </div>
          {localSearch && (
            <button
              type="button"
              onClick={() => setLocalSearch('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
              title="Limpiar búsqueda"
            >
              <AppIcon name="close" size={14} />
            </button>
          )}
        </div>

        {/* Filtro Rol Predefinido */}
        <div style={{ minWidth: 190 }}>
          <select
            value={filters.role || 'ALL'}
            onChange={(e) => onUpdateFilter('role', e.target.value)}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--line, #cbd5e1)',
              background: 'var(--surface, #ffffff)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          >
            <option value="ALL">Todos los roles</option>
            {Object.values(SYSTEM_ROLES).map((role) => (
              <option key={role.code} value={role.code}>
                {role.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro Bodega / Sede */}
        <div style={{ minWidth: 190 }}>
          <select
            value={filters.locationId || 'ALL'}
            onChange={(e) => onUpdateFilter('locationId', e.target.value)}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--line, #cbd5e1)',
              background: 'var(--surface, #ffffff)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          >
            <option value="ALL">Todas las sedes</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </select>
        </div>

        {/* Filtro Estado */}
        <div style={{ minWidth: 150 }}>
          <select
            value={filters.status || 'ALL'}
            onChange={(e) => onUpdateFilter('status', e.target.value)}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--line, #cbd5e1)',
              background: 'var(--surface, #ffffff)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          >
            <option value="ALL">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
          </select>
        </div>

        {/* Limpiar Filtros */}
        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setLocalSearch('')
              onResetFilters()
            }}
            disabled={isLoading}
            className="outline-button"
            style={{ padding: '8px 12px', fontSize: 13 }}
            title="Restablecer todos los filtros"
          >
            <AppIcon name="close" size={14} />
            <span>Limpiar ({activeFiltersCount})</span>
          </button>
        )}
      </div>
    </div>
  )
}
