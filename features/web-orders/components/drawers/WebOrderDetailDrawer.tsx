'use client'

import React, { useState, useEffect } from 'react'
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
  const [availabilityResults, setAvailabilityResults] = useState<InventoryCheckResult[]>([])
  const [checkingStock, setCheckingStock] = useState(false)

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

  if (!isOpen || !order) return null

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

  // Flujo maestro de pasos para el timeline interactivo
  const STEPS: { status: WebOrderStatus; label: string; icon: string }[] = [
    { status: 'PENDING', label: 'Pendiente', icon: 'clock' },
    { status: 'CONFIRMED', label: 'Confirmado', icon: 'check' },
    { status: 'PREPARING', label: 'Preparación', icon: 'package' },
    { status: 'READY_TO_DISPATCH', label: 'Listo Despacho', icon: 'package' },
    { status: 'SHIPPED', label: 'Enviado', icon: 'transfers' },
    { status: 'DELIVERED', label: 'Entregado', icon: 'check' },
  ]

  const getStepIndex = (st: WebOrderStatus) => {
    if (st === 'CANCELLED') return -1
    return STEPS.findIndex((s) => s.status === st)
  }

  const currentStepIndex = getStepIndex(order.status)
  const isCancelled = order.status === 'CANCELLED'

  return (
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
        }}
      >
        {/* Drawer Header */}
        <div className="drawer-header border-b border-slate-200 dark:border-slate-800 p-5 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="eyebrow m-0 text-slate-500">Orden Ecommerce</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
                {order.channel === 'CATALOGO_DISTRIBUIDORA' ? 'Distribuidora' : 'Super Más'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                {order.status}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight m-0">
              {order.orderNumber}
            </h2>
          </div>

          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Timeline Interactivo Animado */}
          <section className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
              <AppIcon name="transfers" size={14} />
              <span>Línea de Tiempo del Pedido</span>
            </h3>

            {isCancelled ? (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                  <AppIcon name="close" size={14} />
                </div>
                <div className="text-xs">
                  <p className="font-bold m-0">Pedido Cancelado</p>
                  <p className="mt-1 m-0 text-rose-700">
                    Motivo: <strong>{order.cancellationReason || 'Cancelado por usuario'}</strong>
                  </p>
                  {order.cancelledAt && (
                    <p className="text-[10px] text-rose-500 mt-1 m-0">
                      Fecha: {formatDate(order.cancelledAt)} por {order.cancelledBy || 'Administración'}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative">
                {/* Steps Bar */}
                <div className="grid grid-cols-6 gap-2 text-center relative z-10">
                  {STEPS.map((step, idx) => {
                    const isCompleted = currentStepIndex > idx
                    const isCurrent = currentStepIndex === idx

                    return (
                      <div key={step.status} className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                            isCompleted
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : isCurrent
                              ? 'bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse'
                              : 'bg-slate-200 text-slate-400'
                          }`}
                        >
                          {isCompleted ? (
                            <AppIcon name="check" size={14} />
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-semibold mt-2 leading-tight ${
                            isCurrent
                              ? 'text-blue-700 font-bold'
                              : isCompleted
                              ? 'text-slate-800'
                              : 'text-slate-400'
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
                  <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
                    <p className="text-[11px] font-bold text-slate-600">Historial de Eventos:</p>
                    {order.timeline.map((evt, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2.5 text-xs text-slate-600 bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/80"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <strong className="text-slate-800">{evt.actor}</strong>
                            <span className="text-slate-400">{formatDate(evt.timestamp)}</span>
                          </div>
                          <p className="m-0 mt-0.5 text-slate-600 text-[11px]">{evt.notes}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Validación de Inventario & Bodega Ecommerce */}
          <section className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <AppIcon name="warehouse" size={14} />
                <span>Validación de Disponibilidad Ecommerce</span>
              </h3>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                Bodega Despacho: {order.assignedLocationName}
              </span>
            </div>

            {checkingStock ? (
              <p className="text-xs text-slate-400 py-2">Consultando disponibilidad en tiempo real...</p>
            ) : (
              <div className="space-y-2">
                {availabilityResults.map((av, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs border border-slate-100"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 block">{av.productName}</span>
                      <span className="text-[11px] text-slate-400">SKU: {av.sku}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Disponibilidad pública (Disponible / Pocas unidades / Agotado) */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          av.availability === 'AVAILABLE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : av.availability === 'LOW_STOCK'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {av.availability === 'AVAILABLE'
                          ? 'Disponible'
                          : av.availability === 'LOW_STOCK'
                          ? 'Pocas unidades'
                          : 'Agotado'}
                      </span>

                      {/* Chequeo de despacho en bodega ecommerce */}
                      <span
                        className={`text-[11px] font-medium ${
                          av.canFulfill ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {av.canFulfill ? '✓ CEDI OK' : '⚠ Requiere traslado'}
                      </span>
                    </div>
                  </div>
                ))}

                {['CONFIRMED', 'PREPARING', 'READY_TO_DISPATCH'].includes(order.status) && (
                  <div className="p-2.5 rounded-lg bg-blue-50/80 border border-blue-200/80 text-[11px] text-blue-800 flex items-center gap-2">
                    <AppIcon name="check" size={14} />
                    <span>
                      <strong>Inventario reservado:</strong> Este pedido tiene stock reservado en la Bodega
                      Ecommerce (CEDI) para asegurar su alistamiento sin riesgo de sobreventa.
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Información del Cliente & Envío */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cliente */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                <AppIcon name="customers" size={14} />
                <span>Datos del Cliente</span>
              </h3>
              <div className="space-y-1.5">
                <p className="m-0 font-bold text-slate-900 text-sm">{order.customerName}</p>
                <p className="m-0 text-slate-600">Doc / NIT: {order.customerDoc || 'No registrado'}</p>
                <p className="m-0 text-slate-600">Teléfono: {order.customerPhone}</p>
                <p className="m-0 text-slate-600">Email: {order.customerEmail}</p>
              </div>
            </div>

            {/* Dirección de Envío */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                <AppIcon name="warehouse" size={14} />
                <span>Dirección de Despacho</span>
              </h3>
              <div className="space-y-1.5">
                <p className="m-0 font-bold text-slate-900">{order.shippingAddress}</p>
                <p className="m-0 text-slate-600">
                  {order.city} {order.department ? `— ${order.department}` : ''}
                </p>
                {order.deliveryNotes && (
                  <p className="m-0 text-slate-500 text-[11px] italic bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 mt-2">
                    Notas: &quot;{order.deliveryNotes}&quot;
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Snapshot Histórico de Productos */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 m-0">
                <AppIcon name="products" size={14} />
                <span>Productos del Pedido (Snapshot Histórico)</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {order.itemsCount} ítems / {order.totalUnits} unids
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 bg-slate-50">
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3 text-center">Cant.</th>
                    <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                    <th className="py-2.5 px-3 text-right">IVA</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {order.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          {it.imageUrl && (
                            <img
                              src={it.imageUrl}
                              alt={it.productName}
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          )}
                          <div>
                            <span className="font-semibold text-slate-900 block">{it.productName}</span>
                            <span className="text-[10px] text-slate-400">
                              SKU: {it.sku} | {it.unitOfMeasure}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800">{it.quantity}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{formatMoney(it.unitPrice)}</td>
                      <td className="py-3 px-3 text-right text-slate-500">{formatMoney(it.taxAmount)}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">{formatMoney(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatMoney(order.subtotal)}</span>
                </div>
                {order.discountTotal > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Descuento:</span>
                    <span>-{formatMoney(order.discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Envío:</span>
                  <span>{order.shippingCost === 0 ? 'Gratis' : formatMoney(order.shippingCost)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Impuestos (IVA):</span>
                  <span>{formatMoney(order.taxTotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>Total Pedido:</span>
                  <span className="text-blue-700">{formatMoney(order.totalAmount)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Pago & Facturación */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pago */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                <AppIcon name="sales" size={14} />
                <span>Método & Estado de Pago</span>
              </h3>
              <div className="space-y-1.5">
                <p className="m-0 font-bold text-slate-900">{order.paymentMethod}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      order.paymentStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {order.paymentStatus === 'PAID' ? 'PAGADO' : 'PENDIENTE DE PAGO'}
                  </span>
                  {order.paymentReference && (
                    <span className="text-[11px] text-slate-500">Ref: {order.paymentReference}</span>
                  )}
                </div>
                {order.paidAt && (
                  <p className="text-[10px] text-slate-400 mt-1 m-0">Pagado: {formatDate(order.paidAt)}</p>
                )}
              </div>
            </div>

            {/* Facturación Electrónica DIAN */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 m-0">
                  <AppIcon name="invoices" size={14} />
                  <span>Facturación DIAN</span>
                </h3>
                {order.invoiceNumber && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    DIAN Validada
                  </span>
                )}
              </div>

              {order.invoiceNumber ? (
                <div className="space-y-1.5">
                  <p className="m-0 font-bold text-slate-900">{order.invoiceNumber}</p>
                  <p className="m-0 text-slate-600">Venta ERP: {order.saleNumber || 'Asociada'}</p>
                  <p className="m-0 text-[10px] text-slate-400">Estado DIAN: {order.dianStatus}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="m-0 text-slate-500">Este pedido aún no tiene factura electrónica emitida.</p>
                  {canInvoice && order.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      onClick={() => onInvoice(order)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <AppIcon name="invoices" size={14} />
                      <span>Emitir Factura Electrónica</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Despacho & Transportadora */}
          {(order.courier || order.trackingNumber) && (
            <section className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <AppIcon name="transfers" size={14} />
                <span>Datos de Despacho & Guía</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] text-slate-400 block">Transportadora</span>
                  <span className="font-bold text-slate-900">{order.courier}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Número de Guía</span>
                  <span className="font-bold text-blue-700 font-mono">{order.trackingNumber}</span>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Drawer Action Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
          <div>
            {['PENDING', 'CONFIRMED', 'PREPARING', 'READY_TO_DISPATCH'].includes(order.status) && canCancel && (
              <button
                type="button"
                onClick={() => onCancel(order)}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-rose-50"
              >
                <AppIcon name="close" size={14} />
                <span>Cancelar Pedido</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {order.status === 'PENDING' && canConfirm && (
              <button
                type="button"
                onClick={() => onConfirm(order)}
                className="primary-button text-xs py-2 px-4 flex items-center gap-1.5"
              >
                <AppIcon name="check" size={15} />
                <span>Confirmar Pedido (Reservar Stock)</span>
              </button>
            )}

            {order.status === 'CONFIRMED' && canPrepare && (
              <button
                type="button"
                onClick={() => onPrepare(order)}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold text-xs hover:bg-purple-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <AppIcon name="package" size={15} />
                <span>Alistar / Preparar Pedido</span>
              </button>
            )}

            {order.status === 'PREPARING' && canPrepare && (
              <button
                type="button"
                onClick={() => onPrepare(order)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <AppIcon name="check" size={15} />
                <span>Completar Checklist de Alistamiento</span>
              </button>
            )}

            {order.status === 'READY_TO_DISPATCH' && canDispatch && (
              <button
                type="button"
                onClick={() => onDispatch(order)}
                className="px-4 py-2 rounded-lg bg-sky-600 text-white font-semibold text-xs hover:bg-sky-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <AppIcon name="transfers" size={15} />
                <span>Despachar a Transportadora</span>
              </button>
            )}

            {order.status === 'SHIPPED' && (
              <button
                type="button"
                onClick={() => onDeliver(order)}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <AppIcon name="check" size={15} />
                <span>Registrar Entrega Exitosa</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="outline-button text-xs py-2 px-3"
            >
              Cerrar
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
