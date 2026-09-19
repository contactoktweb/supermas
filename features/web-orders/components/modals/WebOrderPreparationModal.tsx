'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { WebOrder, WebOrderChecklist } from '../../types'

interface WebOrderPreparationModalProps {
  isOpen: boolean
  order: WebOrder | null
  onClose: () => void
  onCompleteChecklist: (orderId: string, checklist: WebOrderChecklist) => Promise<any>
  onStartPreparation: (orderId: string) => Promise<any>
}

export function WebOrderPreparationModal({
  isOpen,
  order,
  onClose,
  onCompleteChecklist,
  onStartPreparation,
}: WebOrderPreparationModalProps) {
  const [mounted, setMounted] = useState(false)
  const [checklist, setChecklist] = useState<WebOrderChecklist>({
    itemsReviewed: false,
    quantitiesVerified: false,
    customerConfirmed: false,
    addressConfirmed: false,
    paymentVerified: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  if (!isOpen || !order || !mounted) return null

  const isConfirmedOnly = order.status === 'CONFIRMED'
  const isAllChecked =
    checklist.itemsReviewed &&
    checklist.quantitiesVerified &&
    checklist.customerConfirmed &&
    checklist.addressConfirmed &&
    checklist.paymentVerified

  const handleStart = async () => {
    try {
      setSubmitting(true)
      setError(null)
      await onStartPreparation(order.id)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al iniciar preparación.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAllChecked) {
      setError('Debes verificar todos los puntos del checklist antes de marcar como listo.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await onCompleteChecklist(order.id, checklist)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al completar checklist.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(100% - 32px, 520px)',
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(10, 24, 48, 0.25)',
          overflow: 'hidden',
          animation: 'fade .2s ease',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prep-modal-title"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-2xs">
              <AppIcon name="package" size={20} />
            </div>
            <div>
              <h2 id="prep-modal-title" className="text-base font-bold text-slate-900 m-0">Alistamiento y Separación</h2>
              <p className="text-xs text-slate-500 m-0">Pedido {order.orderNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleComplete} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          {isConfirmedOnly ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 leading-relaxed">
                <p className="font-bold mb-1">Paso 1: Iniciar Alistamiento Físico</p>
                El pedido se encuentra confirmado con reserva de stock en Bodega CEDI. Al iniciar preparación, el estado cambiará a <strong>EN PREPARACIÓN</strong> para que el equipo de bodega inicie el alistamiento de los {order.itemsCount} productos ({order.totalUnits} unidades).
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="outline-button text-xs py-2 px-4">
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold text-xs hover:bg-purple-700 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <AppIcon name="package" size={15} />
                  <span>{submitting ? 'Iniciando...' : 'Iniciar Preparación en Bodega'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Verifica exhaustivamente cada punto del checklist antes de marcar el pedido como <strong>Listo para Despacho</strong>:
              </p>

              <div className="space-y-2.5">
                <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.itemsReviewed}
                    onChange={(e) => setChecklist((prev) => ({ ...prev, itemsReviewed: e.target.checked }))}
                    className="mt-0.5 rounded text-blue-600"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">1. Productos y SKUs revisados</span>
                    <span className="text-slate-500">Se verificó la totalidad de las referencias físicas contra la lista de empaque.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.quantitiesVerified}
                    onChange={(e) => setChecklist((prev) => ({ ...prev, quantitiesVerified: e.target.checked }))}
                    className="mt-0.5 rounded text-blue-600"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">2. Cantidades exactas contadas</span>
                    <span className="text-slate-500">Las {order.totalUnits} unidades fueron contadas y separadas en la zona de embalaje.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.customerConfirmed}
                    onChange={(e) => setChecklist((prev) => ({ ...prev, customerConfirmed: e.target.checked }))}
                    className="mt-0.5 rounded text-blue-600"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">3. Datos de contacto del cliente</span>
                    <span className="text-slate-500">{order.customerName} ({order.customerPhone})</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.addressConfirmed}
                    onChange={(e) => setChecklist((prev) => ({ ...prev, addressConfirmed: e.target.checked }))}
                    className="mt-0.5 rounded text-blue-600"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">4. Dirección de entrega validada</span>
                    <span className="text-slate-500">{order.shippingAddress}, {order.city}</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.paymentVerified}
                    onChange={(e) => setChecklist((prev) => ({ ...prev, paymentVerified: e.target.checked }))}
                    className="mt-0.5 rounded text-blue-600"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">5. Soporte de pago confirmado</span>
                    <span className="text-slate-500">
                      {order.paymentMethod} — Estado: {order.paymentStatus}
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={onClose} className="outline-button text-xs py-2 px-4">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isAllChecked || submitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <AppIcon name="check" size={15} />
                  <span>{submitting ? 'Guardando...' : 'Completar Alistamiento (Listo para Despacho)'}</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body
  )
}
