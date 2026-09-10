'use client'

import React from 'react'
import { POSDailySaleSummary } from '../types'
import {
  X,
  History,
  Banknote,
  CreditCard,
  QrCode,
  Layers,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  Clock,
  User,
} from 'lucide-react'

interface POSDailySalesDrawerProps {
  isOpen: boolean
  onClose: () => void
  sales: POSDailySaleSummary[]
  loading: boolean
  cashierName: string
  cashRegisterNumber: string
  onRefresh: () => void
}

export const POSDailySalesDrawer: React.FC<POSDailySalesDrawerProps> = ({
  isOpen,
  onClose,
  sales,
  loading,
  cashierName,
  cashRegisterNumber,
  onRefresh,
}) => {
  if (!isOpen) return null

  // Calculate shift stats
  const totalSalesCount = sales.length
  const totalRevenue = sales.reduce((acc, s) => acc + s.totalAmount, 0)
  
  const cashTotal = sales
    .filter((s) => s.paymentMethod === 'EFECTIVO')
    .reduce((acc, s) => acc + s.totalAmount, 0)

  const cardTotal = sales
    .filter((s) => s.paymentMethod === 'TARJETA')
    .reduce((acc, s) => acc + s.totalAmount, 0)

  const transferTotal = sales
    .filter((s) => s.paymentMethod === 'TRANSFERENCIA')
    .reduce((acc, s) => acc + s.totalAmount, 0)

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
          {/* Drawer Header */}
          <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 flex items-center justify-center text-blue-400 border border-blue-500/30">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Mis Ventas del Turno
                </h2>
                <p className="text-xs text-slate-400 flex items-center gap-2">
                  <span>{cashierName}</span>
                  <span>·</span>
                  <span className="text-emerald-400 font-semibold">{cashRegisterNumber}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={onRefresh}
                disabled={loading}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
                title="Actualizar ventas"
                aria-label="Actualizar ventas"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                aria-label="Cerrar drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Shift Summary Metrics */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 rounded-2xl text-white shadow-md">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Total Recaudado Hoy
              </span>
              <div className="text-2xl font-black text-white mt-0.5">
                ${totalRevenue.toLocaleString('es-CO')}
              </div>
              <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                <span>{totalSalesCount} {totalSalesCount === 1 ? 'ticket emitido' : 'tickets emitidos'}</span>
                <span className="text-emerald-400 font-semibold">Caja Abierta</span>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-1 text-slate-500 font-semibold mb-1">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Efectivo</span>
                </div>
                <div className="font-bold text-slate-900">
                  ${cashTotal.toLocaleString('es-CO')}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-1 text-slate-500 font-semibold mb-1">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tarjeta</span>
                </div>
                <div className="font-bold text-slate-900">
                  ${cardTotal.toLocaleString('es-CO')}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-1 text-slate-500 font-semibold mb-1">
                  <QrCode className="w-3.5 h-3.5 text-purple-600" />
                  <span>Transf.</span>
                </div>
                <div className="font-bold text-slate-900">
                  ${transferTotal.toLocaleString('es-CO')}
                </div>
              </div>
            </div>
          </div>

          {/* Sales List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Historial de Transacciones ({sales.length})
            </h3>

            {sales.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingBag className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-600 font-semibold text-sm">No has realizado ventas en este turno</p>
                <p className="text-slate-400 text-xs mt-1">Las ventas completadas aparecerán aquí</p>
              </div>
            ) : (
              sales.map((sale) => {
                let MethodIcon = Banknote
                let methodColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'

                if (sale.paymentMethod === 'TARJETA') {
                  MethodIcon = CreditCard
                  methodColor = 'bg-blue-50 text-blue-700 border-blue-200'
                } else if (sale.paymentMethod === 'TRANSFERENCIA') {
                  MethodIcon = QrCode
                  methodColor = 'bg-purple-50 text-purple-700 border-purple-200'
                } else if (sale.paymentMethod === 'MIXTO' || (sale.paymentMethod as any) === 'OTRO') {
                  MethodIcon = Layers
                  methodColor = 'bg-amber-50 text-amber-700 border-amber-200'
                }

                return (
                  <div
                    key={sale.saleId || sale.id || sale.saleNumber}
                    className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-sm transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                          {sale.saleNumber}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {sale.time}
                        </span>
                      </div>
                      <span className="font-black text-sm text-slate-900">
                        ${sale.totalAmount.toLocaleString('es-CO')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <span className="text-slate-600 flex items-center gap-1 truncate max-w-[180px]">
                        <User className="w-3 h-3 text-slate-400" />
                        {sale.customerName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${methodColor}`}>
                          <MethodIcon className="w-3 h-3" />
                          {sale.paymentMethod}
                        </span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Completada" />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors text-center"
            >
              Cerrar Panel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
