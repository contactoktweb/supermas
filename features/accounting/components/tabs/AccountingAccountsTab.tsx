'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { AccountingAccount, AccountClass, AccountingFilters } from '../../types'

interface AccountingAccountsTabProps {
  accounts: AccountingAccount[]
  filters: AccountingFilters
  onFilterChange: (filters: Partial<AccountingFilters>) => void
  onOpenNewAccount: () => void
  onInspectAccount: (accountId: string) => void
  canManageAccounts: boolean
}

const PUC_CLASSES: { classNum: AccountClass; label: string; name: string }[] = [
  { classNum: 1, label: 'Clase 1', name: 'Activos' },
  { classNum: 2, label: 'Clase 2', name: 'Pasivos' },
  { classNum: 3, label: 'Clase 3', name: 'Patrimonio' },
  { classNum: 4, label: 'Clase 4', name: 'Ingresos' },
  { classNum: 5, label: 'Clase 5', name: 'Gastos' },
  { classNum: 6, label: 'Clase 6', name: 'Costos de Venta' },
  { classNum: 7, label: 'Clase 7', name: 'Costos de Producción' },
]

export function AccountingAccountsTab({
  accounts,
  filters,
  onFilterChange,
  onOpenNewAccount,
  onInspectAccount,
  canManageAccounts,
}: AccountingAccountsTabProps) {
  return (
    <div className="space-y-4 page-enter">
      {/* Selector de Clases del PUC Colombia */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-gray-100">
        <button
          type="button"
          className={`px-3 py-1.5 text-xs rounded-full font-medium transition-all ${
            filters.accountClass === 'ALL'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => onFilterChange({ accountClass: 'ALL' })}
        >
          Todas las clases
        </button>
        {PUC_CLASSES.map((cls) => {
          const isActive = filters.accountClass === cls.classNum
          return (
            <button
              key={cls.classNum}
              type="button"
              className={`px-3 py-1.5 text-xs rounded-full font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => onFilterChange({ accountClass: cls.classNum })}
            >
              <span className="font-bold mr-1">{cls.label}:</span>
              <span>{cls.name}</span>
            </button>
          )
        })}
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="filters-bar flex flex-wrap items-center justify-between gap-3">
        <div className="search-box flex-1 max-w-md">
          <AppIcon name="search" size={16} />
          <input
            placeholder="Buscar por código (ej: 1435) o nombre de cuenta..."
            value={filters.query || ''}
            onChange={(e) => onFilterChange({ query: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            className="filter-select text-xs"
            value={filters.nature || 'ALL'}
            onChange={(e) => onFilterChange({ nature: e.target.value as any })}
          >
            <option value="ALL">Todas las naturalezas</option>
            <option value="DEBIT">Naturaleza Débito</option>
            <option value="CREDIT">Naturaleza Crédito</option>
          </select>

          {canManageAccounts && (
            <button
              type="button"
              className="primary-button text-xs py-1.5"
              onClick={onOpenNewAccount}
            >
              <AppIcon name="plus" size={14} />
              <span>Nueva Cuenta PUC</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabla del Plan Único de Cuentas */}
      <div className="table-panel animated-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 120 }}>Código</th>
                <th>Nombre de la Cuenta</th>
                <th style={{ width: 120 }}>Clase PUC</th>
                <th style={{ width: 100 }}>Naturaleza</th>
                <th style={{ width: 110 }}>Nivel</th>
                <th style={{ width: 150, textAlign: 'right' }}>Saldo Actual</th>
                <th style={{ width: 90 }}>Estado</th>
                <th style={{ width: 100, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No se encontraron cuentas contables que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => {
                  const isClassLevel = acc.level === 'CLASS' || acc.level === 'GROUP'
                  return (
                    <tr
                      key={acc.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isClassLevel ? 'bg-gray-50/60 font-semibold' : ''
                      }`}
                    >
                      <td>
                        <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                          {acc.code}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className={`text-xs ${isClassLevel ? 'text-gray-900 font-bold' : 'text-gray-800'}`}>
                            {acc.name}
                          </span>
                          {acc.description && (
                            <span className="text-[11px] text-gray-400 line-clamp-1">{acc.description}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="text-xs text-gray-600">
                          Clase {acc.accountClass}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge text-[11px] font-semibold ${
                            acc.nature === 'DEBIT' ? 'badge-blue' : 'badge-amber'
                          }`}
                        >
                          {acc.nature === 'DEBIT' ? 'Débito' : 'Crédito'}
                        </span>
                      </td>
                      <td>
                        <span className="text-[11px] text-gray-500 uppercase">{acc.level}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-xs font-semibold text-gray-900">
                          ${acc.balance.toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge text-[11px] font-medium ${
                            acc.status === 'ACTIVE' ? 'badge-teal' : 'badge-gray'
                          }`}
                        >
                          {acc.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="icon-button"
                          title="Consultar movimientos en el Libro Mayor"
                          onClick={() => onInspectAccount(acc.id)}
                        >
                          <AppIcon name="eye" size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
