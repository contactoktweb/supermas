'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { AccountingAccount, AccountClass, AccountingFilters, AccountNature } from '../../types'

interface AccountingAccountsTabProps {
  accounts: AccountingAccount[]
  filters: AccountingFilters
  onFilterChange: (filters: Partial<AccountingFilters>) => void
  onOpenNewAccount: () => void
  onInspectAccount: (accountId: string) => void
  onUpdateNature?: (accountId: string, nature: AccountNature) => Promise<void>
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
  onUpdateNature,
  canManageAccounts,
}: AccountingAccountsTabProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const handleNatureChange = async (accountId: string, newNature: AccountNature) => {
    if (!onUpdateNature || updatingId) return
    try {
      setUpdatingId(accountId)
      await onUpdateNature(accountId, newNature)
    } finally {
      setUpdatingId(null)
    }
  }
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
            value={filters.level || 'ALL'}
            onChange={(e) => onFilterChange({ level: e.target.value as any })}
          >
            <option value="ALL">Todos los niveles</option>
            <option value="IMPUTABLE">Solo Imputables (Subcuentas y Auxiliares)</option>
            <option value="ACCOUNT">Nivel 3: Cuentas Mayor</option>
            <option value="SUBACCOUNT">Nivel 4: Subcuentas</option>
            <option value="AUXILIARY">Nivel 5: Auxiliares (ej: 111005.01)</option>
          </select>

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
                <th style={{ width: 130 }}>Código</th>
                <th>Nombre de la Cuenta</th>
                <th style={{ width: 100 }}>Clase PUC</th>
                <th style={{ width: 95 }}>Naturaleza</th>
                <th style={{ width: 130 }}>Nivel</th>
                <th style={{ width: 110 }}>Uso Operativo</th>
                <th style={{ width: 140, textAlign: 'right' }}>Saldo Actual</th>
                <th style={{ width: 85 }}>Estado</th>
                <th style={{ width: 80, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-500">
                    No se encontraron cuentas contables que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => {
                  const isClassLevel = acc.level === 'CLASS' || acc.level === 'GROUP'
                  const isAccountLevel = acc.level === 'ACCOUNT'
                  const isSubaccount = acc.level === 'SUBACCOUNT'
                  const isAuxiliary = acc.level === 'AUXILIARY' || acc.code.includes('.')
                  const isImputable = isSubaccount || isAuxiliary

                  return (
                    <tr
                      key={acc.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isClassLevel
                          ? 'bg-gray-100/70 font-bold'
                          : isAccountLevel
                          ? 'bg-gray-50/50 font-semibold'
                          : ''
                      }`}
                    >
                      <td>
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded inline-block ${
                            isAuxiliary
                              ? 'text-emerald-900 bg-emerald-50 border border-emerald-300 ml-4'
                              : isSubaccount
                              ? 'text-blue-900 bg-blue-50 border border-blue-200 ml-2'
                              : isAccountLevel
                              ? 'text-gray-800 bg-gray-100 border border-gray-300'
                              : 'text-gray-900 bg-gray-200'
                          }`}
                        >
                          {acc.code}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span
                            className={`text-xs ${
                              isClassLevel
                                ? 'text-gray-900 font-bold'
                                : isAccountLevel
                                ? 'text-gray-900 font-semibold'
                                : isAuxiliary
                                ? 'text-emerald-950 font-medium pl-3'
                                : 'text-gray-800 font-medium pl-1'
                            }`}
                          >
                            {isAuxiliary && (
                              <AppIcon name="chevronRight" size={12} className="inline-block mr-0.5 align-middle" aria-hidden="true" />
                            )}
                            {acc.name}
                          </span>
                          {acc.description && (
                            <span className="text-[11px] text-gray-400 line-clamp-1 pl-1">
                              {acc.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="text-xs text-gray-600">
                          Clase {acc.accountClass}
                        </span>
                      </td>
                      <td>
                        {canManageAccounts && onUpdateNature ? (
                          <div className="relative inline-flex items-center">
                            <select
                              value={acc.nature}
                              disabled={updatingId === acc.id}
                              onChange={(e) => handleNatureChange(acc.id, e.target.value as AccountNature)}
                              className={`text-[11px] font-bold py-1 px-2 pr-5 rounded-md border appearance-none cursor-pointer transition-all shadow-2xs ${
                                acc.nature === 'DEBIT'
                                  ? 'bg-blue-50/90 text-blue-900 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                                  : 'bg-amber-50/90 text-amber-900 border-amber-200 hover:bg-amber-100 hover:border-amber-300'
                              } ${updatingId === acc.id ? 'opacity-50 cursor-wait' : ''}`}
                              title={`Naturaleza: ${acc.nature === 'DEBIT' ? 'Débito' : 'Crédito'}. Haz clic para cambiar.`}
                            >
                              <option value="DEBIT">Débito</option>
                              <option value="CREDIT">Crédito</option>
                            </select>
                            <span className="pointer-events-none absolute right-1.5 text-slate-400" aria-hidden="true">
                              <AppIcon name="chevronDown" size={10} />
                            </span>
                          </div>
                        ) : (
                          <span
                            className={`badge text-[11px] font-semibold ${
                              acc.nature === 'DEBIT' ? 'badge-blue' : 'badge-amber'
                            }`}
                          >
                            {acc.nature === 'DEBIT' ? 'Débito' : 'Crédito'}
                          </span>
                        )}
                      </td>
                      <td>
                        {isAuxiliary ? (
                          <span
                            className="badge text-[10px] font-bold"
                            style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}
                          >
                            Auxiliar (Nivel 5)
                          </span>
                        ) : isSubaccount ? (
                          <span className="badge badge-blue text-[10px] font-semibold">
                            Subcuenta (Nivel 4)
                          </span>
                        ) : isAccountLevel ? (
                          <span className="badge badge-gray text-[10px] font-medium text-gray-600">
                            Cuenta Mayor (Nivel 3)
                          </span>
                        ) : (
                          <span className="badge badge-gray text-[10px] uppercase font-medium">
                            {acc.level}
                          </span>
                        )}
                      </td>
                      <td>
                        {isImputable ? (
                          <span
                            className="badge text-[10px] font-semibold inline-flex items-center gap-1"
                            style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                            title="Esta subcuenta/auxiliar se puede utilizar directamente en asientos contables"
                          >
                            <AppIcon name="check" size={11} className="text-blue-700" />
                            <span>Imputable</span>
                          </span>
                        ) : (
                          <span
                            className="badge text-[10px] font-medium text-gray-500 inline-flex items-center gap-1"
                            style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0' }}
                            title="Cuenta de resumen/mayor. No admite imputación directa."
                          >
                            <AppIcon name="layers" size={11} className="text-slate-400" />
                            <span>No Imputable</span>
                          </span>
                        )}
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
