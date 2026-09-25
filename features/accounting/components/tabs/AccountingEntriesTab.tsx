'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { AccountingEntry, AccountingFilters } from '../../types'

interface AccountingEntriesTabProps {
  entries: AccountingEntry[]
  filters: AccountingFilters
  onFilterChange: (filters: Partial<AccountingFilters>) => void
  onSelectEntry: (entry: AccountingEntry) => void
  onOpenNewEntry: () => void
  canCreateEntry: boolean
}

export function AccountingEntriesTab({
  entries,
  filters,
  onFilterChange,
  onSelectEntry,
  onOpenNewEntry,
  canCreateEntry,
}: AccountingEntriesTabProps) {
  const getSourceTypeBadge = (sourceType: string) => {
    switch (sourceType) {
      case 'SALE':
        return <span className="badge badge-teal">Venta</span>
      case 'PURCHASE':
        return <span className="badge badge-blue">Compra</span>
      case 'COST_OF_SALES':
        return <span className="badge badge-amber">Costo de Ventas</span>
      case 'CUSTOMER_PAYMENT':
        return <span className="badge badge-teal">Recaudo</span>
      case 'SUPPLIER_PAYMENT':
        return <span className="badge badge-red">Pago Proveedor</span>
      case 'REVERSAL':
        return <span className="badge badge-purple">Reversión</span>
      default:
        return <span className="badge badge-gray">Manual</span>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'POSTED':
        return (
          <span className="badge badge-teal flex items-center gap-1">
            <AppIcon name="checkSimple" size={12} /> Confirmado
          </span>
        )
      case 'REVERSED':
        return (
          <span className="badge badge-red flex items-center gap-1">
            <AppIcon name="closeSimple" size={12} /> Anulado/Reversado
          </span>
        )
      default:
        return (
          <span className="badge badge-amber flex items-center gap-1">
            <AppIcon name="clock" size={12} /> Borrador
          </span>
        )
    }
  }

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

  return (
    <div className="space-y-4 page-enter">
      {/* Barra de Filtros */}
      <div className="filters-bar flex flex-wrap items-center justify-between gap-3">
        <div className="search-box flex-1 max-w-md">
          <AppIcon name="search" size={16} />
          <input
            placeholder="Buscar por comprobante (ej: AST-2026-000842), tercero o descripción..."
            value={filters.query || ''}
            onChange={(e) => onFilterChange({ query: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            className="filter-select text-xs"
            value={filters.sourceType || 'ALL'}
            onChange={(e) => onFilterChange({ sourceType: e.target.value as any })}
          >
            <option value="ALL">Todos los orígenes</option>
            <option value="SALE">Ventas / Facturación</option>
            <option value="PURCHASE">Compras de Mercancía</option>
            <option value="COST_OF_SALES">Costo de Ventas</option>
            <option value="CUSTOMER_PAYMENT">Recaudos de Clientes</option>
            <option value="SUPPLIER_PAYMENT">Pagos a Proveedores</option>
            <option value="MANUAL">Asientos Manuales</option>
            <option value="REVERSAL">Reversiones</option>
          </select>

          <select
            className="filter-select text-xs"
            value={filters.entryStatus || 'ALL'}
            onChange={(e) => onFilterChange({ entryStatus: e.target.value as any })}
          >
            <option value="ALL">Todos los estados</option>
            <option value="POSTED">Confirmados</option>
            <option value="DRAFT">Borradores</option>
            <option value="REVERSED">Reversados / Anulados</option>
          </select>

          {canCreateEntry && (
            <button
              type="button"
              className="primary-button text-xs py-1.5"
              onClick={onOpenNewEntry}
            >
              <AppIcon name="plus" size={14} />
              <span>Nuevo Asiento</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Asientos Contables */}
      <div className="table-panel animated-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 140 }}>Comprobante</th>
                <th style={{ width: 140 }}>Fecha</th>
                <th style={{ width: 110 }}>Origen</th>
                <th style={{ width: 130 }}>Doc. Origen</th>
                <th>Descripción y Tercero</th>
                <th style={{ width: 120, textAlign: 'right' }}>Total Debe</th>
                <th style={{ width: 120, textAlign: 'right' }}>Total Haber</th>
                <th style={{ width: 90, textAlign: 'center' }}>Partida Doble</th>
                <th style={{ width: 130 }}>Estado</th>
                <th style={{ width: 80, textAlign: 'right' }}>Ver</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-500">
                    No existen comprobantes o movimientos contables para este periodo.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    onClick={() => onSelectEntry(entry)}
                  >
                    <td>
                      <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                        {entry.entryNumber}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-gray-600">{formatDate(entry.date)}</span>
                    </td>
                    <td>{getSourceTypeBadge(entry.sourceType)}</td>
                    <td>
                      <span className="font-mono text-xs text-gray-700">
                        {entry.documentNumber || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-900 line-clamp-1">
                          {entry.description}
                        </span>
                        {entry.thirdPartyName && (
                          <span className="text-[11px] text-gray-500">
                            {entry.thirdPartyName} {entry.thirdPartyDoc ? `(${entry.thirdPartyDoc})` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        ${entry.totalDebit.toLocaleString('es-CO')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        ${entry.totalCredit.toLocaleString('es-CO')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {entry.isBalanced ? (
                        <span
                          className="inline-flex items-center text-emerald-600 text-xs font-medium"
                          title="Partida doble cuadrada: Total Débito == Total Crédito"
                        >
                          <AppIcon name="check" size={16} />
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center text-rose-600 text-xs font-medium"
                          title="Descuadre contable detectado"
                        >
                          <AppIcon name="warning" size={16} />
                        </span>
                      )}
                    </td>
                    <td>{getStatusBadge(entry.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="icon-button"
                        title="Ver detalle del comprobante contable"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectEntry(entry)
                        }}
                      >
                        <AppIcon name="eye" size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
