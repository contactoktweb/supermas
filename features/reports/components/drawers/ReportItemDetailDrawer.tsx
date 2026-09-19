'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface ReportItemDetailDrawerProps {
  item: {
    type: 'SALE' | 'PURCHASE' | 'PRODUCT' | 'CUSTOMER' | 'SUPPLIER' | 'REGISTER'
    id: string
    title: string
    data: any
  } | null
  onClose: () => void
}

export function ReportItemDetailDrawer({ item, onClose }: ReportItemDetailDrawerProps) {
  if (!item) return null

  const { type, title, data } = item

  return (
    <div className="drawer-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="product-drawer"
        style={{ width: 'min(100%, 480px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Header */}
          <div className="drawer-header" style={{ marginBottom: 16 }}>
            <div>
              <span className="eyebrow">Auditoría Analítica · {type}</span>
              <h2>{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="icon-button"
              aria-label="Cerrar detalle"
              style={{ width: 32, height: 32, borderRadius: 8, background: '#f1f5f9' }}
            >
              <AppIcon name="closeSimple" size={16} />
            </button>
          </div>

          {/* Content Body according to Type */}
          <div className="mt-6 space-y-5">
            {type === 'SALE' && (
              <div className="space-y-4 text-xs font-mono">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-sans font-medium block">Documento</span>
                    <span className="font-bold text-blue-600">{data.invoiceNumber || data.saleNumber}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-sans font-medium block">Total</span>
                    <span className="font-bold text-emerald-700">
                      ${Number(data.total || 0).toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans font-medium">Cliente:</span>
                    <span className="text-slate-900 font-sans font-bold">{data.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans font-medium">Documento:</span>
                    <span className="text-slate-700 font-medium">{data.customerDoc}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans font-medium">Vendedor:</span>
                    <span className="text-slate-800 font-sans font-semibold">{data.sellerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans font-medium">Bodega:</span>
                    <span className="text-slate-800 font-sans font-semibold">{data.locationName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans font-medium">Medio de Pago:</span>
                    <span className="text-slate-900 font-bold">{data.paymentMethod}</span>
                  </div>
                </div>
              </div>
            )}

            {type === 'PRODUCT' && (
              <div className="space-y-4 text-xs font-mono">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-sans font-medium block">Stock Total</span>
                    <span className="font-bold text-blue-600">{data.stockTotal} unidades</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-sans font-medium block">Precio Venta</span>
                    <span className="font-bold text-emerald-700">
                      ${Number(data.normalPrice || 0).toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>

                {data.locationsBreakdown && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 font-sans mb-2">
                      Existencias por Bodega
                    </h3>
                    <div className="space-y-2">
                      {data.locationsBreakdown.map((loc: any) => (
                        <div
                          key={loc.locationId}
                          className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border border-slate-200"
                        >
                          <span className="font-sans font-medium text-slate-700">{loc.locationName}</span>
                          <span className="font-bold text-slate-950">{loc.units} u.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {type === 'CUSTOMER' && (
              <div className="space-y-4 text-xs font-mono">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans font-medium">Documento:</span>
                    <span className="text-slate-900 font-bold">{data.documentNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans font-medium">Tipo Cliente:</span>
                    <span className="text-slate-700 font-sans font-semibold">{data.customerType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans font-medium">Compras Totales:</span>
                    <span className="text-blue-600 font-bold">{data.purchasesCount} órdenes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans font-medium">Total Facturado:</span>
                    <span className="text-emerald-700 font-bold">
                      ${Number(data.totalPurchased || 0).toLocaleString('es-CO')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans font-medium">Saldo Pendiente (CxC):</span>
                    <span className="text-amber-800 font-bold">
                      ${Number(data.currentReceivableBalance || 0).toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-slate-200 mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-2xs"
          >
            Cerrar Detalle
          </button>
        </div>
      </div>
    </div>
  )
}
