'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  RotateCcw,
  Search,
  Filter,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Calendar,
  Building2,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  RefreshCw,
} from 'lucide-react'
import { returnService } from '../services/return.service'
import { ReturnRecord, ReturnStats, ReturnType } from '../types'

interface ReturnsPageProps {
  onNavigate?: (view: string) => void
}

export function ReturnsPage({ onNavigate }: ReturnsPageProps) {
  const [returnsList, setReturnsList] = useState<ReturnRecord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ReturnStats | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<ReturnType | 'ALL'>('ALL')
  const [page, setPage] = useState(1)

  // Modals & Detail
  const [selectedRecord, setSelectedRecord] = useState<ReturnRecord | null>(null)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)

  // Returnable Sources
  const [returnableSales, setReturnableSales] = useState<any[]>([])
  const [returnablePurchases, setReturnablePurchases] = useState<any[]>([])
  const [loadingSources, setLoadingSources] = useState(false)

  // Form states
  const [selectedSaleId, setSelectedSaleId] = useState('')
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('')
  const [formItems, setFormItems] = useState<{ productId: string; quantity: number; reason?: string }[]>([])
  const [formReason, setFormReason] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
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
      setTotalCount(listRes.total)
      setStats(statsRes)
    } catch (err: any) {
      console.error('Error al cargar devoluciones:', err)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedType, page])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openCustomerModal = async () => {
    try {
      setLoadingSources(true)
      setFormError(null)
      setSelectedSaleId('')
      setFormItems([])
      setFormReason('')
      setFormNotes('')
      const sales = await returnService.getReturnableSales()
      setReturnableSales(sales)
      setIsCustomerModalOpen(true)
    } catch (err: any) {
      alert(`Error al cargar ventas para devolución: ${err.message}`)
    } finally {
      setLoadingSources(false)
    }
  }

  const openSupplierModal = async () => {
    try {
      setLoadingSources(true)
      setFormError(null)
      setSelectedPurchaseId('')
      setFormItems([])
      setFormReason('')
      setFormNotes('')
      const purchases = await returnService.getReturnablePurchases()
      setReturnablePurchases(purchases)
      setIsSupplierModalOpen(true)
    } catch (err: any) {
      alert(`Error al cargar compras para devolución: ${err.message}`)
    } finally {
      setLoadingSources(false)
    }
  }

  const handleSaleSelect = (saleId: string) => {
    setSelectedSaleId(saleId)
    const sale = returnableSales.find((s) => s.id === saleId)
    if (sale && sale.items) {
      setFormItems(
        sale.items.map((it: any) => ({
          productId: it.product_id,
          quantity: 1,
          maxQuantity: it.quantity,
          name: it.product?.name || 'Producto',
          sku: it.product?.sku || '',
          unitPrice: it.unit_price,
        }))
      )
    } else {
      setFormItems([])
    }
  }

  const handlePurchaseSelect = (purchaseId: string) => {
    setSelectedPurchaseId(purchaseId)
    const pur = returnablePurchases.find((p) => p.id === purchaseId)
    if (pur && pur.items) {
      setFormItems(
        pur.items.map((it: any) => ({
          productId: it.product_id,
          quantity: 1,
          maxQuantity: it.received_quantity || it.quantity,
          name: it.product?.name || 'Producto',
          sku: it.product?.sku || '',
          unitCost: it.unit_cost,
        }))
      )
    } else {
      setFormItems([])
    }
  }

  const handleSubmitCustomerReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSaleId) {
      setFormError('Debe seleccionar una venta.')
      return
    }
    const itemsToReturn = formItems.filter((it) => it.quantity > 0)
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
      await returnService.processCustomerReturn({
        saleId: selectedSaleId,
        items: itemsToReturn.map((it) => ({
          productId: it.productId,
          quantity: Number(it.quantity),
          reason: formReason,
        })),
        reason: formReason,
        notes: formNotes,
      })
      setIsCustomerModalOpen(false)
      await loadData()
    } catch (err: any) {
      setFormError(err.message || 'Error al procesar devolución')
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
    const itemsToReturn = formItems.filter((it) => it.quantity > 0)
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
    } catch (err: any) {
      setFormError(err.message || 'Error al procesar devolución a proveedor')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
              <RotateCcw className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Devoluciones de Mercancía
              </h1>
              <p className="text-sm text-slate-500">
                Gestión fiduciaria de devoluciones de clientes y a proveedores con trazabilidad en Kardex
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            title="Refrescar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          <button
            onClick={openCustomerModal}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            <ArrowDownLeft className="h-4 w-4" />
            Devolución de Cliente
          </button>

          <button
            onClick={openSupplierModal}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700"
          >
            <ArrowUpRight className="h-4 w-4" />
            Devolución a Proveedor
          </button>
        </div>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Devoluciones
            </span>
            <RotateCcw className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {stats?.totalReturns ?? 0}
            </span>
            <span className="text-xs text-slate-500">registros</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {stats?.totalUnitsReturned ?? 0} unidades procesadas en Kardex
          </p>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              Devoluciones Clientes
            </span>
            <ArrowDownLeft className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-900">
              {stats?.customerReturnsCount ?? 0}
            </span>
            <span className="text-xs text-indigo-600">
              ${(stats?.customerReturnsAmount ?? 0).toLocaleString('es-CO')} COP
            </span>
          </div>
          <p className="mt-1 text-xs text-indigo-600">Reingresos a inventario (CUSTOMER_RETURN)</p>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Devoluciones Proveedores
            </span>
            <ArrowUpRight className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-900">
              {stats?.supplierReturnsCount ?? 0}
            </span>
            <span className="text-xs text-amber-600">
              ${(stats?.supplierReturnsAmount ?? 0).toLocaleString('es-CO')} COP
            </span>
          </div>
          <p className="mt-1 text-xs text-amber-600">Deducción de inventario (SUPPLIER_RETURN)</p>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Trazabilidad Kardex
            </span>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código (DEV-...), documento origen, motivo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Todos los tipos</option>
            <option value="CUSTOMER_RETURN">Clientes (Entrada)</option>
            <option value="SUPPLIER_RETURN">Proveedores (Salida)</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Doc. Origen</th>
                <th className="px-4 py-3">Tercero (Cliente / Proveedor)</th>
                <th className="px-4 py-3">Bodega</th>
                <th className="px-4 py-3 text-right">Unidades</th>
                <th className="px-4 py-3 text-right">Valor Total</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    Cargando devoluciones desde PostgreSQL...
                  </td>
                </tr>
              ) : returnsList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    No se encontraron devoluciones registradas.
                  </td>
                </tr>
              ) : (
                returnsList.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{ret.code}</td>
                    <td className="px-4 py-3">
                      {ret.returnType === 'CUSTOMER_RETURN' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
                          <ArrowDownLeft className="h-3 w-3" />
                          Cliente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                          <ArrowUpRight className="h-3 w-3" />
                          Proveedor
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                      {ret.sourceDocumentCode || ret.sourceDocumentType}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {ret.customerName || ret.supplierName || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{ret.locationName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {ret.totalUnits}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      ${Number(ret.totalAmount || 0).toLocaleString('es-CO')}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={ret.reason}>
                      {ret.reason}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(ret.createdAt).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedRecord(ret)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900">
                  Detalle de Devolución {selectedRecord.code}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400">Tipo de Devolución</p>
                <p className="font-semibold text-slate-800">
                  {selectedRecord.returnType === 'CUSTOMER_RETURN' ? 'Cliente (Reingreso Kardex)' : 'Proveedor (Salida Kardex)'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Documento Origen</p>
                <p className="font-mono text-slate-800 font-semibold">{selectedRecord.sourceDocumentCode}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Tercero</p>
                <p className="font-semibold text-slate-800">
                  {selectedRecord.customerName || selectedRecord.supplierName}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Bodega Afectada</p>
                <p className="font-semibold text-slate-800">{selectedRecord.locationName}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-400">Motivo</p>
                <p className="text-slate-800 bg-slate-50 p-2.5 rounded-lg border">{selectedRecord.reason}</p>
              </div>
            </div>

            {/* ÍTEMS */}
            <div className="mt-5 border-t pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Productos Devueltos
              </h4>
              <div className="max-h-60 overflow-y-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase">
                    <tr>
                      <th className="p-2.5">Producto</th>
                      <th className="p-2.5 text-right">Cantidad</th>
                      <th className="p-2.5 text-right">Precio/Costo</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    {(selectedRecord.items || []).map((it) => (
                      <tr key={it.id}>
                        <td className="p-2.5 font-medium">{it.productName} ({it.sku})</td>
                        <td className="p-2.5 text-right font-semibold">{it.quantity}</td>
                        <td className="p-2.5 text-right">
                          ${(it.unitPrice || it.unitCost).toLocaleString('es-CO')}
                        </td>
                        <td className="p-2.5 text-right font-bold">
                          ${(it.totalAmount).toLocaleString('es-CO')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER RETURN MODAL */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">
                  Registrar Devolución de Cliente
                </h3>
              </div>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCustomerReturn} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Seleccionar Venta
                </label>
                <select
                  value={selectedSaleId}
                  onChange={(e) => handleSaleSelect(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                  required
                >
                  <option value="">Seleccione una venta...</option>
                  {returnableSales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.saleNumber} - {s.customerName} (${s.totalAmount?.toLocaleString('es-CO')})
                    </option>
                  ))}
                </select>
              </div>

              {formItems.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Cantidades a devolver
                  </p>
                  {formItems.map((it: any, idx) => (
                    <div key={it.productId} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs">
                      <div>
                        <p className="font-medium text-slate-900">{it.name}</p>
                        <p className="text-slate-400">Max disponible: {it.maxQuantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-slate-500">Cant:</label>
                        <input
                          type="number"
                          min="0"
                          max={it.maxQuantity}
                          value={it.quantity}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            const copy = [...formItems]
                            copy[idx].quantity = val
                            setFormItems(copy)
                          }}
                          className="w-16 rounded border p-1 text-center font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Motivo de la Devolución *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Producto en mal estado, cambio de referencia..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Notas Adicionales
                </label>
                <textarea
                  rows={2}
                  placeholder="Observaciones de almacén o comerciales..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-amber-600" />
                <h3 className="text-lg font-bold text-slate-900">
                  Registrar Devolución a Proveedor
                </h3>
              </div>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSupplierReturn} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Seleccionar Compra Recibida
                </label>
                <select
                  value={selectedPurchaseId}
                  onChange={(e) => handlePurchaseSelect(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                  required
                >
                  <option value="">Seleccione una compra recibida...</option>
                  {returnablePurchases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.purchaseNumber} - {p.supplierName} (${p.totalAmount?.toLocaleString('es-CO')})
                    </option>
                  ))}
                </select>
              </div>

              {formItems.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Cantidades a devolver a proveedor
                  </p>
                  {formItems.map((it: any, idx) => (
                    <div key={it.productId} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs">
                      <div>
                        <p className="font-medium text-slate-900">{it.name}</p>
                        <p className="text-slate-400">Max disponible: {it.maxQuantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-slate-500">Cant:</label>
                        <input
                          type="number"
                          min="0"
                          max={it.maxQuantity}
                          value={it.quantity}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            const copy = [...formItems]
                            copy[idx].quantity = val
                            setFormItems(copy)
                          }}
                          className="w-16 rounded border p-1 text-center font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Motivo de la Devolución a Proveedor *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Fecha corta de vencimiento, producto no solicitado, avería..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Notas Adicionales
                </label>
                <textarea
                  rows={2}
                  placeholder="Número de acta, transportador o detalles..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
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
