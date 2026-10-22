'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ScrollableTabs } from '@/components/ui/ScrollableTabs'
import { returnService } from '../services/return.service'
import { ReturnDispositionOptions, ReturnRecord, ReturnStats, ReturnType } from '../types'
import { DAMAGED_DESTINATION_LABELS, DAMAGED_STATUS_LABELS, RETURN_ITEM_CONDITION_LABELS } from '../constants'
import { CustomerReturnFormLine, CustomerReturnLineEditor } from './CustomerReturnLineEditor'
import { DamagedGoodsPanel } from './DamagedGoodsPanel'
import { SelectField } from '@/components/ui/SelectField'

interface ReturnsPageProps {
  onNavigate?: (view: string) => void
}

type ReturnsTab = 'returns' | 'damaged'

interface SupplierReturnFormItem {
  productId: string
  name: string
  sku: string
  maxQuantity: number
  quantity: number
}

const TABS: { id: ReturnsTab; label: string; icon: 'returns' | 'warning' }[] = [
  { id: 'returns', label: 'Devoluciones', icon: 'returns' },
  { id: 'damaged', label: 'Mal estado por destino', icon: 'warning' },
]

let lineKeySequence = 0
const nextLineKey = () => `line-${++lineKeySequence}`

export function ReturnsPage(_props: ReturnsPageProps) {
  const [activeTab, setActiveTab] = useState<ReturnsTab>('returns')

  const [returnsList, setReturnsList] = useState<ReturnRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [stats, setStats] = useState<ReturnStats | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<ReturnType | 'ALL'>('ALL')
  const [page] = useState(1)

  // Modals & Detail
  const [selectedRecord, setSelectedRecord] = useState<ReturnRecord | null>(null)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)

  // Returnable Sources
  const [returnableSales, setReturnableSales] = useState<any[]>([])
  const [returnablePurchases, setReturnablePurchases] = useState<any[]>([])
  const [loadingSources, setLoadingSources] = useState(false)
  const [sourcesError, setSourcesError] = useState<string | null>(null)

  // Form states
  const [selectedSaleId, setSelectedSaleId] = useState('')
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('')
  const [customerLines, setCustomerLines] = useState<CustomerReturnFormLine[]>([])
  const [supplierItems, setSupplierItems] = useState<SupplierReturnFormItem[]>([])
  const [formReason, setFormReason] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Destino de productos en mal estado (proveedores, sedes y sugerencias de la venta seleccionada)
  const [dispositionOptions, setDispositionOptions] = useState<ReturnDispositionOptions | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setListError(null)
      const [listRes, statsRes] = await Promise.all([
        returnService.list({
          query: searchQuery,
          returnType: selectedType,
          page,
          pageSize: 15,
        }),
        returnService.getStats(),
      ])
      setReturnsList(listRes.data)
      setStats(statsRes)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'No se pudieron cargar las devoluciones.')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedType, page])

  useEffect(() => {
    if (activeTab === 'returns') loadData()
  }, [loadData, activeTab])

  const resetForm = () => {
    setFormError(null)
    setSourcesError(null)
    setFormReason('')
    setFormNotes('')
  }

  const openCustomerModal = async () => {
    try {
      setLoadingSources(true)
      resetForm()
      setSelectedSaleId('')
      setCustomerLines([])
      setDispositionOptions(null)
      setOptionsError(null)
      const sales = await returnService.getReturnableSales()
      setReturnableSales(sales)
      setIsCustomerModalOpen(true)
    } catch (err) {
      setSourcesError(`Error al cargar ventas para devolución: ${err instanceof Error ? err.message : 'error desconocido'}`)
    } finally {
      setLoadingSources(false)
    }
  }

  const openSupplierModal = async () => {
    try {
      setLoadingSources(true)
      resetForm()
      setSelectedPurchaseId('')
      setSupplierItems([])
      const purchases = await returnService.getReturnablePurchases()
      setReturnablePurchases(purchases)
      setIsSupplierModalOpen(true)
    } catch (err) {
      setSourcesError(`Error al cargar compras para devolución: ${err instanceof Error ? err.message : 'error desconocido'}`)
    } finally {
      setLoadingSources(false)
    }
  }

  const loadDispositionOptions = async (saleId: string) => {
    try {
      setOptionsLoading(true)
      setOptionsError(null)
      setDispositionOptions(await returnService.getDispositionOptions(saleId))
    } catch (err) {
      setDispositionOptions(null)
      setOptionsError(err instanceof Error ? err.message : 'No se pudieron cargar proveedores y sedes.')
    } finally {
      setOptionsLoading(false)
    }
  }

  const handleSaleSelect = (saleId: string) => {
    setSelectedSaleId(saleId)
    setFormError(null)
    const sale = returnableSales.find((s) => s.id === saleId)
    if (sale && sale.items) {
      setCustomerLines(
        sale.items.map((it: any) => ({
          key: nextLineKey(),
          productId: it.product_id,
          name: it.product?.name || 'Producto',
          sku: it.product?.sku || '',
          soldQuantity: Number(it.quantity || 0),
          quantity: 1,
          condition: 'BUENO',
        }))
      )
      loadDispositionOptions(saleId)
    } else {
      setCustomerLines([])
      setDispositionOptions(null)
    }
  }

  const handlePurchaseSelect = (purchaseId: string) => {
    setSelectedPurchaseId(purchaseId)
    setFormError(null)
    const pur = returnablePurchases.find((p) => p.id === purchaseId)
    if (pur && pur.items) {
      setSupplierItems(
        pur.items.map((it: any) => ({
          productId: it.product_id,
          name: it.product?.name || 'Producto',
          sku: it.product?.sku || '',
          maxQuantity: Number(it.received_quantity || it.quantity || 0),
          quantity: 1,
        }))
      )
    } else {
      setSupplierItems([])
    }
  }

  const updateCustomerLine = (key: string, patch: Partial<CustomerReturnFormLine>) => {
    setCustomerLines((lines) => lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const splitCustomerLine = (key: string) => {
    setCustomerLines((lines) => {
      const idx = lines.findIndex((l) => l.key === key)
      if (idx < 0) return lines
      const base = lines[idx]
      const extra: CustomerReturnFormLine = {
        key: nextLineKey(),
        productId: base.productId,
        name: base.name,
        sku: base.sku,
        soldQuantity: base.soldQuantity,
        quantity: 0,
        condition: base.condition === 'BUENO' ? 'MAL_ESTADO' : 'BUENO',
      }
      return [...lines.slice(0, idx + 1), extra, ...lines.slice(idx + 1)]
    })
  }

  const removeCustomerLine = (key: string) => {
    setCustomerLines((lines) => lines.filter((l) => l.key !== key))
  }

  // Unidades por producto ya asignadas en las líneas del formulario (tope: lo vendido)
  const unitsByProduct = useMemo(() => {
    const map = new Map<string, number>()
    customerLines.forEach((l) => map.set(l.productId, (map.get(l.productId) || 0) + (Number(l.quantity) || 0)))
    return map
  }, [customerLines])

  const firstLineKeyByProduct = useMemo(() => {
    const map = new Map<string, string>()
    customerLines.forEach((l) => {
      if (!map.has(l.productId)) map.set(l.productId, l.key)
    })
    return map
  }, [customerLines])

  const handleSubmitCustomerReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSaleId) {
      setFormError('Debe seleccionar una venta.')
      return
    }
    const linesToReturn = customerLines.filter((l) => l.quantity > 0)
    if (linesToReturn.length === 0) {
      setFormError('Debe ingresar al menos una unidad para devolver.')
      return
    }
    const exceeded = customerLines.find((l) => (unitsByProduct.get(l.productId) || 0) > l.soldQuantity)
    if (exceeded) {
      setFormError(`Las unidades de "${exceeded.name}" superan las vendidas (${exceeded.soldQuantity}).`)
      return
    }
    if (!formReason.trim()) {
      setFormError('El motivo de devolución es obligatorio.')
      return
    }

    try {
      setSubmitting(true)
      setFormError(null)
      await returnService.processCustomerReturn({
        saleId: selectedSaleId,
        items: linesToReturn.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          reason: formReason,
          condition: l.condition,
          destination: l.condition === 'MAL_ESTADO' ? l.destination : undefined,
          supplierId: l.condition === 'MAL_ESTADO' && l.destination === 'PROVEEDOR' ? l.supplierId : undefined,
          productionLocationId:
            l.condition === 'MAL_ESTADO' && l.destination === 'PRODUCCION' ? l.productionLocationId : undefined,
          dispositionNotes: l.condition === 'MAL_ESTADO' ? l.dispositionNotes?.trim() || undefined : undefined,
        })),
        reason: formReason,
        notes: formNotes,
      })
      setIsCustomerModalOpen(false)
      await loadData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al procesar devolución')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitSupplierReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPurchaseId) {
      setFormError('Debe seleccionar una compra.')
      return
    }
    const itemsToReturn = supplierItems.filter((it) => it.quantity > 0)
    if (itemsToReturn.length === 0) {
      setFormError('Debe ingresar al menos una unidad para devolver.')
      return
    }
    if (!formReason.trim()) {
      setFormError('El motivo de devolución es obligatorio.')
      return
    }

    try {
      setSubmitting(true)
      setFormError(null)
      await returnService.processSupplierReturn({
        purchaseId: selectedPurchaseId,
        items: itemsToReturn.map((it) => ({
          productId: it.productId,
          quantity: Number(it.quantity),
          reason: formReason,
        })),
        reason: formReason,
        notes: formNotes,
      })
      setIsSupplierModalOpen(false)
      await loadData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al procesar devolución a proveedor')
    } finally {
      setSubmitting(false)
    }
  }

  const suggestionFor = (productId: string) => dispositionOptions?.suggestions.find((s) => s.productId === productId)

  return (
    <div className="space-y-6 p-4 sm:p-6 motion-safe:animate-in motion-safe:fade-in">
      {/* HEADER */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
            <AppIcon name="returns" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Devoluciones de Mercancía</h1>
            <p className="text-sm text-slate-500">
              Devoluciones de clientes y a proveedores con trazabilidad en Kardex y destino de productos en mal estado
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 motion-reduce:transition-none"
          >
            <AppIcon name="refresh" size={16} className={loading ? 'motion-safe:animate-spin' : ''} />
            Actualizar
          </button>

          <button
            type="button"
            onClick={openCustomerModal}
            disabled={loadingSources}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <AppIcon name="arrowDownLeft" size={16} />
            Devolución de Cliente
          </button>

          <button
            type="button"
            onClick={openSupplierModal}
            disabled={loadingSources}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700 active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <AppIcon name="arrowUpRight" size={16} />
            Devolución a Proveedor
          </button>
        </div>
      </header>

      {sourcesError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AppIcon name="warning" size={18} />
          {sourcesError}
        </div>
      )}

      <ScrollableTabs>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`drawer-tab flex items-center gap-2 ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <AppIcon name={tab.icon} size={15} />
            <span>{tab.label}</span>
          </button>
        ))}
      </ScrollableTabs>

      {activeTab === 'damaged' ? (
        <DamagedGoodsPanel />
      ) : (
        <section aria-labelledby="returns-list-title" className="space-y-6">
          <h2 id="returns-list-title" className="sr-only">
            Listado de devoluciones
          </h2>

          {/* METRICS CARDS */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Devoluciones</span>
                <AppIcon name="returns" size={20} className="text-slate-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{stats?.totalReturns ?? 0}</span>
                <span className="text-xs text-slate-500">registros</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{stats?.totalUnitsReturned ?? 0} unidades procesadas</p>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Devoluciones Clientes</span>
                <AppIcon name="arrowDownLeft" size={20} className="text-indigo-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-indigo-900">{stats?.customerReturnsCount ?? 0}</span>
                <span className="text-xs text-indigo-600">${(stats?.customerReturnsAmount ?? 0).toLocaleString('es-CO')} COP</span>
              </div>
              <p className="mt-1 text-xs text-indigo-600">Buen estado reingresa; mal estado va a su destino</p>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Devoluciones Proveedores</span>
                <AppIcon name="arrowUpRight" size={20} className="text-amber-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-900">{stats?.supplierReturnsCount ?? 0}</span>
                <span className="text-xs text-amber-600">${(stats?.supplierReturnsAmount ?? 0).toLocaleString('es-CO')} COP</span>
              </div>
              <p className="mt-1 text-xs text-amber-600">Deducción de inventario (SUPPLIER_RETURN)</p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Trazabilidad Kardex</span>
                <AppIcon name="check" size={20} className="text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-900">100%</span>
                <span className="text-xs text-emerald-700">Transaccional</span>
              </div>
              <p className="mt-1 text-xs text-emerald-600">Sin mutaciones directas de saldo</p>
            </div>
          </div>

          {/* FILTERS & SEARCH */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <AppIcon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <label htmlFor="returns-search" className="sr-only">
                Buscar devoluciones
              </label>
              <input
                id="returns-search"
                type="search"
                placeholder="Buscar por código (DEV-...), documento origen, motivo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div className="flex items-center gap-2">
              <AppIcon name="filter" size={16} className="text-slate-500" />
              <label htmlFor="returns-type" className="sr-only">
                Tipo de devolución
              </label>
              <SelectField
                id="returns-type"
                value={selectedType}
                size="sm"
                onChange={(value) => setSelectedType(value as ReturnType | 'ALL')}
              >
                <option value="ALL">Todos los tipos</option>
                <option value="CUSTOMER_RETURN">Clientes (Entrada)</option>
                <option value="SUPPLIER_RETURN">Proveedores (Salida)</option>
              </SelectField>
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Código</th>
                    <th scope="col" className="px-4 py-3">Tipo</th>
                    <th scope="col" className="px-4 py-3">Doc. Origen</th>
                    <th scope="col" className="px-4 py-3">Tercero (Cliente / Proveedor)</th>
                    <th scope="col" className="px-4 py-3">Bodega</th>
                    <th scope="col" className="px-4 py-3 text-right">Unidades</th>
                    <th scope="col" className="px-4 py-3 text-right">Valor Total</th>
                    <th scope="col" className="px-4 py-3">Motivo</th>
                    <th scope="col" className="px-4 py-3">Fecha</th>
                    <th scope="col" className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500" role="status">
                        Cargando devoluciones...
                      </td>
                    </tr>
                  ) : listError ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-red-700" role="alert">
                        <span className="inline-flex items-center gap-2">
                          <AppIcon name="warning" size={18} />
                          {listError}
                        </span>
                      </td>
                    </tr>
                  ) : returnsList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        No se encontraron devoluciones registradas.
                      </td>
                    </tr>
                  ) : (
                    returnsList.map((ret) => {
                      const damagedUnits = (ret.items || [])
                        .filter((it) => it.condition === 'MAL_ESTADO')
                        .reduce((sum, it) => sum + it.quantity, 0)
                      return (
                        <tr key={ret.id} className="transition-colors hover:bg-slate-50/70 motion-reduce:transition-none">
                          <td className="px-4 py-3 font-semibold text-slate-900">{ret.code}</td>
                          <td className="px-4 py-3">
                            {ret.returnType === 'CUSTOMER_RETURN' ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                <AppIcon name="arrowDownLeft" size={12} />
                                Cliente
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                <AppIcon name="arrowUpRight" size={12} />
                                Proveedor
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">
                            {ret.sourceDocumentCode || ret.sourceDocumentType}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{ret.customerName || ret.supplierName || 'N/A'}</td>
                          <td className="px-4 py-3 text-slate-600">{ret.locationName}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {ret.totalUnits}
                            {damagedUnits > 0 && (
                              <span className="block text-xs font-medium text-amber-700">{damagedUnits} en mal estado</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            ${Number(ret.totalAmount || 0).toLocaleString('es-CO')}
                          </td>
                          <td className="max-w-xs truncate px-4 py-3 text-slate-500" title={ret.reason}>
                            {ret.reason}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {new Date(ret.createdAt).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(ret)}
                              className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 motion-reduce:transition-none"
                              aria-label={`Ver detalle de la devolución ${ret.code}`}
                              title="Ver detalle"
                            >
                              <AppIcon name="eye" size={16} />
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
        </section>
      )}

      {/* DETAIL MODAL */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-detail-title"
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-3xl sm:rounded-2xl sm:p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
          >
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <AppIcon name="fileText" size={20} className="text-blue-600" />
                <h3 id="return-detail-title" className="text-lg font-bold text-slate-900">
                  Detalle de Devolución {selectedRecord.code}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Cerrar detalle"
              >
                <AppIcon name="closeSimple" size={20} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Tipo de Devolución</p>
                <p className="font-semibold text-slate-800">
                  {selectedRecord.returnType === 'CUSTOMER_RETURN' ? 'Cliente' : 'Proveedor (Salida Kardex)'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Documento Origen</p>
                <p className="font-mono font-semibold text-slate-800">{selectedRecord.sourceDocumentCode}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Tercero</p>
                <p className="font-semibold text-slate-800">{selectedRecord.customerName || selectedRecord.supplierName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Bodega Afectada</p>
                <p className="font-semibold text-slate-800">{selectedRecord.locationName}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-400">Motivo</p>
                <p className="rounded-lg border bg-slate-50 p-2.5 text-slate-800">{selectedRecord.reason}</p>
              </div>
            </div>

            <div className="mt-5 border-t pt-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Productos Devueltos</h4>
              <div className="max-h-72 overflow-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 uppercase text-slate-500">
                    <tr>
                      <th scope="col" className="p-2.5">Producto</th>
                      <th scope="col" className="p-2.5 text-right">Cantidad</th>
                      {selectedRecord.returnType === 'CUSTOMER_RETURN' && (
                        <th scope="col" className="p-2.5">Condición / destino</th>
                      )}
                      <th scope="col" className="p-2.5 text-right">Precio/Costo</th>
                      <th scope="col" className="p-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    {(selectedRecord.items || []).map((it) => (
                      <tr key={it.id} className="align-top">
                        <td className="p-2.5 font-medium">
                          {it.productName} ({it.sku})
                        </td>
                        <td className="p-2.5 text-right font-semibold">{it.quantity}</td>
                        {selectedRecord.returnType === 'CUSTOMER_RETURN' && (
                          <td className="p-2.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${
                                it.condition === 'MAL_ESTADO'
                                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              <AppIcon name={it.condition === 'MAL_ESTADO' ? 'warning' : 'check'} size={12} />
                              {RETURN_ITEM_CONDITION_LABELS[it.condition]}
                            </span>
                            {it.condition === 'MAL_ESTADO' && it.destination && (
                              <p className="mt-1 text-slate-600">
                                {DAMAGED_DESTINATION_LABELS[it.destination]}
                                {it.destination === 'PROVEEDOR' && it.dispositionSupplierName ? `: ${it.dispositionSupplierName}` : ''}
                                {it.destination === 'PRODUCCION' && it.dispositionLocationName ? `: ${it.dispositionLocationName}` : ''}
                                {it.dispositionStatus ? ` · ${DAMAGED_STATUS_LABELS[it.dispositionStatus]}` : ''}
                              </p>
                            )}
                            {it.condition === 'MAL_ESTADO' && it.dispositionNotes && (
                              <p className="text-slate-500">{it.dispositionNotes}</p>
                            )}
                          </td>
                        )}
                        <td className="p-2.5 text-right">${(it.unitPrice || it.unitCost).toLocaleString('es-CO')}</td>
                        <td className="p-2.5 text-right font-bold">${it.totalAmount.toLocaleString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="h-10 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 motion-reduce:transition-none"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER RETURN MODAL */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-return-title"
            className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
          >
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <AppIcon name="arrowDownLeft" size={20} className="text-indigo-600" />
                <h3 id="customer-return-title" className="text-lg font-bold text-slate-900">
                  Registrar Devolución de Cliente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Cerrar formulario"
              >
                <AppIcon name="closeSimple" size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitCustomerReturn} className="mt-4 space-y-4">
              {formError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label htmlFor="customer-return-sale" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Seleccionar Venta
                </label>
                <SelectField
                  id="customer-return-sale"
                  value={selectedSaleId}
                  className="w-full"
                  size="sm"
                  onChange={(value) => handleSaleSelect(value)}
                >
                  <option value="">Seleccione una venta...</option>
                  {returnableSales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.saleNumber} - {s.customerName} (${s.totalAmount?.toLocaleString('es-CO')})
                    </option>
                  ))}
                </SelectField>
                {returnableSales.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">No hay ventas disponibles para devolución.</p>
                )}
              </div>

              {customerLines.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Cantidades y condición de cada producto
                  </p>
                  {customerLines.map((line) => {
                    const otherUnits = (unitsByProduct.get(line.productId) || 0) - (Number(line.quantity) || 0)
                    return (
                      <CustomerReturnLineEditor
                        key={line.key}
                        line={line}
                        maxForLine={Math.max(0, line.soldQuantity - otherUnits)}
                        options={dispositionOptions}
                        optionsLoading={optionsLoading}
                        optionsError={optionsError}
                        suggestion={suggestionFor(line.productId)}
                        isSplitLine={firstLineKeyByProduct.get(line.productId) !== line.key}
                        onChange={(patch) => updateCustomerLine(line.key, patch)}
                        onSplit={() => splitCustomerLine(line.key)}
                        onRemove={() => removeCustomerLine(line.key)}
                      />
                    )
                  })}
                </div>
              )}

              <div>
                <label htmlFor="customer-return-reason" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Motivo de la Devolución *
                </label>
                <input
                  id="customer-return-reason"
                  type="text"
                  placeholder="Ej: Producto en mal estado, cambio de referencia..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-2.5 text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="customer-return-notes" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Notas Adicionales
                </label>
                <textarea
                  id="customer-return-notes"
                  rows={2}
                  placeholder="Observaciones de almacén o comerciales..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="h-10 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 motion-reduce:transition-none"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  {submitting ? 'Procesando...' : 'Confirmar Devolución'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER RETURN MODAL */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-return-title"
            className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
          >
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <AppIcon name="arrowUpRight" size={20} className="text-amber-600" />
                <h3 id="supplier-return-title" className="text-lg font-bold text-slate-900">
                  Registrar Devolución a Proveedor
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Cerrar formulario"
              >
                <AppIcon name="closeSimple" size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitSupplierReturn} className="mt-4 space-y-4">
              {formError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label htmlFor="supplier-return-purchase" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Seleccionar Compra Recibida
                </label>
                <SelectField
                  id="supplier-return-purchase"
                  value={selectedPurchaseId}
                  className="w-full"
                  size="sm"
                  onChange={(value) => handlePurchaseSelect(value)}
                >
                  <option value="">Seleccione una compra recibida...</option>
                  {returnablePurchases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.purchaseNumber} - {p.supplierName} (${p.totalAmount?.toLocaleString('es-CO')})
                    </option>
                  ))}
                </SelectField>
                {returnablePurchases.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">No hay compras recibidas disponibles para devolución.</p>
                )}
              </div>

              {supplierItems.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cantidades a devolver a proveedor</p>
                  {supplierItems.map((it, idx) => (
                    <div key={it.productId} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{it.name}</p>
                        <p className="text-slate-500">Máximo disponible: {it.maxQuantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor={`supplier-item-${idx}`} className="text-slate-600">
                          Cant.
                        </label>
                        <input
                          id={`supplier-item-${idx}`}
                          type="number"
                          min={0}
                          max={it.maxQuantity}
                          value={it.quantity}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0)
                            setSupplierItems((items) => items.map((x, i) => (i === idx ? { ...x, quantity: val } : x)))
                          }}
                          className="h-9 w-20 rounded-md border border-slate-300 bg-white text-center font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label htmlFor="supplier-return-reason" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Motivo de la Devolución a Proveedor *
                </label>
                <input
                  id="supplier-return-reason"
                  type="text"
                  placeholder="Ej: Fecha corta de vencimiento, producto no solicitado, avería..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-2.5 text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="supplier-return-notes" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Notas Adicionales
                </label>
                <textarea
                  id="supplier-return-notes"
                  rows={2}
                  placeholder="Número de acta, transportador o detalles..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="h-10 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 motion-reduce:transition-none"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 rounded-lg bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-700 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  {submitting ? 'Procesando...' : 'Confirmar Devolución a Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
