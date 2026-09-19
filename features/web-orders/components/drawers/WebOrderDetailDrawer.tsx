'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { WebOrder, WebOrderStatus, InventoryCheckResult } from '../../types'

interface WebOrderDetailDrawerProps {
  isOpen: boolean
  order: WebOrder | null
  onClose: () => void
  onConfirm: (order: WebOrder) => void
  onPrepare: (order: WebOrder) => void
  onDispatch: (order: WebOrder) => void
  onDeliver: (order: WebOrder) => void
  onInvoice: (order: WebOrder) => void
  onCancel: (order: WebOrder) => void
  checkAvailability: (items: { productId: string; quantity: number }[]) => Promise<InventoryCheckResult[]>
  canConfirm: boolean
  canPrepare: boolean
  canDispatch: boolean
  canInvoice: boolean
  canCancel: boolean
}

export function WebOrderDetailDrawer({
  isOpen,
  order,
  onClose,
  onConfirm,
  onPrepare,
  onDispatch,
  onDeliver,
  onInvoice,
  onCancel,
  checkAvailability,
  canConfirm,
  canPrepare,
  canDispatch,
  canInvoice,
  canCancel,
}: WebOrderDetailDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [availabilityResults, setAvailabilityResults] = useState<InventoryCheckResult[]>([])
  const [checkingStock, setCheckingStock] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen && order && order.items.length > 0) {
      setCheckingStock(true)
      checkAvailability(
        order.items.map((it) => ({ productId: it.productId, quantity: it.quantity }))
      )
        .then((results) => setAvailabilityResults(results))
        .catch((err) => console.error('Error al validar stock:', err))
        .finally(() => setCheckingStock(false))
    }
  }, [isOpen, order, checkAvailability])

  if (!isOpen || !order || !mounted) return null

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

  // Traducción oficial en español para estados
  const getStatusLabel = (status: WebOrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'Pendiente'
      case 'CONFIRMED':
        return 'Confirmado'
      case 'PREPARING':
        return 'En Preparación'
      case 'READY_TO_DISPATCH':
        return 'Listo para Despacho'
      case 'SHIPPED':
        return 'Enviado'
      case 'DELIVERED':
        return 'Entregado'
      case 'CANCELLED':
        return 'Cancelado'
    }
  }

  const getStatusBadgeStyle = (status: WebOrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-50 text-amber-800 border-amber-300'
      case 'CONFIRMED':
        return 'bg-blue-50 text-blue-800 border-blue-300'
      case 'PREPARING':
        return 'bg-purple-50 text-purple-800 border-purple-300'
      case 'READY_TO_DISPATCH':
        return 'bg-indigo-50 text-indigo-800 border-indigo-300'
      case 'SHIPPED':
        return 'bg-sky-50 text-sky-800 border-sky-300'
      case 'DELIVERED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300'
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-800 border-rose-300'
    }
  }

  const getDianStatusLabel = (st?: string) => {
    if (!st) return 'No registrado'
    switch (st) {
      case 'ISSUED':
      case 'AUTHORIZED':
        return 'Autorizada y Validada'
      case 'PENDING':
        return 'Pendiente de emisión'
      case 'REJECTED':
        return 'Rechazada por DIAN'
      default:
        return st
    }
  }

  // Pasos del ciclo de vida del pedido en español
  const steps: { status: WebOrderStatus; label: string; icon: any }[] = [
    { status: 'PENDING', label: 'Pendiente', icon: 'alerts' },
    { status: 'CONFIRMED', label: 'Confirmado', icon: 'check' },
    { status: 'PREPARING', label: 'Preparación', icon: 'package' },
    { status: 'READY_TO_DISPATCH', label: 'Listo Despacho', icon: 'package' },
    { status: 'SHIPPED', label: 'Enviado', icon: 'transfers' },
    { status: 'DELIVERED', label: 'Entregado', icon: 'check' },
  ]

  const getStepIndex = (st: WebOrderStatus) => {
    switch (st) {
      case 'PENDING':
        return 0
      case 'CONFIRMED':
        return 1
      case 'PREPARING':
        return 2
      case 'READY_TO_DISPATCH':
        return 3
      case 'SHIPPED':
        return 4
      case 'DELIVERED':
        return 5
      case 'CANCELLED':
        return -1
    }
  }

  const currentStepIndex = getStepIndex(order.status)
  const isCancelled = order.status === 'CANCELLED'

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="product-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 760,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: '#ffffff',
          overflow: 'hidden',
          animation: 'slide .3s ease',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-drawer-title"
      >
        {/* Drawer Header */}
        <div className="drawer-header border-b border-slate-200 p-5 flex items-center justify-between shrink-0 bg-slate-50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="eyebrow m-0 text-slate-500 font-bold">PEDIDO ECOMMERCE</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                {order.channel === 'CATALOGO_DISTRIBUIDORA' ? 'Distribuidora' : 'Super Más'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeStyle(order.status)}`}>
                {getStatusLabel(order.status)}
              </span>
            </div>
            <h2 id="order-drawer-title" className="text-2xl font-extrabold text-slate-900 tracking-tight m-0">
              {order.orderNumber}
            </h2>
          </div>

          <button
            type="button"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Línea de Tiempo del Pedido */}
          <section className="bg-slate-50/70 rounded-xl p-5 border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-1.5">
              <AppIcon name="transfers" size={14} />
              <span>Línea de Tiempo del Pedido</span>
            </h3>

            {isCancelled ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                  <AppIcon name="close" size={14} />
                </div>
                <div className="text-xs">
                  <p className="font-bold m-0 text-rose-950">Pedido Cancelado</p>
                  <p className="mt-1 m-0 text-rose-800">
                    Motivo: <strong>{order.cancellationReason || 'Cancelado por administración'}</strong>
                  </p>
                  {order.cancelledAt && (
                    <p className="text-[11px] text-rose-600 mt-1 m-0">
                      Fecha: {formatDate(order.cancelledAt)} por {order.cancelledBy || 'Administración'}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative">
                {/* Steps Bar */}
                <div className="flex items-center justify-between relative px-2">
                  <div className="absolute top-1/2 left-4 right-4 h-1 bg-slate-200 -translate-y-1/2 z-0" />
                  <div
                    className="absolute top-1/2 left-4 h-1 bg-blue-600 -translate-y-1/2 z-0 transition-all duration-500"
                    style={{
                      width: `${(Math.max(0, currentStepIndex) / (steps.length - 1)) * 92}%`,
                    }}
                  />

                  {steps.map((step, idx) => {
                    const isDone = currentStepIndex >= idx
                    const isCurrent = currentStepIndex === idx

                    return (
                      <div key={step.status} className="relative z-10 flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            isDone
                              ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-xs'
                              : 'bg-white border-2 border-slate-300 text-slate-400'
                          }`}
                        >
                          {isDone ? (
                            <AppIcon name="check" size={14} />
                          ) : (
                            <span className="text-xs font-bold font-mono">{idx + 1}</span>
                          )}
                        </div>
                        <span
                          className={`text-[11px] mt-2 font-bold whitespace-nowrap ${
                            isCurrent
                              ? 'text-blue-700 font-extrabold'
                              : isDone
                              ? 'text-slate-800'
                              : 'text-slate-400 font-normal'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Eventos registrados en Timeline */}
                {order.timeline && order.timeline.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-200 space-y-2.5">
                    <p className="text-xs font-bold text-slate-700">Historial de Eventos:</p>
                    {order.timeline.map((evt, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs"
                      >
                        <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs">
                            <strong className="text-slate-900 font-bold">{evt.actor}</strong>
                            <span className="text-slate-500 font-medium">{formatDate(evt.timestamp)}</span>
                          </div>
                          <p className="m-0 mt-1 text-slate-600 text-xs">{evt.notes}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Validación de Disponibilidad & Bodega Ecommerce */}
          <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <AppIcon name="warehouse" size={15} />
                <span>Validación de Disponibilidad Ecommerce</span>
              </h3>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                Bodega Despacho: {order.assignedLocationName}
              </span>
            </div>

            {checkingStock ? (
              <p className="text-xs text-slate-500 py-3 text-center">Consultando disponibilidad de inventario en tiempo real...</p>
            ) : (
              <div className="space-y-2.5">
                {availabilityResults.map((av, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 text-xs border border-slate-200"
                  >
                    <div>
                      <span className="font-bold text-slate-900 text-[13px] block">{av.productName}</span>
                      <span className="text-xs text-slate-500 font-mono">SKU: {av.sku}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Disponibilidad pública */}
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          av.availability === 'AVAILABLE'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : av.availability === 'LOW_STOCK'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                        }`}
                      >
                        {av.availability === 'AVAILABLE'
                          ? 'DISPONIBLE'
                          : av.availability === 'LOW_STOCK'
                          ? 'POCAS UNIDADES'
                          : 'AGOTADO'}
                      </span>

                      {/* Chequeo en bodega ecommerce */}
                      <span
                        className={`text-xs font-semibold ${
                          av.canFulfill ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {av.canFulfill ? '✓ CEDI Disponible' : '⚠ Requiere traslado'}
                      </span>
                    </div>
                  </div>
                ))}

                {['CONFIRMED', 'PREPARING', 'READY_TO_DISPATCH'].includes(order.status) && (
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2.5 mt-3">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <AppIcon name="check" size={12} />
                    </div>
                    <span>
                      <strong>Inventario reservado:</strong> Este pedido tiene stock reservado en la Bodega
                      Ecommerce ({order.assignedLocationName}) para asegurar su alistamiento sin riesgo de sobreventa.
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Información del Cliente & Dirección */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cliente */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
                <AppIcon name="customers" size={15} />
                <span>Datos del Cliente</span>
              </h3>
              <div className="space-y-2">
                <p className="m-0 font-bold text-slate-900 text-sm">{order.customerName}</p>
                <p className="m-0 text-slate-600">Documento / NIT: <strong className="text-slate-800">{order.customerDoc || 'No registrado'}</strong></p>
                <p className="m-0 text-slate-600">Teléfono: <strong className="text-slate-800">{order.customerPhone}</strong></p>
                <p className="m-0 text-slate-600">Correo Electrónico: <strong className="text-slate-800">{order.customerEmail}</strong></p>
              </div>
            </div>

            {/* Dirección de Envío */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
                <AppIcon name="warehouse" size={15} />
                <span>Dirección de Despacho</span>
              </h3>
              <div className="space-y-2">
                <p className="m-0 font-bold text-slate-900 text-sm">{order.shippingAddress}</p>
                <p className="m-0 text-slate-600">
                  Ciudad: <strong className="text-slate-800">{order.city}</strong> {order.department ? `(${order.department})` : ''}
                </p>
                {order.deliveryNotes && (
                  <p className="m-0 text-slate-600 text-xs italic bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-2">
                    Notas de entrega: &quot;{order.deliveryNotes}&quot;
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Snapshot Histórico de Productos */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 m-0">
                <AppIcon name="products" size={15} />
                <span>Productos del Pedido (Registro Histórico)</span>
              </h3>
              <span className="text-xs text-slate-600 font-semibold">
                {order.itemsCount} {order.itemsCount === 1 ? 'producto' : 'productos'} / {order.totalUnits} unidades
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase bg-slate-50/70">
                    <th className="py-3 px-4">Producto / Referencia</th>
                    <th className="py-3 px-3 text-center">Cantidad</th>
                    <th className="py-3 px-3 text-right">Precio Unitario</th>
                    <th className="py-3 px-3 text-right">IVA</th>
                    <th className="py-3 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {it.imageUrl ? (
                            <img
                              src={it.imageUrl}
                              alt={it.productName}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <AppIcon name="products" size={18} />
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">{it.productName}</span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              SKU: {it.sku} | Unidad: {it.unitOfMeasure}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900">{it.quantity}</td>
                      <td className="py-3 px-3 text-right text-slate-700">{formatMoney(it.unitPrice)}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{formatMoney(it.taxAmount)}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-950 text-xs">{formatMoney(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <div className="w-72 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-medium text-slate-800">{formatMoney(order.subtotal)}</span>
                </div>
                {order.discountTotal > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>Descuento aplicado:</span>
                    <span className="font-bold">-{formatMoney(order.discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Costo de Envío:</span>
                  <span className="font-medium text-slate-800">
                    {order.shippingCost === 0 ? 'Gratis' : formatMoney(order.shippingCost)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Impuestos (IVA):</span>
                  <span className="font-medium text-slate-800">{formatMoney(order.taxTotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-slate-950 pt-2.5 border-t border-slate-300">
                  <span>Total a Pagar:</span>
                  <span className="text-blue-700 text-base">{formatMoney(order.totalAmount)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Pago & Facturación */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pago */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
                <AppIcon name="sales" size={15} />
                <span>Método y Estado de Pago</span>
              </h3>
              <div className="space-y-2">
                <p className="m-0 font-bold text-slate-900 text-sm">{order.paymentMethod}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      order.paymentStatus === 'PAID'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-50 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {order.paymentStatus === 'PAID' ? 'PAGADO' : 'PENDIENTE DE PAGO'}
                  </span>
                  {order.paymentReference && (
                    <span className="text-xs text-slate-500 font-mono">Ref: {order.paymentReference}</span>
                  )}
                </div>
                {order.paidAt && (
                  <p className="text-xs text-slate-500 mt-1 m-0">Fecha de Pago: {formatDate(order.paidAt)}</p>
                )}
              </div>
            </div>

            {/* Facturación Electrónica DIAN */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs text-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 m-0">
                  <AppIcon name="invoices" size={15} />
                  <span>Facturación Electrónica DIAN</span>
                </h3>
                {order.invoiceNumber && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                    DIAN Validada
                  </span>
                )}
              </div>

              {order.invoiceNumber ? (
                <div className="space-y-1.5">
                  <p className="m-0 font-bold text-slate-900 text-sm">{order.invoiceNumber}</p>
                  <p className="m-0 text-slate-600">Venta ERP Asociada: <strong className="text-slate-800">{order.saleNumber || 'Venta Registrada'}</strong></p>
                  <p className="m-0 text-xs text-slate-500">Estado DIAN: <strong className="text-emerald-700">{getDianStatusLabel(order.dianStatus)}</strong></p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="m-0 text-slate-500">Este pedido aún no cuenta con factura electrónica emitida.</p>
                  {canInvoice && order.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      onClick={() => onInvoice(order)}
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <AppIcon name="invoices" size={15} />
                      <span>Emitir Factura Electrónica</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Despacho & Transportadora */}
          {(order.courier || order.trackingNumber) && (
            <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
                <AppIcon name="transfers" size={15} />
                <span>Datos de Despacho y Guía de Transporte</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500 block mb-0.5">Empresa Transportadora</span>
                  <span className="font-bold text-slate-900 text-sm">{order.courier}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-0.5">Número de Guía</span>
                  <span className="font-bold text-blue-700 font-mono text-sm">{order.trackingNumber}</span>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Drawer Action Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div>
            {['PENDING', 'CONFIRMED', 'PREPARING', 'READY_TO_DISPATCH'].includes(order.status) && canCancel && (
              <button
                type="button"
                onClick={() => onCancel(order)}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-rose-50"
              >
                <AppIcon name="close" size={15} />
                <span>Cancelar Pedido</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {order.status === 'PENDING' && canConfirm && (
              <button
                type="button"
                onClick={() => onConfirm(order)}
                className="primary-button text-xs py-2 px-4 flex items-center gap-1.5 font-bold"
              >
                <AppIcon name="check" size={15} />
                <span>Confirmar Pedido (Reservar Stock)</span>
              </button>
            )}

            {order.status === 'CONFIRMED' && canPrepare && (
              <button
                type="button"
                onClick={() => onPrepare(order)}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <AppIcon name="package" size={15} />
                <span>Alistar / Preparar Pedido</span>
              </button>
            )}

            {order.status === 'PREPARING' && canPrepare && (
              <button
                type="button"
                onClick={() => onPrepare(order)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <AppIcon name="check" size={15} />
                <span>Completar Lista de Chequeo de Alistamiento</span>
              </button>
            )}

            {order.status === 'READY_TO_DISPATCH' && canDispatch && (
              <button
                type="button"
                onClick={() => onDispatch(order)}
                className="px-4 py-2 rounded-lg bg-sky-600 text-white font-bold text-xs hover:bg-sky-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <AppIcon name="transfers" size={15} />
                <span>Despachar a Transportadora</span>
              </button>
            )}

            {order.status === 'SHIPPED' && (
              <button
                type="button"
                onClick={() => onDeliver(order)}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <AppIcon name="check" size={15} />
                <span>Registrar Entrega Exitosa</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="outline-button text-xs py-2 px-4 font-semibold"
            >
              Cerrar
            </button>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  )
}
