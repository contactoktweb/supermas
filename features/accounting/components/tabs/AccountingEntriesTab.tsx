'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { AccountingEntry, AccountingFilters, AccountingVoucherType } from '../../types'
import { VoucherTypeBadge } from '../VoucherTypeBadge'
import { DatePicker } from '@/components/ui/DatePicker'
import { SelectField } from '@/components/ui/SelectField'
import { displayLabel, SOURCE_DOCUMENT_LABELS } from '@/lib/labels/display-labels'
import { formatIsoDateEs } from '../../utils/report-format'

interface AccountingEntriesTabProps {
  entries: AccountingEntry[]
  filters: AccountingFilters
  /** Catálogo de tipos de comprobante de la empresa (migración 064). */
  voucherTypes: AccountingVoucherType[]
  onFilterChange: (filters: Partial<AccountingFilters>) => void
  onSelectEntry: (entry: AccountingEntry) => void
}

export function AccountingEntriesTab({
  entries,
  filters,
  voucherTypes,
  onFilterChange,
  onSelectEntry,
}: AccountingEntriesTabProps) {
  // El filtro lista los tipos activos; si el seleccionado se desactivó, se conserva para poder quitarlo.
  const selectedVoucherType = filters.voucherTypeCode && filters.voucherTypeCode !== 'ALL' ? filters.voucherTypeCode : ''
  const voucherTypeOptions = voucherTypes.filter((vt) => vt.isActive || vt.code === selectedVoucherType)

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
      case 'CREDIT_NOTE':
      case 'DEBIT_NOTE':
        return <span className="badge badge-blue">{displayLabel(SOURCE_DOCUMENT_LABELS, sourceType)}</span>
      default:
        return <span className="badge badge-gray">{displayLabel(SOURCE_DOCUMENT_LABELS, sourceType)}</span>
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

  // El filtro por mes fija el rango completo del mes (YYYY-MM-01 a su último día).
  const selectedMonth =
    filters.dateFrom && filters.dateTo && filters.dateFrom.slice(0, 7) === filters.dateTo.slice(0, 7)
      ? filters.dateFrom.slice(0, 7)
      : ''

  const handleMonthChange = (value: string) => {
    if (!value) {
      onFilterChange({ dateFrom: undefined, dateTo: undefined, page: 1 })
      return
    }
    const [year, month] = value.split('-').map(Number)
    const lastDay = String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')
    onFilterChange({ dateFrom: `${value}-01`, dateTo: `${value}-${lastDay}`, page: 1 })
  }


  return (
    <div className="space-y-4 page-enter">
      {/* Barra de Filtros */}
      <div className="filters-bar grid w-full grid-cols-1 items-center gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1.5fr)_minmax(160px,1fr)_repeat(3,minmax(170px,1fr))]">
        <div className="search-box w-full!">
          <AppIcon name="search" size={16} />
          <input
            placeholder="Buscar por comprobante (ej: FC o FC-000012), tercero o descripción..."
            value={filters.query || ''}
            onChange={(e) => onFilterChange({ query: e.target.value })}
            aria-label="Buscar asientos por comprobante, tercero o descripción"
          />
        </div>

        <div className="flex items-center gap-1.5" title="Filtrar asientos por mes">
          <div className="min-w-0 flex-1">
            <DatePicker
              mode="month"
              value={selectedMonth}
              aria-label="Mes de los asientos"
              size="sm"
              onChange={(value) => handleMonthChange(value)}
            />
          </div>
          {selectedMonth && (
            <button
              type="button"
              className="icon-button"
              onClick={() => handleMonthChange('')}
              aria-label="Quitar filtro de mes"
              title="Todos los meses"
            >
              <AppIcon name="closeSimple" size={12} />
            </button>
          )}
        </div>

        <SelectField
          value={selectedVoucherType || 'ALL'}
          aria-label="Filtrar por tipo de comprobante"
          size="sm"
          onChange={(value) => onFilterChange({ voucherTypeCode: value })}
        >
          <option value="ALL">Todos los comprobantes</option>
          {voucherTypeOptions.map((vt) => (
            <option key={vt.id} value={vt.code}>
              {vt.code} — {vt.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          value={filters.sourceType || 'ALL'}
          aria-label="Filtrar por origen"
          size="sm"
          onChange={(value) => onFilterChange({ sourceType: value as any })}
        >
          <option value="ALL">Todos los orígenes</option>
          <option value="SALE">Ventas / Facturación</option>
          <option value="CREDIT_NOTE">Notas crédito</option>
          <option value="DEBIT_NOTE">Notas débito</option>
          <option value="PURCHASE">Compras de Mercancía</option>
          <option value="COST_OF_SALES">Costo de Ventas</option>
          <option value="CUSTOMER_PAYMENT">Recaudos de Clientes</option>
          <option value="SUPPLIER_PAYMENT">Pagos a Proveedores</option>
          <option value="MANUAL">Asientos Manuales</option>
          <option value="REVERSAL">Reversiones</option>
        </SelectField>

        <SelectField
          value={filters.entryStatus || 'ALL'}
          aria-label="Filtrar por estado"
          size="sm"
          onChange={(value) => onFilterChange({ entryStatus: value as any })}
        >
          <option value="ALL">Todos los estados</option>
          <option value="POSTED">Confirmados</option>
          <option value="DRAFT">Borradores</option>
          <option value="REVERSED">Reversados / Anulados</option>
        </SelectField>

      </div>

      {/* Tabla de Asientos Contables */}
      <div className="table-panel animated-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 170 }}>Comprobante</th>
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
                  <td colSpan={10} className="text-center py-12 text-gray-500">
                    <div className="font-bold text-sm text-gray-700 mb-1">
                      No existen movimientos contables
                    </div>
                    <div className="text-xs text-gray-400">
                      Los comprobantes de diario se listarán aquí una vez generadas transacciones en el sistema.
                    </div>
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
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <VoucherTypeBadge code={entry.voucherTypeCode} voucherTypes={voucherTypes} />
                        <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                          {entry.entryNumber}
                        </span>
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-700">{formatIsoDateEs(entry.date)}</span>
                        {entry.dueDate && (
                          <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 w-fit mt-0.5 font-medium" title="Fecha límite de vencimiento">
                            Vence: {entry.dueDate}
                          </span>
                        )}
                      </div>
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
