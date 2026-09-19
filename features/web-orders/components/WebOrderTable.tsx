'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { WebOrder, WebOrderStatus, WebOrderChannel } from '../types'
import { WebOrderTableSkeleton } from './WebOrderSkeleton'

interface WebOrderTableProps {
  orders: WebOrder[]
  loading: boolean
  error: string | null
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onViewDetail: (order: WebOrder) => void
  onConfirm: (order: WebOrder) => void
  onPrepare: (order: WebOrder) => void
  onDispatch: (order: WebOrder) => void
  onInvoice: (order: WebOrder) => void
  onCancel: (order: WebOrder) => void
  canConfirm: boolean
  canPrepare: boolean
  canDispatch: boolean
  canInvoice: boolean
  canCancel: boolean
}

export function WebOrderTable({
  orders,
  loading,
  error,
  page,
  totalPages,
  total,
  onPageChange,
  onViewDetail,
  onConfirm,
  onPrepare,
  onDispatch,
  onInvoice,
  onCancel,
  canConfirm,
  canPrepare,
  canDispatch,
  canInvoice,
  canCancel,
}: WebOrderTableProps) {
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
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

  const getStatusBadge = (status: WebOrderStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pendiente
          </span>
        )
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            Confirmado
          </span>
        )
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-300">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
            En Preparación
          </span>
        )
      case 'READY_TO_DISPATCH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-300">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
            Listo Despacho
          </span>
        )
      case 'SHIPPED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-300">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-pulse" />
            Enviado
          </span>
        )
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Entregado
          </span>
        )
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
            Cancelado
          </span>
        )
    }
  }

  const getChannelBadge = (channel: WebOrderChannel) => {
    if (channel === 'CATALOGO_DISTRIBUIDORA') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-purple-50 text-purple-700 border border-purple-200">
          Distribuidora
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-blue-50 text-blue-700 border border-blue-200">
        Super Más
      </span>
    )
  }

  if (loading) {
    return <WebOrderTableSkeleton />
  }

  if (error) {
    return (
      <div className="panel-container rounded-xl border border-rose-200 bg-rose-50/50 p-8 text-center my-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AppIcon name="close" size={24} />
        </div>
        <h3 className="text-base font-semibold text-rose-900 mb-1">
          Error al cargar pedidos web
        </h3>
        <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="panel-container rounded-xl border border-slate-200 bg-white p-12 text-center my-4 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
          <AppIcon name="webOrders" size={28} />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">
          No se encontraron pedidos web
        </h3>
        <p className="text-xs text-slate-600 max-w-sm mx-auto">
          No hay órdenes que coincidan con los criterios de búsqueda o filtros seleccionados.
        </p>
      </div>
    )
  }

  return (
    <div className="table-panel animated-table page-enter rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="table-scroll overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                N° Pedido / Canal
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Fecha
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Cliente
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Productos
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Total
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Pago
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Estado
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Bodega Salida
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Facturación
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Responsable
              </th>
              <th className="py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {orders.map((ord) => (
              <tr
                key={ord.id}
                onClick={() => onViewDetail(ord)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {/* N° Pedido / Canal */}
                <td className="py-3.5 px-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-950 text-[13px] tracking-tight">
                      {ord.orderNumber}
                    </span>
                    <div>{getChannelBadge(ord.channel)}</div>
                  </div>
                </td>

                {/* Fecha */}
                <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                  {formatDate(ord.createdAt)}
                </td>

                {/* Cliente */}
                <td className="py-3.5 px-4">
                  <div className="flex flex-col gap-0.5 max-w-[200px]">
                    <span className="font-bold text-slate-800 truncate">
                      {ord.customerName}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono truncate">
                      {ord.customerDoc || ord.customerPhone}
                    </span>
                  </div>
                </td>

                {/* Productos */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    {ord.items && ord.items[0]?.imageUrl && (
                      <img
                        src={ord.items[0].imageUrl}
                        alt="Producto"
                        className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50"
                      />
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800">
                        {ord.itemsCount} {ord.itemsCount === 1 ? 'ítem' : 'ítems'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        ({ord.totalUnits} unids)
                      </span>
                    </div>
                  </div>
                </td>

                {/* Total */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <span className="font-bold text-slate-950 text-[13px]">
                    {formatMoney(ord.totalAmount)}
                  </span>
                </td>

                {/* Pago */}
                <td className="py-3.5 px-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-800 font-medium truncate max-w-[130px]">
                      {ord.paymentMethod}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        ord.paymentStatus === 'PAID'
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {ord.paymentStatus === 'PAID' ? 'PAGADO' : 'PENDIENTE'}
                    </span>
                  </div>
                </td>

                {/* Estado */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {getStatusBadge(ord.status)}
                </td>

                {/* Bodega Salida */}
                <td className="py-3.5 px-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-700 truncate max-w-[140px]">
                      {ord.assignedLocationName}
                    </span>
                    <span className="text-[10px] text-blue-700 font-semibold">
                      Ecommerce CEDI
                    </span>
                  </div>
                </td>

                {/* Facturación */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {ord.invoiceNumber ? (
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800 text-[11px]">
                        {ord.invoiceNumber}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold">
                        DIAN Validada
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-[11px]">Sin Factura</span>
                  )}
                </td>

                {/* Usuario Responsable */}
                <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                  {ord.assignedUserName || 'Por asignar'}
                </td>

                {/* Acciones Rápidas */}
                <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Ver detalle */}
                    <button
                      type="button"
                      onClick={() => onViewDetail(ord)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Ver detalle del pedido"
                      aria-label="Ver detalle"
                    >
                      <AppIcon name="eye" size={15} />
                    </button>

                    {/* Confirmar (PENDING) */}
                    {ord.status === 'PENDING' && canConfirm && (
                      <button
                        type="button"
                        onClick={() => onConfirm(ord)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-medium text-[11px] hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-xs"
                        title="Confirmar pedido y reservar stock"
                      >
                        <AppIcon name="check" size={13} />
                        <span>Confirmar</span>
                      </button>
                    )}

                    {/* Preparar (CONFIRMED) */}
                    {ord.status === 'CONFIRMED' && canPrepare && (
                      <button
                        type="button"
                        onClick={() => onPrepare(ord)}
                        className="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-medium text-[11px] hover:bg-purple-700 transition-colors flex items-center gap-1 shadow-xs"
                        title="Iniciar alistamiento de productos"
                      >
                        <AppIcon name="package" size={13} />
                        <span>Preparar</span>
                      </button>
                    )}

                    {/* Despachar (READY_TO_DISPATCH) */}
                    {ord.status === 'READY_TO_DISPATCH' && canDispatch && (
                      <button
                        type="button"
                        onClick={() => onDispatch(ord)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium text-[11px] hover:bg-indigo-700 transition-colors flex items-center gap-1 shadow-xs"
                        title="Despachar pedido y generar venta"
                      >
                        <AppIcon name="transfers" size={13} />
                        <span>Despachar</span>
                      </button>
                    )}

                    {/* Facturar (cuando no tiene factura y no está cancelado) */}
                    {!ord.invoiceId && ord.status !== 'CANCELLED' && canInvoice && (
                      <button
                        type="button"
                        onClick={() => onInvoice(ord)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Generar Factura Electrónica DIAN"
                        aria-label="Facturar"
                      >
                        <AppIcon name="invoices" size={15} />
                      </button>
                    )}

                    {/* Cancelar (si no está DELIVERED ni CANCELLED) */}
                    {['PENDING', 'CONFIRMED', 'PREPARING', 'READY_TO_DISPATCH'].includes(ord.status) && canCancel && (
                      <button
                        type="button"
                        onClick={() => onCancel(ord)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Cancelar pedido"
                        aria-label="Cancelar"
                      >
                        <AppIcon name="close" size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="py-3 px-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50">
        <div>
          Mostrando <strong>{orders.length}</strong> de <strong>{total}</strong> pedidos
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
          >
            Anterior
          </button>
          <span className="font-semibold text-slate-800">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
