'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { AccountingMovement, AccountingFilters, AccountingAccount } from '../../types'
import { db } from '@/lib/supabase/db'

interface AccountingMovementsTabProps {
  movements: AccountingMovement[]
  accounts: AccountingAccount[]
  filters: AccountingFilters
  onFilterChange: (filters: Partial<AccountingFilters>) => void
}

export function AccountingMovementsTab({
  movements,
  accounts,
  filters,
  onFilterChange,
}: AccountingMovementsTabProps) {
  const locations = db.locations || []

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

  return (
    <div className="space-y-4 page-enter">
      {/* Filtros para Libro Auxiliar */}
      <div className="filters-bar flex flex-wrap items-center justify-between gap-3">
        <div className="search-box flex-1 max-w-sm">
          <AppIcon name="search" size={16} />
          <input
            placeholder="Buscar en movimientos o terceros..."
            value={filters.query || ''}
            onChange={(e) => onFilterChange({ query: e.target.value })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por Cuenta */}
          <select
            className="filter-select text-xs max-w-[200px]"
            value={filters.accountId || 'ALL'}
            onChange={(e) => onFilterChange({ accountId: e.target.value })}
          >
            <option value="ALL">Todas las cuentas</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} - {acc.name}
              </option>
            ))}
          </select>

          {/* Filtro por Módulo Origen */}
          <select
            className="filter-select text-xs"
            value={filters.sourceType || 'ALL'}
            onChange={(e) => onFilterChange({ sourceType: e.target.value as any })}
          >
            <option value="ALL">Todos los orígenes</option>
            <option value="SALE">Ventas</option>
            <option value="PURCHASE">Compras</option>
            <option value="COST_OF_SALES">Costo de Ventas</option>
            <option value="CUSTOMER_PAYMENT">Recaudos</option>
            <option value="SUPPLIER_PAYMENT">Pagos</option>
            <option value="MANUAL">Manuales</option>
          </select>

          {/* Filtro por Bodega */}
          <select
            className="filter-select text-xs"
            value={filters.locationId || 'ALL'}
            onChange={(e) => onFilterChange({ locationId: e.target.value })}
          >
            <option value="ALL">Todas las bodegas</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla del Libro Auxiliar de Movimientos */}
      <div className="table-panel animated-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Fecha</th>
                <th style={{ width: 130 }}>Doc. Origen</th>
                <th style={{ width: 110 }}>Cuenta</th>
                <th>Descripción y Cuenta Contable</th>
                <th style={{ width: 160 }}>Tercero</th>
                <th style={{ width: 140 }}>Bodega / Centro</th>
                <th style={{ width: 120, textAlign: 'right' }}>Débito</th>
                <th style={{ width: 120, textAlign: 'right' }}>Crédito</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No hay movimientos contables registrados con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                movements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-blue-50/40 transition-colors">
                    <td>
                      <span className="text-xs text-gray-600">{formatDate(mov.date)}</span>
                    </td>
                    <td>
                      <span className="font-mono text-xs font-bold text-gray-800">
                        {mov.sourceDocumentNumber || mov.entryNumber}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-xs font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                        {mov.accountCode}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-900 font-medium">{mov.description}</span>
                        <span className="text-[11px] text-gray-500">{mov.accountName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs text-gray-700">{mov.thirdPartyName || '—'}</span>
                    </td>
                    <td>
                      <span className="text-xs text-gray-600">{mov.locationName || 'Bodega Principal'}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {mov.debit > 0 ? (
                        <span className="font-mono text-xs font-semibold text-blue-900">
                          ${mov.debit.toLocaleString('es-CO')}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {mov.credit > 0 ? (
                        <span className="font-mono text-xs font-semibold text-gray-900">
                          ${mov.credit.toLocaleString('es-CO')}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
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
