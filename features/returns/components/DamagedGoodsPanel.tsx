'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { returnService } from '../services/return.service'
import {
  DamagedGoodsDestination,
  DamagedGoodsStatus,
  DamagedReturnItem,
  DamagedReturnListResult,
} from '../types'
import { DAMAGED_DESTINATION_LABELS, DAMAGED_STATUS_LABELS } from '../constants'
import { DispatchDamagedModal } from './DispatchDamagedModal'
import { SelectField } from '@/components/ui/SelectField'

const PAGE_SIZE = 15
const SEARCH_DEBOUNCE_MS = 300

type DestinationFilter = DamagedGoodsDestination | 'ALL'
type StatusFilter = DamagedGoodsStatus | 'ALL'

const DESTINATION_FILTERS: { value: DestinationFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos los destinos' },
  { value: 'PROVEEDOR', label: DAMAGED_DESTINATION_LABELS.PROVEEDOR },
  { value: 'PRODUCCION', label: DAMAGED_DESTINATION_LABELS.PRODUCCION },
]

const formatMoney = (value: number) => `$${Math.round(value).toLocaleString('es-CO')}`
const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: 'short', day: '2-digit' })

function destinationDetail(item: DamagedReturnItem): string {
  if (item.destination === 'PROVEEDOR') {
    return [item.supplierName, item.purchaseNumber ? `compra ${item.purchaseNumber}` : null].filter(Boolean).join(' · ')
  }
  return item.productionLocationName || item.dispositionNotes || 'Sin sede'
}

function StatusBadge({ status }: { status: DamagedGoodsStatus }) {
  const isPending = status === 'PENDIENTE'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        isPending ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      <AppIcon name={isPending ? 'clock' : 'check'} size={13} />
      {DAMAGED_STATUS_LABELS[status]}
    </span>
  )
}

function DestinationBadge({ destination }: { destination: DamagedGoodsDestination }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
      <AppIcon name={destination === 'PROVEEDOR' ? 'suppliers' : 'warehouse'} size={13} />
      {DAMAGED_DESTINATION_LABELS[destination]}
    </span>
  )
}

/** Listado "Productos en mal estado por destino" con acción de marcar como enviado. */
export function DamagedGoodsPanel() {
  const [destination, setDestination] = useState<DestinationFilter>('ALL')
  const [status, setStatus] = useState<StatusFilter>('PENDIENTE')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [result, setResult] = useState<DamagedReturnListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dispatchItem, setDispatchItem] = useState<DamagedReturnItem | null>(null)
  const [dispatching, setDispatching] = useState(false)
  const [dispatchError, setDispatchError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await returnService.listDamagedItems({ destination, status, query: search, page, pageSize: PAGE_SIZE })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el listado de productos en mal estado.')
    } finally {
      setLoading(false)
    }
  }, [destination, status, search, page])

  useEffect(() => {
    load()
  }, [load])

  const handleConfirmDispatch = async (values: { dispatchReference: string; notes: string }) => {
    if (!dispatchItem) return
    try {
      setDispatching(true)
      setDispatchError(null)
      const res = await returnService.dispatchDamagedItem({
        returnItemId: dispatchItem.id,
        dispatchReference: values.dispatchReference,
        notes: values.notes,
      })
      const base = res.alreadyDispatched
        ? `La línea de ${dispatchItem.productName} ya estaba marcada como enviada.`
        : `${dispatchItem.productName} (${dispatchItem.returnCode}) quedó marcado como enviado.`
      const accounting = res.accountingEntryNumber
        ? ` Comprobante ${res.accountingEntryNumber}.`
        : res.accountingNote
          ? ` ${res.accountingNote}`
          : ''
      setSuccessMessage(base + accounting)
      setDispatchItem(null)
      await load()
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : 'No se pudo marcar como enviado.')
    } finally {
      setDispatching(false)
    }
  }

  const rows = result?.data ?? []
  const total = result?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const showCost = result?.showCost ?? false
  const summary = result?.summary

  const summaryCards = [
    { label: 'Pendiente a proveedor', value: `${summary?.pendingSupplierUnits ?? 0} und`, icon: 'suppliers' as const, tone: 'border-amber-100 bg-amber-50/50 text-amber-800' },
    { label: 'Pendiente a producción', value: `${summary?.pendingProductionUnits ?? 0} und`, icon: 'warehouse' as const, tone: 'border-blue-100 bg-blue-50/50 text-blue-800' },
    { label: 'Líneas pendientes', value: String(summary?.pendingLines ?? 0), icon: 'clock' as const, tone: 'border-slate-200 bg-white text-slate-800' },
    { label: 'Líneas enviadas', value: String(summary?.sentLines ?? 0), icon: 'check' as const, tone: 'border-emerald-100 bg-emerald-50/50 text-emerald-800' },
  ]

  return (
    <section aria-labelledby="damaged-goods-title" className="space-y-4 motion-safe:animate-in motion-safe:fade-in">
      <div className="flex flex-col gap-1">
        <h2 id="damaged-goods-title" className="text-lg font-bold text-slate-900">
          Productos en mal estado por destino
        </h2>
        <p className="text-sm text-slate-500">
          Mercancía devuelta por clientes que no reingresó al inventario vendible: pendiente de enviar a producción o de
          devolver al proveedor.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${card.tone}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">{card.label}</span>
              <AppIcon name={card.icon} size={18} />
            </div>
            <p className="mt-2 text-xl font-bold">{loading && !result ? '...' : card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <AppIcon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <label htmlFor="damaged-search" className="sr-only">
            Buscar productos en mal estado
          </label>
          <input
            id="damaged-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por devolución, venta, producto o proveedor..."
            className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por destino">
          {DESTINATION_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={destination === f.value}
              onClick={() => {
                setDestination(f.value)
                setPage(1)
              }}
              className={`h-10 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 motion-reduce:transition-none ${
                destination === f.value
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="damaged-status" className="text-sm text-slate-600">
            Estado
          </label>
          <SelectField
            id="damaged-status"
            value={status}
            size="sm"
            onChange={(value) => {
              setStatus(value as StatusFilter)
              setPage(1)
            }}
          >
            <option value="PENDIENTE">{DAMAGED_STATUS_LABELS.PENDIENTE}</option>
            <option value="ENVIADO">{DAMAGED_STATUS_LABELS.ENVIADO}</option>
            <option value="ALL">Todos los estados</option>
          </SelectField>
        </div>
      </div>

      {successMessage && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 motion-safe:animate-in motion-safe:fade-in"
        >
          <span className="flex items-start gap-2">
            <AppIcon name="check" size={18} />
            {successMessage}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="rounded p-0.5 text-emerald-700 hover:bg-emerald-100"
            aria-label="Cerrar mensaje"
          >
            <AppIcon name="closeSimple" size={16} />
          </button>
        </div>
      )}

      {error ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2">
            <AppIcon name="warning" size={18} />
            {error}
          </span>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-300 bg-white px-3 font-medium text-red-700 transition-colors hover:bg-red-100 motion-reduce:transition-none"
          >
            <AppIcon name="refresh" size={15} />
            Reintentar
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-2" role="status" aria-label="Cargando productos en mal estado">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-slate-100 motion-safe:animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          <AppIcon name="package" size={28} className="text-slate-400" />
          <p>No hay productos en mal estado con estos filtros.</p>
        </div>
      ) : (
        <>
          {/* Escritorio */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Devolución</th>
                    <th scope="col" className="px-4 py-3">Producto</th>
                    <th scope="col" className="px-4 py-3 text-right">Cant.</th>
                    {showCost && <th scope="col" className="px-4 py-3 text-right">Costo</th>}
                    <th scope="col" className="px-4 py-3">Destino</th>
                    <th scope="col" className="px-4 py-3">Estado</th>
                    <th scope="col" className="px-4 py-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((item) => (
                    <tr key={item.id} className="align-top transition-colors hover:bg-slate-50/70 motion-reduce:transition-none">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{item.returnCode}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(item.returnDate)}
                          {item.saleNumber ? ` · Venta ${item.saleNumber}` : ''}
                        </p>
                        {item.locationName && <p className="text-xs text-slate-500">{item.locationName}</p>}
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <p className="font-medium text-slate-900">{item.productName}</p>
                        <p className="text-xs text-slate-500">{item.sku}</p>
                        {item.reason && (
                          <p className="mt-1 truncate text-xs text-slate-500" title={item.reason}>
                            Motivo: {item.reason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{item.quantity}</td>
                      {showCost && (
                        <td className="px-4 py-3 text-right text-slate-700">
                          {item.totalCost !== null ? formatMoney(item.totalCost) : '-'}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <DestinationBadge destination={item.destination} />
                        <p className="mt-1 text-xs text-slate-600">{destinationDetail(item)}</p>
                        {item.returnEntryNumber && <p className="text-xs text-slate-500">DV: {item.returnEntryNumber}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                        {item.dispatchedAt && (
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(item.dispatchedAt)}
                            {item.dispatchedByName ? ` · ${item.dispatchedByName}` : ''}
                          </p>
                        )}
                        {item.dispatchReference && <p className="text-xs text-slate-500">Ref: {item.dispatchReference}</p>}
                        {item.dispatchEntryNumber && <p className="text-xs text-slate-500">DC: {item.dispatchEntryNumber}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.status === 'PENDIENTE' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDispatchError(null)
                              setDispatchItem(item)
                            }}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-700 px-3 text-xs font-medium text-white transition-colors hover:bg-blue-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 motion-reduce:transition-none motion-reduce:active:scale-100"
                          >
                            <AppIcon name="arrowUpRight" size={14} />
                            Marcar enviado
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Sin acciones</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Móvil */}
          <ul className="space-y-3 md:hidden">
            {rows.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{item.productName}</p>
                    <p className="text-xs text-slate-500">
                      {item.returnCode} · {formatDate(item.returnDate)}
                    </p>
                  </div>
                  <span className="shrink-0 text-lg font-bold text-slate-900">{item.quantity}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <DestinationBadge destination={item.destination} />
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-2 text-xs text-slate-600">{destinationDetail(item)}</p>
                {showCost && item.totalCost !== null && (
                  <p className="text-xs text-slate-500">Costo: {formatMoney(item.totalCost)}</p>
                )}
                {item.dispatchedAt && (
                  <p className="text-xs text-slate-500">
                    Enviado {formatDate(item.dispatchedAt)}
                    {item.dispatchedByName ? ` por ${item.dispatchedByName}` : ''}
                  </p>
                )}
                {item.status === 'PENDIENTE' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDispatchError(null)
                      setDispatchItem(item)
                    }}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 text-sm font-medium text-white transition-colors hover:bg-blue-800 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <AppIcon name="arrowUpRight" size={16} />
                    Marcar como enviado
                  </button>
                )}
              </li>
            ))}
          </ul>

          <nav className="flex items-center justify-between gap-3 text-sm text-slate-600" aria-label="Paginación de productos en mal estado">
            <span>
              {total} {total === 1 ? 'línea' : 'líneas'} · Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white transition-colors hover:bg-slate-50 disabled:opacity-40 motion-reduce:transition-none"
                aria-label="Página anterior"
              >
                <AppIcon name="chevronLeft" size={16} />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white transition-colors hover:bg-slate-50 disabled:opacity-40 motion-reduce:transition-none"
                aria-label="Página siguiente"
              >
                <AppIcon name="chevronRight" size={16} />
              </button>
            </div>
          </nav>
        </>
      )}

      {dispatchItem && (
        <DispatchDamagedModal
          item={dispatchItem}
          submitting={dispatching}
          error={dispatchError}
          onCancel={() => setDispatchItem(null)}
          onConfirm={handleConfirmDispatch}
        />
      )}
    </section>
  )
}
