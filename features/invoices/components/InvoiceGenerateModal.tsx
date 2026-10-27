'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { GenerateInvoicePayload, InvoiceType } from '../types'

interface InvoiceGenerateModalProps {
  isOpen: boolean
  onClose: () => void
  pendingSales: any[]
  loadingPendingSales: boolean
  onGenerateInvoice: (payload: GenerateInvoicePayload) => Promise<any>
  onRefreshPendingSales?: () => void
  onNavigate?: (view: string) => void
}

export function InvoiceGenerateModal({
  isOpen,
  onClose,
  pendingSales,
  loadingPendingSales,
  onGenerateInvoice,
  onRefreshPendingSales,
  onNavigate,
}: InvoiceGenerateModalProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  // Estado: Facturar desde Venta Registrada
  const [selectedSaleId, setSelectedSaleId] = useState<string>('')
  const invoiceType: InvoiceType = 'ELECTRONICA'

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHowItWorks, setShowHowItWorks] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-seleccionar la primera venta pendiente si está disponible
  useEffect(() => {
    if (pendingSales.length > 0 && !selectedSaleId) {
      setSelectedSaleId(pendingSales[0].id)
    } else if (pendingSales.length === 0) {
      setSelectedSaleId('')
    }
  }, [pendingSales, selectedSaleId])

  // Escuchar tecla Escape para cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, submitting, onClose])

  if (!isOpen || !mounted) return null

  const selectedSale = pendingSales.find((s) => s.id === selectedSaleId)

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val || 0)
  }

  // Validaciones fiscales del adquirente / cliente
  const isMissingDoc = !selectedSale?.customerDoc
  const isMissingEmail = !selectedSale?.customerEmail && invoiceType === 'ELECTRONICA'
  const hasFiscalWarning = isMissingDoc || isMissingEmail

  const handleNavigateTo = (path: string, viewName: string) => {
    onClose()
    if (onNavigate) {
      onNavigate(viewName)
    } else {
      router.push(path)
    }
  }

  // Emisión de factura sobre la venta seleccionada
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedSaleId) {
      setError('Debes seleccionar una venta comercial registrada para facturar.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await onGenerateInvoice({
        saleId: selectedSaleId,
        type: 'ELECTRONICA',
      })
    } catch (err: any) {
      console.error('Error al emitir factura:', err)
      setError(err?.message || 'Error al emitir la factura.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="drawer-backdrop modal-center p-3 sm:p-4 z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 24, 48, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="modal-card modal-card-flush animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
          overflow: 'hidden',
          margin: 'auto',
        }}
      >
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-2xs"
              style={{ background: 'var(--navy, #001B5C)' }}
            >
              <AppIcon name="invoices" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="invoice-modal-title" className="text-base font-bold text-slate-900 m-0">
                  Facturar Venta Comercial
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200 font-mono">
                  DIAN Anexo 1.9
                </span>
              </div>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Genera el documento fiscal oficial sobre una venta registrada y transmite a la DIAN.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Sub-barra: Indicador de estado y Guía DIAN */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <AppIcon name="receipt" size={14} className="text-blue-900" />
            <span>Desde Venta Registrada</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
              {loadingPendingSales ? 'Cargando...' : `${pendingSales.length} ${pendingSales.length === 1 ? 'disponible' : 'disponibles'}`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="text-[11px] font-semibold text-blue-800 hover:text-blue-950 inline-flex items-center gap-1 hover:underline"
          >
            <AppIcon name="alerts" size={13} />
            <span>{showHowItWorks ? 'Ocultar Guía' : '¿Cómo funciona?'}</span>
          </button>
        </div>

        {/* Guía Explicativa Plegable DIAN */}
        {showHowItWorks && (
          <div className="px-6 py-3 bg-blue-50/70 border-b border-blue-200 text-slate-800 text-xs shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-2.5 bg-white rounded-lg border border-blue-100 shadow-2xs">
                <strong className="block text-blue-950 font-bold mb-0.5 text-[11px]">
                  1. Venta Registrada
                </strong>
                <span className="text-[10.5px] text-slate-600 leading-tight block">
                  Se toma una venta comercial confirmada con su cliente (NIT/CC) y productos registrados.
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-blue-100 shadow-2xs">
                <strong className="block text-blue-950 font-bold mb-0.5 text-[11px]">
                  2. Emisión Fiscal
                </strong>
                <span className="text-[10.5px] text-slate-600 leading-tight block">
                  Se asigna el consecutivo oficial autorizado bajo resolución DIAN vigente y se calcula el IVA.
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-blue-100 shadow-2xs">
                <strong className="block text-blue-950 font-bold mb-0.5 text-[11px]">
                  3. Transmisión DIAN
                </strong>
                <span className="text-[10.5px] text-slate-600 leading-tight block">
                  Se genera el archivo XML UBL 2.1 con firma digital, código CUFE y QR oficial.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Cuerpo del Modal */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5">
              <AppIcon name="warning" size={18} className="text-rose-600 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {!loadingPendingSales && pendingSales.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto text-white shadow-2xs"
                style={{ background: 'var(--navy, #001B5C)' }}
              >
                <AppIcon name="receipt" size={22} />
              </div>

              <div className="max-w-md mx-auto">
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 mb-1.5 uppercase tracking-wide">
                  Ventas al Día
                </span>
                <h3 className="text-sm font-bold text-slate-900 m-0 mb-1">
                  No hay ventas pendientes por facturar
                </h3>
                <p className="text-xs text-slate-500 m-0 leading-relaxed">
                  Todas las ventas comerciales registradas ya cuentan con factura emitida o aún no se han registrado ventas en el sistema. Puedes registrar una venta en el punto de cobro (POS) o verificar las ventas registradas.
                </p>
              </div>

              {/* Fila de botones limpia sin factura directa */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  className="primary-button text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold shadow-2xs"
                  style={{ background: 'var(--navy, #001B5C)' }}
                  onClick={() => handleNavigateTo('/pos', 'pos')}
                >
                  <AppIcon name="pos" size={14} />
                  <span>Ir a Cobrar en POS</span>
                </button>

                <button
                  type="button"
                  className="outline-button text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold bg-white"
                  onClick={() => handleNavigateTo('/ventas', 'ventas')}
                >
                  <AppIcon name="receipt" size={14} />
                  <span>Ver Ventas</span>
                </button>

                {onRefreshPendingSales && (
                  <button
                    type="button"
                    className="outline-button text-xs py-1.5 px-2.5 flex items-center gap-1 bg-white text-slate-600 hover:text-slate-900"
                    onClick={onRefreshPendingSales}
                    title="Comprobar de nuevo ventas pendientes"
                  >
                    <AppIcon name="refresh" size={13} />
                    <span>Actualizar</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form id="invoice-generate-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Selector de Venta Comercial Pendiente */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-blue-900 text-white inline-flex items-center justify-center text-[10px] font-bold">
                      1
                    </span>
                    Seleccionar Venta Comercial *
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {pendingSales.length} {pendingSales.length === 1 ? 'venta lista' : 'ventas listas'}
                  </span>
                </div>

                {loadingPendingSales ? (
                  <div className="p-3 text-slate-500 text-xs bg-slate-50 rounded-lg border border-slate-200 animate-pulse">
                    Cargando ventas pendientes de facturar...
                  </div>
                ) : (
                  <CustomSelect
                    value={selectedSaleId}
                    onChange={(val) => setSelectedSaleId(val)}
                    options={pendingSales.map((s) => ({
                      value: s.id,
                      label: `${s.saleNumber} · ${s.customerName} · ${formatCOP(s.totalAmount || s.total)} (${s.locationName || 'Sede Principal'})`,
                    }))}
                    placeholder="Selecciona una venta para facturar..."
                  />
                )}
              </div>

              {/* Tarjeta de Detalle Fiscal de la Venta Seleccionada */}
              {selectedSale && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <strong className="text-xs font-bold text-slate-900">
                        Venta: {selectedSale.saleNumber}
                      </strong>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                        {selectedSale.locationName || 'Sede Principal'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase font-bold mr-1.5">
                        Total Venta:
                      </span>
                      <strong className="text-sm font-mono font-bold text-blue-950">
                        {formatCOP(selectedSale.totalAmount || selectedSale.total)}
                      </strong>
                    </div>
                  </div>

                  {/* Datos del Cliente */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-semibold uppercase">
                        Adquirente / Cliente:
                      </span>
                      <strong className="text-slate-900 block truncate">
                        {selectedSale.customerName || 'Consumidor Final'}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block font-semibold uppercase">
                        NIT / C.C. DIAN:
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono font-bold text-slate-900">
                          {selectedSale.customerDoc || '222222222222'}
                        </span>
                        <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                          {selectedSale.customerDoc ? 'Registrado' : 'Consumidor Final'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block font-semibold uppercase">
                        Correo Envío DIAN:
                      </span>
                      <span className="text-slate-800 block truncate font-mono text-[11px] mt-0.5">
                        {selectedSale.customerEmail || 'Sin correo registrado'}
                      </span>
                    </div>
                  </div>

                  {/* Desglose de ítems */}
                  {selectedSale.items && selectedSale.items.length > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-[10.5px] font-bold text-slate-700 block mb-1">
                        Productos a facturar ({selectedSale.items.length} ítems):
                      </span>
                      <div className="max-h-24 overflow-y-auto space-y-1 bg-white p-2 rounded-lg border border-slate-200 text-[11px]">
                        {selectedSale.items.map((it: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-slate-700">
                            <span className="truncate pr-2">
                              <strong>{it.quantity}x</strong> {it.productName}
                            </span>
                            <span className="font-mono font-semibold text-slate-900 shrink-0">
                              {formatCOP(it.total || it.quantity * it.unitPrice)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Advertencia Fiscal si faltan datos */}
                  {hasFiscalWarning && (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                      <AppIcon name="warning" size={14} className="text-amber-600 shrink-0" />
                      <span>
                        {isMissingDoc && 'Falta NIT/CC específico del cliente (se usará Consumidor Final). '}
                        {isMissingEmail && 'Para facturación electrónica se recomienda registrar el correo para envío automático.'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Datos fiscales que asigna el servidor */}
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-slate-800 space-y-1">
                <p className="font-bold text-blue-900">Factura Electrónica de Venta (DIAN)</p>
                <p>
                  El número de la factura se asigna automáticamente según la resolución DIAN vigente y se usa el medio de
                  pago registrado en la venta. Al confirmar, la factura se envía a la DIAN y, cuando la acepta, al correo
                  del cliente.
                </p>
                <p className="text-slate-600">Si falta algún dato del cliente o de la empresa, el detalle de la factura indica qué completar.</p>
              </div>
            </form>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Prefijo, consecutivo y resolución se asignan desde la resolución DIAN vigente.
          </span>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              className="outline-button compact text-xs"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>

            {pendingSales.length > 0 && (
              <button
                type="submit"
                form="invoice-generate-form"
                className="primary-button compact text-xs flex items-center gap-2 font-bold shadow-2xs"
                style={{ background: 'var(--navy, #001B5C)' }}
                disabled={submitting || !selectedSaleId}
              >
                <AppIcon name="invoices" size={14} className={submitting ? 'animate-bounce' : ''} />
                <span>
                  {submitting
                    ? 'Emitiendo Factura...'
                    : invoiceType === 'ELECTRONICA'
                    ? 'Emitir Factura Electrónica'
                    : 'Emitir Factura POS'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
